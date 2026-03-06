
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
  orderBy
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
import { ChevronLeft, RefreshCw, Check, X as CloseIcon, Gift, TrendingUp } from "lucide-react";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AdminReferralPage() {
  const { user: admin, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const isActuallyAdmin = admin?.email === ADMIN_EMAIL || admin?.uid === "s55uL0f8PmcypR75usVYOLwVs7O2";

  useEffect(() => {
    if (!isUserLoading && (!admin || !isActuallyAdmin)) router.push("/admin/login");
  }, [admin, isUserLoading, isActuallyAdmin, router]);

  const withdrawalsQuery = useMemoFirebase(() => {
    if (!db || !isActuallyAdmin) return null;
    return query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
  }, [db, isActuallyAdmin]);
  const { data: withdrawals, isLoading } = useCollection(withdrawalsQuery);

  const handleWithdrawalAction = async (w: any, action: 'Approved' | 'Rejected') => {
    if (!db || !isActuallyAdmin) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "withdrawals", w.id), { status: action, processedAt: serverTimestamp() });
      
      if (action === 'Rejected') {
        batch.update(doc(db, "users", w.userId), { referralEarnings: increment(w.amount) });
      }

      batch.set(doc(collection(db, "users", w.userId, "notifications")), {
        title: action === 'Approved' ? '✅ Payout Successful!' : '❌ Payout Rejected',
        message: action === 'Approved' ? `₹${w.amount} sent to your UPI.` : `₹${w.amount} returned to your referral balance.`,
        read: false, createdAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: `Payout ${action}` });
    } catch (e) { toast({ variant: "destructive", title: "Error" }); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-[#312ECB]" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body text-slate-950">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin")} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm"><ChevronLeft size={24} /></button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">REFERRAL MANAGER</h1>
              <p className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">Verify Payouts & Commission Logs</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 flex items-center gap-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner"><TrendingUp size={32} /></div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active System</p>
              <h2 className="text-xl font-black text-slate-950">5% Commission Active</h2>
            </div>
          </div>
          <div className="bg-[#312ECB] rounded-[2.5rem] p-8 shadow-xl text-white flex items-center gap-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-white/10 text-white flex items-center justify-center border border-white/20"><Gift size={32} /></div>
            <div>
              <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">Global Rewards</p>
              <h2 className="text-xl font-black uppercase tracking-tight">Referral Network</h2>
            </div>
          </div>
        </div>

        <main className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50"><h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Withdrawal Requests</h3></div>
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100">
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">User</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">Amount</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">Method</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">Details</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-6 text-slate-600">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase py-6 text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals?.map((w: any) => (
                <TableRow key={w.id} className="border-slate-50">
                  <TableCell className="font-black text-slate-950 text-sm">{w.displayName || 'User'}</TableCell>
                  <TableCell className="font-black text-emerald-600">₹{w.amount}</TableCell>
                  <TableCell><Badge className="bg-blue-50 text-blue-600 border-none text-[8px] font-black uppercase">{w.type}</Badge></TableCell>
                  <TableCell className="font-bold text-slate-500 text-xs">{w.upiId || 'N/A'}</TableCell>
                  <TableCell><Badge className={cn("text-[8px] font-black uppercase", w.status === 'Pending' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600')}>{w.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {w.status === 'Pending' && w.type === 'UPI' ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => handleWithdrawalAction(w, 'Approved')} className="bg-emerald-500 h-9 w-9 rounded-xl p-0 text-white shadow-md"><Check size={16} /></Button>
                        <Button size="sm" variant="destructive" onClick={() => handleWithdrawalAction(w, 'Rejected')} className="h-9 w-9 rounded-xl p-0 shadow-md"><CloseIcon size={16} /></Button>
                      </div>
                    ) : <span className="text-[9px] font-black text-slate-300 uppercase">No Action</span>}
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
