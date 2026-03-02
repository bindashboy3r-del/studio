
"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, RefreshCw, Check, X as CloseIcon, Wallet, Zap, Save, Trash2 } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function FundRequestsPage() {
  const { user: admin, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [globalBonus, setGlobalBonus] = useState("0");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const router = useRouter();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const ADMIN_ID = "s55uL0f8PmcypR75usVYOLwVs7O2";

  useEffect(() => {
    if (!isUserLoading && (!admin || (admin.email !== ADMIN_EMAIL && admin.uid !== ADMIN_ID))) {
      router.push("/admin/login");
    }
  }, [admin, isUserLoading, router]);

  // Load Global Settings
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) {
        setGlobalBonus(snap.data().bonusPercentage?.toString() || "0");
      }
    });
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (!admin || !db) return;

    const q = query(collection(db, "fundRequests"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        if (data.createdAt) {
          createdAt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        }
        return { id: doc.id, ...data, createdAt };
      });

      reqs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      const newCreditAmounts: Record<string, string> = { ...creditAmounts };
      const bonusPct = parseFloat(globalBonus) || 0;

      reqs.forEach(r => {
        if (r.status === 'Pending' && !newCreditAmounts[r.id]) {
          const bonusAmount = (r.amount * bonusPct) / 100;
          const totalWithBonus = r.amount + bonusAmount;
          newCreditAmounts[r.id] = totalWithBonus.toFixed(0);
        }
      });
      
      setCreditAmounts(newCreditAmounts);
      setRequests(reqs);
      setLoading(false);
    }, (error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'fundRequests',
        operation: 'list'
      }));
    });
    
    return () => unsubscribe();
  }, [admin, db, globalBonus]);

  const saveGlobalBonus = async () => {
    if (!db) return;
    setIsSavingSettings(true);
    try {
      const bonusVal = parseFloat(globalBonus) || 0;
      await setDoc(doc(db, "globalSettings", "finance"), {
        bonusPercentage: bonusVal,
        updatedAt: serverTimestamp(),
        updatedBy: admin?.email
      }, { merge: true });
      
      const updatedCredits = { ...creditAmounts };
      requests.forEach(r => {
        if (r.status === 'Pending') {
          updatedCredits[r.id] = (r.amount + (r.amount * bonusVal / 100)).toFixed(0);
        }
      });
      setCreditAmounts(updatedCredits);

      toast({ 
        title: bonusVal > 0 ? "Offer Active!" : "Bonus Removed", 
        description: bonusVal > 0 ? `Global bonus set to ${bonusVal}%` : "Users will no longer see bonus offers." 
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const stopGlobalBonus = async () => {
    if (!db) return;
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, "globalSettings", "finance"), {
        bonusPercentage: 0,
        updatedAt: serverTimestamp(),
        updatedBy: admin?.email
      }, { merge: true });
      
      setGlobalBonus("0");
      const updatedCredits = { ...creditAmounts };
      requests.forEach(r => {
        if (r.status === 'Pending') {
          updatedCredits[r.id] = r.amount.toString();
        }
      });
      setCreditAmounts(updatedCredits);

      toast({ title: "Offer Stopped", description: "Global bonus has been set to 0%." });
    } catch (e) {
      toast({ variant: "destructive", title: "Operation Failed" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRequest = async (request: any, action: 'Approved' | 'Rejected') => {
    if (!db || !admin) return;
    if (!request.userId) {
      toast({ variant: "destructive", title: "Error", description: "User ID missing in request." });
      return;
    }

    setProcessingId(request.id);
    
    const finalCredit = action === 'Approved' ? parseFloat(creditAmounts[request.id]) : 0;
    const validatedAmount = isNaN(finalCredit) ? request.amount : finalCredit;

    const batch = writeBatch(db);

    const reqRef = doc(db, "fundRequests", request.id);
    batch.update(reqRef, { 
      status: action,
      finalCreditAmount: action === 'Approved' ? validatedAmount : 0,
      processedBy: admin.uid,
      processedAt: serverTimestamp()
    });

    if (action === 'Approved') {
      const userRef = doc(db, "users", request.userId);
      batch.update(userRef, {
        balance: increment(validatedAmount)
      });

      // Notification 1: Main Amount
      const notifRef = doc(collection(db, "users", request.userId, "notifications"));
      batch.set(notifRef, {
        title: '💰 Wallet Refilled!',
        message: `₹${request.amount} has been successfully credited to your wallet.`,
        read: false,
        createdAt: serverTimestamp()
      });

      // Notification 2: Separate Bonus Notification (If applicable)
      const bonusAmount = validatedAmount - request.amount;
      if (bonusAmount > 0) {
        const bonusNotifRef = doc(collection(db, "users", request.userId, "notifications"));
        batch.set(bonusNotifRef, {
          title: '🎉 Bonus Credited!',
          message: `Congratulations! Your bonus of ₹${bonusAmount.toFixed(0)} has been added to your wallet.`,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } else {
      const notifRef = doc(collection(db, "users", request.userId, "notifications"));
      batch.set(notifRef, {
        title: '❌ Fund Request Rejected',
        message: `Your fund request for ₹${request.amount} was rejected. Please contact support.`,
        read: false,
        createdAt: serverTimestamp()
      });
    }

    batch.commit()
      .then(() => {
        toast({ 
          title: `Request ${action}`, 
          description: action === 'Approved' ? `₹${validatedAmount.toFixed(0)} credited.` : `Request denied.` 
        });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `batch-operation (fundRequests/${request.id})`,
          operation: 'write',
          requestResourceData: { action, validatedAmount, userId: request.userId }
        }));
      })
      .finally(() => {
        setProcessingId(null);
      });
  };

  const updateAmount = (id: string, val: string) => {
    setCreditAmounts(prev => ({ ...prev, [id]: val }));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin")} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#111B21]">FUND REQUESTS</h1>
              <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">Verify & Credit Wallet Funds</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center gap-4 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Bonus %</span>
              <div className="flex items-center gap-2 mt-1">
                <Zap className={parseFloat(globalBonus) > 0 ? "text-emerald-500 animate-pulse" : "text-slate-300"} size={16} />
                <Input 
                  type="number"
                  value={globalBonus}
                  onChange={(e) => setGlobalBonus(e.target.value)}
                  className="w-20 h-10 bg-slate-50 border-none rounded-xl text-sm font-black text-[#111B21]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={saveGlobalBonus} 
                disabled={isSavingSettings}
                className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-12 px-4 shadow-lg shadow-blue-500/20 gap-2 text-[10px] font-black uppercase"
              >
                <Save size={18} /> Update
              </Button>
              {parseFloat(globalBonus) > 0 && (
                <Button 
                  variant="destructive"
                  onClick={stopGlobalBonus} 
                  disabled={isSavingSettings}
                  className="rounded-xl h-12 px-4 shadow-lg shadow-red-500/20 gap-2 text-[10px] font-black uppercase"
                >
                  <Trash2 size={18} /> Stop Offer
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">User</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Requested</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Credit Amount (Total)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">UTR ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-black text-[#111B21] text-sm">{req.displayName || 'Anonymous'}</span>
                      <span className="text-[10px] font-bold text-slate-400">{req.userEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-slate-400 text-sm">₹{req.amount}</TableCell>
                  <TableCell>
                    {req.status === 'Pending' ? (
                      <div className="flex items-center gap-2 max-w-[140px]">
                        <div className="relative w-full">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-600">₹</span>
                          <Input 
                            type="number"
                            value={creditAmounts[req.id] || ""}
                            onChange={(e) => updateAmount(req.id, e.target.value)}
                            className="h-10 bg-emerald-50 border-none rounded-xl pl-6 text-sm font-black text-emerald-700 shadow-inner focus-visible:ring-1 focus-visible:ring-emerald-500/20"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-black text-sm">
                        <Wallet size={14} />
                        ₹{req.finalCreditAmount || req.amount}
                      </div>
                    )}
                  </TableCell>
                  <TableCell><code className="bg-slate-100 px-3 py-1 rounded-lg text-[11px] font-black">{req.utrId}</code></TableCell>
                  <TableCell>
                    <Badge className={
                      req.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-600 border-none' : 
                      req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 border-none' :
                      'bg-red-500/10 text-red-600 border-none'
                    }>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === 'Pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          disabled={processingId === req.id}
                          onClick={() => handleRequest(req, 'Approved')} 
                          className="bg-emerald-500 hover:bg-emerald-600 h-10 w-10 rounded-xl p-0 shadow-lg"
                        >
                          {processingId === req.id ? <RefreshCw className="animate-spin h-4 w-4" /> : <Check size={18} />}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          disabled={processingId === req.id}
                          onClick={() => handleRequest(req, 'Rejected')} 
                          className="h-10 w-10 rounded-xl p-0 shadow-lg"
                        >
                          <CloseIcon size={18} />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Locked</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </main>
      </div>
    </div>
  );
}
