
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Gift, 
  Copy, 
  Share2, 
  ArrowRightLeft, 
  Banknote,
  Loader2,
  TrendingUp,
  Info,
  Instagram,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { doc, collection, addDoc, serverTimestamp, writeBatch, increment } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ReferPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawType, setWithdrawType] = useState<'UPI' | 'Wallet'>('Wallet');
  const [upiId, setUpiId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const userRef = useMemoFirebase(() => user && db ? doc(db, "users", user.uid) : null, [db, user]);
  const { data: userData } = useDoc(userRef);

  const referralCode = userData?.referralCode || "SOCIAL";
  const referralLink = `${baseUrl || 'https://socialboost.pro'}?ref=${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Copied!", description: "Unique referral link copied." });
  };

  const shareOnWhatsApp = () => {
    const msg = `🚀 *Grow your social media!* Join SocialBoost for instant followers and likes. Use my link: ${referralLink}`;
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
        toast({ title: "Payout Request Sent!" });
      }
      setWithdrawAmount(""); setUpiId("");
    } catch (e) { toast({ variant: "destructive", title: "Withdrawal Failed" }); }
    finally { setIsWithdrawing(false); }
  };

  if (isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-[#030712]"><Loader2 className="animate-spin text-[#312ECB]" /></div>;

  return (
    <div className="min-h-screen bg-[#030712] font-body pb-20 text-slate-100">
      <header className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-white/5 sticky top-0 z-50">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[10px] tracking-widest">
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Refer & Earn</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 mt-2">
        <div className="bg-[#312ECB] rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20"><Gift size={20} /></div>
              <div>
                <p className="text-[9px] font-black uppercase text-white/60 tracking-widest">Passive Income</p>
                <h2 className="text-xl font-black uppercase">5% Commission</h2>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10 flex justify-between items-end">
              <div>
                <p className="text-[8px] font-black text-white/50 uppercase mb-1">Available Earnings</p>
                <p className="text-2xl font-black italic">₹{(userData?.referralEarnings || 0).toFixed(2)}</p>
              </div>
              <TrendingUp className="text-emerald-400 mb-1" />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[1.5rem] p-5 border border-white/5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-[#312ECB]" />
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Your Unique Link</h3>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-950 p-3 rounded-xl border border-white/5 font-bold text-[9px] text-slate-400 truncate">{referralLink}</div>
            <button onClick={handleCopyLink} className="h-10 w-10 rounded-xl bg-[#312ECB] text-white shadow-md flex items-center justify-center shrink-0 active:scale-90 transition-transform">
              <Copy size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={shareOnWhatsApp} className="h-10 bg-[#25D366] rounded-xl font-black text-[8px] uppercase gap-2">
              <MessageCircle size={14} /> WhatsApp
            </Button>
            <Button onClick={handleCopyLink} className="h-10 bg-[#E1306C] rounded-xl font-black text-[8px] uppercase gap-2">
              <Instagram size={14} /> Instagram
            </Button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[1.5rem] p-5 border border-white/5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1"><Banknote className="text-emerald-500" size={16} /><h3 className="text-[10px] font-black text-white uppercase tracking-widest">Withdraw</h3></div>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
            <button onClick={() => setWithdrawType('Wallet')} className={cn("flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all", withdrawType === 'Wallet' ? "bg-slate-800 shadow-sm text-white" : "text-slate-500")}>Wallet</button>
            <button onClick={() => setWithdrawType('UPI')} className={cn("flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all", withdrawType === 'UPI' ? "bg-slate-800 shadow-sm text-white" : "text-slate-500")}>UPI App</button>
          </div>
          <div className="space-y-3">
            <Input type="number" placeholder="Amount (Min ₹10)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="h-10 bg-slate-950 border-none rounded-xl px-4 font-black text-xs text-white" />
            {withdrawType === 'UPI' && (
              <Input placeholder="Your UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)} className="h-10 bg-slate-950 border-none rounded-xl px-4 font-black text-xs text-white" />
            )}
            <Button onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount} className="w-full h-12 bg-[#312ECB] text-white rounded-xl font-black text-[9px] uppercase shadow-lg gap-2 active:scale-95 transition-all">
              {isWithdrawing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />} 
              Submit Request
            </Button>
          </div>
        </div>

        <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex items-start gap-3">
          <Info className="text-blue-400 shrink-0" size={16} />
          <p className="text-[9px] font-bold text-blue-300 leading-relaxed uppercase">
            Commission is added when referred friends add funds.
          </p>
        </div>
      </main>
    </div>
  );
}
