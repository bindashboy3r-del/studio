
"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc,
  serverTimestamp,
  writeBatch,
  increment,
  addDoc
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
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, RefreshCw, Wallet, Check, X as CloseIcon, Zap } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export default function FundRequestsPage() {
  const { user: admin, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyBonus, setApplyBonus] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && (!admin || admin.email !== "chetanmadhav4@gmail.com")) {
      router.push("/admin/login");
    }
  }, [admin, isUserLoading, router]);

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
      setRequests(reqs);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [admin, db]);

  const handleRequest = async (request: any, action: 'Approved' | 'Rejected') => {
    if (!db) return;
    const batch = writeBatch(db);
    const isBonus = applyBonus[request.id];
    const bonusMultiplier = isBonus ? 1.1 : 1.0;
    const finalAmount = request.amount * bonusMultiplier;

    // 1. Update the request status
    const reqRef = doc(db, "fundRequests", request.id);
    batch.update(reqRef, { 
      status: action,
      finalCreditAmount: finalAmount,
      bonusApplied: isBonus
    });

    // 2. If approved, update user balance
    if (action === 'Approved') {
      const userRef = doc(db, "users", request.userId);
      batch.update(userRef, {
        balance: increment(finalAmount)
      });
    }

    // 3. Create notification for user
    const notifRef = collection(db, "users", request.userId, "notifications");
    addDoc(notifRef, {
      title: action === 'Approved' ? '💰 Wallet Refilled!' : '❌ Fund Request Rejected',
      message: action === 'Approved' 
        ? `₹${finalAmount.toFixed(0)} has been added to your wallet${isBonus ? ' (includes 10% bonus!)' : ''}.`
        : `Your fund request for ₹${request.amount} was rejected. Incorrect UTR ID.`,
      read: false,
      createdAt: serverTimestamp()
    });

    await batch.commit().then(() => {
      toast({ 
        title: `Request ${action}`, 
        description: action === 'Approved' ? `₹${finalAmount.toFixed(0)} credited to user.` : `Request denied.` 
      });
    });
  };

  const toggleBonus = (id: string) => {
    setApplyBonus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => router.push("/admin")} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#111B21]">FUND REQUESTS</h1>
            <p className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">Verify Wallet Top-ups</p>
          </div>
        </header>

        <main className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">User</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Amount</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Offer (10%)</TableHead>
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
                  <TableCell className="font-black text-emerald-600 text-sm">₹{req.amount}</TableCell>
                  <TableCell>
                    {req.status === 'Pending' ? (
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id={`bonus-${req.id}`} 
                          checked={applyBonus[req.id] || false} 
                          onCheckedChange={() => toggleBonus(req.id)}
                        />
                        <label htmlFor={`bonus-${req.id}`} className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-1 cursor-pointer">
                          <Zap size={10} className="fill-current" /> Add 10%
                        </label>
                      </div>
                    ) : (
                      <span className="text-[9px] font-black uppercase text-slate-300">
                        {req.bonusApplied ? 'Bonus Added' : 'No Bonus'}
                      </span>
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
                        <Button size="sm" onClick={() => handleRequest(req, 'Approved')} className="bg-emerald-500 hover:bg-emerald-600 h-10 w-10 rounded-xl p-0 shadow-lg">
                          <Check size={18} />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRequest(req, 'Rejected')} className="h-10 w-10 rounded-xl p-0 shadow-lg">
                          <CloseIcon size={18} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Processed</span>
                        {req.finalCreditAmount && (
                          <span className="text-[10px] font-black text-emerald-600">Total: ₹{req.finalCreditAmount.toFixed(0)}</span>
                        )}
                      </div>
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
