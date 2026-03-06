
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
import { ChevronLeft, RefreshCw, Check, X as CloseIcon, Wallet, Zap, Save } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  const isActuallyAdmin = admin?.email === ADMIN_EMAIL || admin?.uid === ADMIN_ID;

  useEffect(() => {
    if (!isUserLoading && (!admin || !isActuallyAdmin)) {
      router.push("/admin/login");
    }
  }, [admin, isUserLoading, isActuallyAdmin, router]);

  useEffect(() => {
    if (!db || !isActuallyAdmin) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) {
        setGlobalBonus(snap.data().bonusPercentage?.toString() || "0");
      }
    });
    return () => unsub();
  }, [db, isActuallyAdmin]);

  useEffect(() => {
    if (!admin || !db || !isActuallyAdmin) return;

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
    });
    
    return () => unsubscribe();
  }, [admin, db, globalBonus, isActuallyAdmin]);

  const saveGlobalBonus = async () => {
    if (!db || !isActuallyAdmin) return;
    setIsSavingSettings(true);
    try {
      const bonusVal = parseFloat(globalBonus) || 0;
      await setDoc(doc(db, "globalSettings", "finance"), {
        bonusPercentage: bonusVal,
        updatedAt: serverTimestamp(),
        updatedBy: admin?.email
      }, { merge: true });
      
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

  const handleRequest = async (request: any, action: 'Approved' | 'Rejected') => {
    if (!db || !admin || !isActuallyAdmin) return;
    setProcessingId(request.id);
    
    const finalCreditStr = creditAmounts[request.id];
    const validatedAmount = action === 'Approved' ? (parseFloat(finalCreditStr) || request.amount) : 0;

    const batch = writeBatch(db);
    const reqRef = doc(db, "fundRequests", request.id);
    
    batch.update(reqRef, { 
      status: action,
      finalCreditAmount: validatedAmount,
      processedBy: admin.uid,
      processedAt: serverTimestamp()
    });

    if (action === 'Approved') {
      const userRef = doc(db, "users", request.userId);
      batch.update(userRef, {
        balance: increment(validatedAmount)
      });

      const notifRef = doc(collection(db, "users", request.userId, "notifications"));
      batch.set(notifRef, {
        title: '💰 Wallet Credited!',
        message: `₹${validatedAmount.toFixed(0)} added successfully.`,
        read: false,
        createdAt: serverTimestamp()
      });
    }

    batch.commit()
      .then(() => toast({ title: `Request ${action}` }))
      .catch(() => toast({ variant: "destructive", title: "Error" }))
      .finally(() => setProcessingId(null));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body text-slate-950">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin")} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">PAYMENT APPROVALS</h1>
              <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">Verify & Approve Fund Requests</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-[2rem] border border-slate-100 flex items-center gap-4 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Deposit Bonus %</span>
              <div className="flex items-center gap-2 mt-1">
                <Zap className={parseFloat(globalBonus) > 0 ? "text-emerald-500 animate-pulse" : "text-slate-300"} size={16} />
                <Input 
                  type="number"
                  value={globalBonus}
                  onChange={(e) => setGlobalBonus(e.target.value)}
                  className="w-20 h-10 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-950"
                />
              </div>
            </div>
            <Button onClick={saveGlobalBonus} className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-12 px-6 shadow-lg text-[10px] font-black uppercase text-white">
              <Save size={18} className="mr-2" /> Save Settings
            </Button>
          </div>
        </header>

        <main className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100">
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">User</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">Requested</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">Final Credit</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">UTR ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase py-6 text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="border-slate-50 hover:bg-slate-50/50">
                  <TableCell>
                    <div className="flex flex-col text-slate-950">
                      <span className="font-black text-sm">{req.displayName || 'Anonymous'}</span>
                      <span className="text-[10px] font-bold text-slate-500">{req.userEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-slate-600 text-sm">₹{req.amount}</TableCell>
                  <TableCell>
                    {req.status === 'Pending' ? (
                      <Input 
                        type="number"
                        value={creditAmounts[req.id] || ""}
                        onChange={(e) => setCreditAmounts({...creditAmounts, [req.id]: e.target.value})}
                        className="h-10 w-24 bg-emerald-50 border-none rounded-xl text-sm font-black text-emerald-700"
                      />
                    ) : (
                      <div className="font-black text-emerald-600 text-sm">₹{req.finalCreditAmount || req.amount}</div>
                    )}
                  </TableCell>
                  <TableCell><code className="bg-slate-100 px-3 py-1 rounded-lg text-[11px] font-black text-slate-700">{req.utrId}</code></TableCell>
                  <TableCell>
                    <Badge className={cn("text-[8px] font-black px-2 h-5 border-none", req.status === 'Pending' ? 'bg-amber-100 text-amber-600' : req.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600')}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === 'Pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => handleRequest(req, 'Approved')} disabled={processingId === req.id} className="bg-emerald-500 hover:bg-emerald-600 h-10 w-10 rounded-xl p-0 text-white"><Check size={18} /></Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRequest(req, 'Rejected')} disabled={processingId === req.id} className="h-10 w-10 rounded-xl p-0"><CloseIcon size={18} /></Button>
                      </div>
                    ) : <span className="text-[9px] font-black text-slate-300 uppercase">Processed</span>}
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
