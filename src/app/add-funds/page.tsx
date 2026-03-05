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
  ChevronRight,
  QrCode,
  Copy,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function AddFundsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [utrId, setUtrId] = useState("");
  const [loading, setLoading] = useState(false);
  const [globalBonus, setGlobalBonus] = useState(0);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);

  useEffect(() => {
    if (!db) return;
    const unsubFinance = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setGlobalBonus(snap.data().bonusPercentage || 0);
    });
    const unsubPayment = onSnapshot(doc(db, "globalSettings", "payment"), (snap) => {
      if (snap.exists()) setPaymentConfig(snap.data());
    });
    return () => {
      unsubFinance();
      unsubPayment();
    };
  }, [db]);

  const upiId = paymentConfig?.upiId || "smmxpressbot@slc";
  const merchantName = paymentConfig?.merchantName || "SocialBoost";
  const customQrUrl = paymentConfig?.qrImageUrl;
  
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&cu=INR`;
  const generatedQr = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;
  const finalQrUrl = customQrUrl || generatedQr;

  const handleManualSubmit = async () => {
    if (!user || !db || !amount || !utrId) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please enter both amount and UTR ID." });
      return;
    }

    if (utrId.length !== 12) {
      toast({ variant: "destructive", title: "Invalid UTR", description: "UTR ID must be exactly 12 digits." });
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "fundRequests"), {
        userId: user.uid,
        userEmail: user.email || '',
        displayName: user.displayName || 'User',
        amount: parseFloat(amount),
        utrId: utrId.trim(),
        status: 'Pending',
        type: 'Manual',
        createdAt: serverTimestamp()
      });

      toast({ 
        title: "Request Submitted!", 
        description: "Admin will verify and credit your wallet within 30-60 mins." 
      });
      router.push('/orders');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: "Try again later." });
    } finally {
      setLoading(false);
    }
  };

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    toast({ title: "Copied!", description: "UPI ID copied to clipboard." });
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-body text-[#111B21] pb-10">
      <header className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[#312ECB] font-black uppercase text-[10px] tracking-widest">
          <ChevronLeft size={18} /> Back
        </button>
        <h1 className="text-[11px] font-black uppercase tracking-[0.2em]">Add Funds</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4 mt-2">
        <div className="bg-[#312ECB] rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <QrCode size={24} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/60">Refill Wallet</p>
              <h2 className="text-xl font-black uppercase tracking-tight">Scan & Pay</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 blur-2xl" />
        </div>

        {globalBonus > 0 && (
          <div className="bg-emerald-500 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Zap className="fill-current animate-pulse" size={18} />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-100">Deposit Offer</p>
                <h3 className="text-base font-black uppercase">Get {globalBonus}% Bonus!</h3>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[2rem] p-6 shadow-lg border border-gray-50 flex flex-col items-center space-y-4">
          <div className="text-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step 1: Pay via QR</h3>
            <p className="text-[10px] font-bold text-slate-800 uppercase mt-1">Merchant: {merchantName}</p>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-inner">
            <img 
              src={finalQrUrl} 
              alt="Payment QR" 
              className="w-40 h-40 object-contain rounded-lg"
            />
          </div>

          <button 
            onClick={copyUpi}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-full border border-slate-100 hover:bg-slate-100 transition-colors group"
          >
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{upiId}</span>
            <Copy size={12} className="text-[#312ECB] transition-transform" />
          </button>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-lg border border-gray-50 space-y-5">
          <div className="text-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step 2: Submit Details</h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Amount (₹)</label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 bg-slate-50 border-none rounded-xl px-5 text-base font-black focus-visible:ring-2 focus-visible:ring-[#312ECB]/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-red-500 tracking-widest ml-1 leading-tight">
                Shi utr dalo varna payment verify nhi hoga
              </label>
              <Input 
                type="text" 
                placeholder="Enter 12-Digit UTR ID" 
                value={utrId}
                maxLength={12}
                onChange={(e) => setUtrId(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-12 bg-slate-50 border-none rounded-xl px-5 text-base font-black tracking-widest focus-visible:ring-2 focus-visible:ring-[#312ECB]/10"
              />
            </div>
          </div>

          <div className="bg-blue-50/50 p-3 rounded-xl flex items-start gap-2 border border-blue-100/50">
            <ShieldCheck size={14} className="text-[#312ECB] mt-0.5" />
            <p className="text-[9px] font-bold text-blue-600 uppercase leading-relaxed">
              Verified within 1 hour. Fake UTR will lead to account ban.
            </p>
          </div>

          <Button 
            onClick={handleManualSubmit}
            disabled={loading || !amount || utrId.length !== 12}
            className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl gap-2 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : "Submit Request"}
            <CheckCircle2 size={16} />
          </Button>
        </div>

        <button 
          onClick={() => router.push('/orders')}
          className="w-full bg-white rounded-xl p-4 flex items-center justify-between border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <History className="text-slate-400" size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">History</span>
          </div>
          <ChevronRight className="text-slate-300" size={16} />
        </button>
      </main>
    </div>
  );
}
