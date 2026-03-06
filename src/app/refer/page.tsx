
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Gift, 
  Users, 
  Wallet, 
  Copy, 
  Share2, 
  ArrowRightLeft, 
  Banknote,
  Loader2,
  TrendingUp,
  Info,
  Instagram,
  Facebook,
  Youtube,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { doc, collection, addDoc, serverTimestamp, query, where, writeBatch, increment } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function ReferPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawType, setWithdrawType] = useState<'UPI' | 'Wallet'>('Wallet');
  const [upiId, setUpiId] = useState("");

  const userRef = useMemoFirebase(() => user && db ? doc(db, "users", user.uid) : null, [db, user]);
  const { data: userData } = useDoc(userRef);

  const statsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "referralTransactions"), where("referrerId", "==", user.uid));
  }, [db, user]);
  const { data: transactions } = useCollection(statsQuery);

  const referralCode = userData?.referralCode || "SOCIAL";
  // Generate unique link based on current domain
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://socialboost.pro';
  const referralLink = `${baseUrl}?ref=${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Copied!", description: "Unique referral link copied." });
  };

  const shareOnWhatsApp = () => {
    const msg = `🚀 *Hey! Build your social media with SocialBoost.* Get followers, likes & views instantly. Use my unique link to join and get bonuses: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleWithdraw = async () => {
    if (!user || !db || !userData) return;
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 10) { toast({ variant: "destructive", title: "Min ₹10 required" }); return; }
    if (amt > (userData.referralEarnings || 0)) { toast({ variant: "destructive", title: "Insufficient Balance" }); return; }
    if (withdrawType === 'UPI' && !upiId) { toast({ variant: "destructive", title: "UPI ID Required" }); return; }

    setIsWithdrawing(true);
    try {
      if (withdrawType === 'Wallet') {
        const batch = writeBatch(db);
        batch.update(doc(db, "users", user.uid), {
          referralEarnings: increment(-amt),
          balance: increment(amt)
        });
        batch.set(doc(collection(db, "withdrawals")), {
          userId: user.uid, amount: amt, type: 'Wallet', status: 'Approved', createdAt: serverTimestamp(), displayName: user.displayName || user.email
        });
        await batch.commit();
        toast({ title: "Transferred to Wallet!" });
      } else {
        await addDoc(collection(db, "withdrawals"), {
          userId: user.uid, amount: amt, type: 'UPI', upiId, status: 'Pending', createdAt: serverTimestamp(), displayName: user.displayName || user.email
        });
        const batch = writeBatch(db);
        batch.update(doc(db, "users", user.uid), { referralEarnings: increment(-amt) });
        await batch.commit();
        toast({ title: "Payout Request Sent!", description: "Admin will verify and pay soon." });
      }
      setWithdrawAmount(""); setUpiId("");
    } catch (e) { toast({ variant: "destructive", title: "Withdrawal Failed" }); }
    finally { setIsWithdrawing(false); }
  };

  if (isUserLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#312ECB]" /></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-body pb-20">
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[10px] tracking-widest">
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#111B21]">Refer & Earn</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 mt-2">
        {/* Earnings Card */}
        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20"><Gift size={24} /></div>
              <div>
                <p className="text-[10px] font-black uppercase text-white/60 tracking-widest">Passive Income</p>
                <h2 className="text-2xl font-black uppercase">5% Daily Rewards</h2>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10 flex justify-between items-end">
              <div>
                <p className="text-[9px] font-black text-white/50 uppercase mb-1">Referral Earnings</p>
                <p className="text-3xl font-black italic">₹{(userData?.referralEarnings || 0).toFixed(2)}</p>
              </div>
              <TrendingUp className="text-emerald-400 mb-1" />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        {/* Unique Link & Sharing */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-[#312ECB]" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Your Unique Link</h3>
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold text-[10px] text-slate-500 truncate select-all">{referralLink}</div>
              <Button onClick={handleCopyLink} size="icon" className="h-12 w-12 rounded-2xl bg-[#312ECB] shadow-md shrink-0 active:scale-90 transition-transform">
                <Copy size={18} />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={shareOnWhatsApp} className="h-12 bg-[#25D366] rounded-2xl font-black text-[9px] uppercase gap-2 shadow-lg hover:bg-[#1EBE57]">
                <MessageCircle size={16} /> WhatsApp
              </Button>
              <Button onClick={handleCopyLink} className="h-12 bg-[#E1306C] rounded-2xl font-black text-[9px] uppercase gap-2 shadow-lg hover:opacity-90">
                <Instagram size={16} /> Instagram
              </Button>
            </div>
            <p className="text-center text-[8px] font-bold text-slate-400 uppercase">Share this link everywhere to track your referrals!</p>
          </div>
        </div>

        {/* Withdrawal Section */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-2 mb-2"><Banknote className="text-emerald-500" size={18} /><h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Withdraw Earnings</h3></div>
          
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
            <button onClick={() => setWithdrawType('Wallet')} className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all", withdrawType === 'Wallet' ? "bg-white shadow-sm text-[#312ECB]" : "text-slate-400")}>To SMM Wallet</button>
            <button onClick={() => setWithdrawType('UPI')} className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all", withdrawType === 'UPI' ? "bg-white shadow-sm text-[#312ECB]" : "text-slate-400")}>To UPI App</button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Withdraw Amount (Min ₹10)</label>
              <Input type="number" placeholder="Enter Amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 font-black text-sm text-[#111B21]" />
            </div>
            {withdrawType === 'UPI' && (
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Your UPI ID</label>
                <Input placeholder="e.g. user@paytm" value={upiId} onChange={(e) => setUpiId(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 font-black text-sm text-[#111B21]" />
              </div>
            )}
            <Button onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount} className="w-full h-14 bg-[#312ECB] text-white rounded-2xl font-black text-[10px] uppercase shadow-lg gap-2 active:scale-95 transition-all">
              {isWithdrawing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />} 
              {withdrawType === 'Wallet' ? "Transfer to Wallet" : "Request UPI Payout"}
            </Button>
          </div>
        </div>

        {/* Logs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2"><Info className="text-[#312ECB]" size={14} /><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Commissions</h3></div>
          <div className="space-y-3">
            {transactions && transactions.length > 0 ? transactions.map((t: any) => (
              <div key={t.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div><p className="text-[11px] font-black text-slate-900 uppercase">From {t.fromUserName || 'Referred User'}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Deposit: ₹{t.depositAmount}</p></div>
                <Badge className="bg-emerald-50 text-emerald-600 border-none text-[10px] font-black tracking-tight">+₹{t.commissionAmount.toFixed(2)}</Badge>
              </div>
            )) : <div className="text-center py-10 text-slate-300 text-[9px] font-black uppercase tracking-widest">No earnings yet. Start sharing!</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
