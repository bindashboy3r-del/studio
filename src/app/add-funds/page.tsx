
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
    // Load Finance Settings (Bonus)
    const unsubFinance = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setGlobalBonus(snap.data().bonusPercentage || 0);
    });
    // Load Payment Hub Config (UPI ID / Merchant)
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
  
  // Logic for QR Generation
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
      router.push('/orders'); // Redirect to history
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
    <div className="min-h-screen bg-[#F0F2F5] font-body text-[#111B21] pb-20">
      <header className="bg-white px-6 py-5 flex items-center justify-between border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[#312ECB] font-black uppercase text-xs tracking-widest">
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="text-sm font-black uppercase tracking-[0.2em]">Add Funds</h1>
        <div className="w-12" />
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 mt-4">
        {/* Hero Card */}
        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <QrCode size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Manual Refill</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Scan & Pay</h2>
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

        {/* Payment QR Section */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 flex flex-col items-center space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Step 1: Pay via QR</h3>
            <p className="text-[11px] font-bold text-slate-800 uppercase">Merchant: {merchantName}</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 shadow-inner relative group">
            <img 
              src={finalQrUrl} 
              alt="Payment QR" 
              className="w-48 h-44 object-contain rounded-xl"
            />
          </div>

          <button 
            onClick={copyUpi}
            className="flex items-center gap-3 px-6 py-3 bg-slate-50 rounded-full border border-slate-100 hover:bg-slate-100 transition-colors group"
          >
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{upiId}</span>
            <Copy size={14} className="text-[#312ECB] group-active:scale-90 transition-transform" />
          </button>
        </div>

        {/* UTR Form Section */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 space-y-6">
          <div className="text-center">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Step 2: Submit Details</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Payment Amount (₹)</label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-14 bg-slate-50 border-none rounded-2xl px-6 text-lg font-black focus-visible:ring-2 focus-visible:ring-[#312ECB]/10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">12-Digit UTR ID</label>
              <Input 
                type="text" 
                placeholder="Enter Transaction ID" 
                value={utrId}
                maxLength={12}
                onChange={(e) => setUtrId(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-14 bg-slate-50 border-none rounded-2xl px-6 text-lg font-black tracking-widest focus-visible:ring-2 focus-visible:ring-[#312ECB]/10"
              />
            </div>
          </div>

          <div className="bg-blue-50/50 p-4 rounded-2xl flex items-start gap-3 border border-blue-100/50">
            <ShieldCheck size={16} className="text-[#312ECB] mt-0.5" />
            <p className="text-[10px] font-bold text-blue-600 uppercase leading-relaxed">
              Money will be verified and credited within 1 hour. Do not submit fake UTR IDs.
            </p>
          </div>

          <Button 
            onClick={handleManualSubmit}
            disabled={loading || !amount || utrId.length !== 12}
            className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-[1.5rem] font-black text-[13px] uppercase tracking-widest shadow-2xl gap-3 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Verify Payment Now"}
            <CheckCircle2 size={18} />
          </Button>
        </div>

        <button 
          onClick={() => router.push('/orders')}
          className="w-full bg-white rounded-2xl p-5 flex items-center justify-between border border-gray-100 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <History className="text-slate-400" size={20} />
            <span className="text-[11px] font-black uppercase tracking-widest">Request History</span>
          </div>
          <ChevronRight className="text-slate-300" size={18} />
        </button>
      </main>
    </div>
  );
}
