
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
  getDoc,
  where
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
import { ChevronLeft, RefreshCw, Check, X as CloseIcon } from "lucide-react";
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
  const [globalBonus, setGlobalBonus] = useState(0);
  const router = useRouter();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const ADMIN_ID = "s55uL0f8PmcypR75usVYOLwVs7O2";
  const isActuallyAdmin = admin?.email === ADMIN_EMAIL || admin?.uid === ADMIN_ID;

  useEffect(() => {
    if (!isUserLoading && (!admin || !isActuallyAdmin)) router.push("/admin/login");
  }, [admin, isUserLoading, isActuallyAdmin, router]);

  useEffect(() => {
    if (!db || !isActuallyAdmin) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setGlobalBonus(snap.data().bonusPercentage || 0);
    });
    return () => unsub();
  }, [db, isActuallyAdmin]);

  useEffect(() => {
    if (!admin || !db || !isActuallyAdmin) return;
    const q = query(collection(db, "fundRequests"), where("status", "==", "Pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        return { id: doc.id, ...data, createdAt };
      });
      reqs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      const newCreditAmounts: Record<string, string> = { ...creditAmounts };
      reqs.forEach(r => {
        if (!newCreditAmounts[r.id]) {
          const bonusVal = globalBonus || 0;
          const totalWithBonus = Math.floor(r.amount * (1 + bonusVal / 100));
          newCreditAmounts[r.id] = totalWithBonus.toString();
        }
      });
      setCreditAmounts(newCreditAmounts);
      setRequests(reqs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [admin, db, globalBonus, isActuallyAdmin]);

  const handleRequest = async (request: any, action: 'Approved' | 'Rejected') => {
    if (!db || !admin || !isActuallyAdmin) return;
    setProcessingId(request.id);
    
    // Use the amount from the input box
    const finalCreditStr = creditAmounts[request.id];
    const validatedAmount = action === 'Approved' ? (parseFloat(finalCreditStr) || request.amount) : 0;

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "fundRequests", request.id), { 
        status: action,
        finalCreditAmount: validatedAmount,
        processedBy: admin.uid,
        processedAt: serverTimestamp()
      });

      if (action === 'Approved') {
        batch.update(doc(db, "users", request.userId), { balance: increment(validatedAmount) });
        batch.set(doc(collection(db, "users", request.userId, "notifications")), {
          title: '💰 Wallet Credited!', 
          message: `₹${validatedAmount} added to your account.`, 
          read: false, 
          createdAt: serverTimestamp()
        });

        const userSnap = await getDoc(doc(db, "users", request.userId));
        const userData = userSnap.data();
        if (userData?.referredBy) {
          const referrerId = userData.referredBy;
          const commission = request.amount * 0.05; 
          const referrerRef = doc(db, "users", referrerId);
          batch.update(referrerRef, { referralEarnings: increment(commission) });
          batch.set(doc(collection(db, "referralTransactions")), {
            referrerId, 
            fromUserId: request.userId, 
            fromUserName: userData.displayName || 'User', 
            depositAmount: request.amount, 
            commissionAmount: commission, 
            createdAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      toast({ title: `Request ${action}`, description: action === 'Approved' ? `₹${validatedAmount} credited.` : undefined });
    } catch (e) {
      toast({ variant: "destructive", title: "Error processing" });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body text-slate-950">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <button onClick={() => router.push("/admin")} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm"><ChevronLeft size={24} /></button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">PAYMENT APPROVALS</h1>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Global Bonus: {globalBonus}%</p>
          </div>
        </header>

        <main className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-950">User</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-950">Requested</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-950">Final Credit (Edit Bonus)</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-950">UTR ID</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase text-slate-950">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="border-slate-50">
                  <TableCell className="font-black text-sm text-slate-950">{req.displayName}<br/><span className="text-[10px] text-slate-400">{req.userEmail}</span></TableCell>
                  <TableCell className="font-black text-slate-950">₹{req.amount}</TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      value={creditAmounts[req.id] || ""} 
                      onChange={(e) => setCreditAmounts({...creditAmounts, [req.id]: e.target.value})} 
                      className="h-10 w-24 bg-emerald-50 border-none rounded-xl font-black text-emerald-700" 
                    />
                  </TableCell>
                  <TableCell><code className="bg-slate-100 px-3 py-1 rounded-lg text-[11px] font-black text-slate-950">{req.utrId}</code></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => handleRequest(req, 'Approved')} disabled={processingId === req.id} className="bg-emerald-500 hover:bg-emerald-600 h-10 w-10 rounded-xl p-0 text-white shadow-lg"><Check size={18} /></Button>
                      <Button size="sm" variant="destructive" onClick={() => handleRequest(req, 'Rejected')} disabled={processingId === req.id} className="h-10 w-10 rounded-xl p-0 shadow-lg"><CloseIcon size={18} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-slate-400 font-black uppercase text-[10px] tracking-widest">No pending requests</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </main>
      </div>
    </div>
  );
}
