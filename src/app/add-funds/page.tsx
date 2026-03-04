
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Wallet, 
  Zap,
  Loader2,
  AlertCircle,
  CreditCard,
  History,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { initiateUropayPayment } from "@/app/actions/uropay";

export default function AddFundsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [globalBonus, setGlobalBonus] = useState(0);
  const [activeTab, setActiveTab] = useState<'automated' | 'manual'>('automated');

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setGlobalBonus(snap.data().bonusPercentage || 0);
    });
    return () => unsub();
  }, [db]);

  const handleAutomatedPay = async () => {
    if (!user || !db || !amount || parseFloat(amount) < 10) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Minimum ₹10 is required." });
      return;
    }

    setLoading(true);
    try {
      // 1. Get Payment URL from Server
      const result = await initiateUropayPayment({
        amount: parseFloat(amount),
        userId: user.uid
      });

      if (result.success && result.paymentUrl && result.orderId) {
        // 2. Create Pending Request Record on Client (where auth is present)
        await addDoc(collection(db, "fundRequests"), {
          userId: user.uid,
          userEmail: user.email || '',
          displayName: user.displayName || 'User',
          amount: parseFloat(amount),
          utrId: result.orderId, // We use UroPay's client_txn_id as the tracking UTR
          status: 'Pending',
          type: 'Automated',
          createdAt: serverTimestamp()
        });

        // 3. Redirect to Gateway
        window.location.href = result.paymentUrl;
      } else {
        throw new Error(result.error || 'Failed to initialize gateway');
      }
    } catch (error: any) {
      console.error("Payment Init Error:", error);
      toast({ 
        variant: "destructive", 
        title: "Gateway Error", 
        description: error.message || "Try again later." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-body text-[#111B21] pb-20">
      <header className="bg-white px-6 py-5 flex items-center justify-between border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[#312ECB] font-black uppercase text-xs tracking-widest">
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="text-sm font-black uppercase tracking-[0.2em]">Add Funds</h1>
        <div className="w-12" />
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 mt-4">
        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <CreditCard size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Automated System</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Refill Wallet</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        {globalBonus > 0 && (
          <div className="bg-emerald-500 rounded-3xl p-5 text-white flex items-center justify-between shadow-lg animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3">
              <Zap className="fill-current animate-pulse" size={20} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Deposit Offer</p>
                <h3 className="text-lg font-black uppercase">Get {globalBonus}% Bonus!</h3>
              </div>
            </div>
          </div>
        )}

        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
          <button 
            onClick={() => setActiveTab('automated')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'automated' ? 'bg-[#312ECB] text-white shadow-lg' : 'text-slate-400'}`}
          >
            Instant (UPI)
          </button>
          <button 
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'manual' ? 'bg-[#312ECB] text-white shadow-lg' : 'text-slate-400'}`}
          >
            Manual (UTR)
          </button>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 space-y-8">
          {activeTab === 'automated' ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Enter Amount (Min ₹10)</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-14 bg-slate-50 border-none rounded-2xl pl-10 pr-5 text-lg font-black focus-visible:ring-2 focus-visible:ring-[#312ECB]/10"
                  />
                </div>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl flex items-start gap-3 border border-blue-100/50">
                <ShieldCheck size={16} className="text-[#312ECB] mt-0.5" />
                <p className="text-[10px] font-bold text-blue-600 uppercase leading-relaxed">
                  Money will be credited instantly after successful payment via UroPay UPI Gateway.
                </p>
              </div>

              <Button 
                onClick={handleAutomatedPay}
                disabled={loading || !amount || parseFloat(amount) < 10}
                className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-[1.5rem] font-black text-[13px] uppercase tracking-widest shadow-2xl gap-3 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Pay with UPI Now"}
                <ChevronRight size={18} />
              </Button>
            </div>
          ) : (
            <div className="space-y-6 text-center py-4">
              <AlertCircle size={40} className="mx-auto text-amber-500 mb-2" />
              <h3 className="text-sm font-black uppercase">Manual System Backup</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase leading-relaxed">
                If the automated system is slow, please contact admin on WhatsApp for manual refill instructions.
              </p>
              <Button 
                variant="outline"
                onClick={() => window.open('https://wa.me/919116399517', '_blank')}
                className="w-full h-14 border-slate-200 text-[#312ECB] rounded-2xl font-black uppercase text-[11px] tracking-widest"
              >
                WhatsApp Admin
              </Button>
            </div>
          )}
        </div>

        <button 
          onClick={() => router.push('/orders')}
          className="w-full bg-white rounded-2xl p-5 flex items-center justify-between border border-gray-100 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <History className="text-slate-400" size={20} />
            <span className="text-[11px] font-black uppercase tracking-widest">Transaction History</span>
          </div>
          <ChevronRight className="text-slate-300" size={18} />
        </button>
      </main>
    </div>
  );
}
