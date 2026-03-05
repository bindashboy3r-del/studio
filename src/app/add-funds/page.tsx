
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Wallet, 
  Zap,
  Loader2,
  AlertCircle,
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
    if (!db || !user) return; // Fixed: Wait for user to prevent permission errors
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
  }, [db, user]);

  const upiId = paymentConfig?.upiId || "smmxpressbot@slc";
  const merchantName = paymentConfig?.merchantName || "SocialBoost";
  const customQrUrl = paymentConfig?.qrImageUrl;
  
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&cu=INR`;
  const generatedQr = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;
  const finalQrUrl = customQrUrl || generatedQr;

  const handleManualSubmit = async () => {
    if (!user || !db || !amount || !utrId) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Amount & UTR required." });
      return;
    }

    if (utrId.length !== 12) {
      toast({ variant: "destructive", title: "Invalid UTR", description: "UTR must be 12 digits." });
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
        description: "Wallet will be credited in 30-60 mins." 
      });
      router.push('/orders');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: "Try again later." });
    } finally {
      setLoading(false);
    }
  };

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    toast({ title: "Copied!", description: "UPI ID copied." });
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-body text-[#111B21] pb-10">
      <header className="bg-white px-4 py-2.5 flex items-center justify-between border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[9px] tracking-widest">
          <ChevronLeft size={14} /> Back
        </button>
        <h1 className="text-[9px] font-black uppercase tracking-[0.2em]">Add Funds</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-3 space-y-2.5 mt-1">
        <div className="bg-[#312ECB] rounded-[1.2rem] p-4 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <QrCode size={16} />
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.3em] text-white/60">Wallet Refill</p>
              <h2 className="text-[15px] font-black uppercase tracking-tight">Scan & Pay</h2>
            </div>
          </div>
        </div>

        {globalBonus > 0 && (
          <div className="bg-emerald-500 rounded-lg p-2 text-white flex items-center gap-2 shadow-md">
            <Zap className="fill-current animate-pulse" size={12} />
            <p className="text-[9px] font-black uppercase">Get {globalBonus}% Extra Bonus!</p>
          </div>
        )}

        <div className="bg-white rounded-[1.2rem] p-4 shadow-sm border border-gray-50 flex flex-col items-center space-y-2.5">
          <div className="text-center">
            <h3 className="text-[8px] font-black uppercase tracking-widest text-slate-400">Step 1: Pay via QR</h3>
            <p className="text-[8px] font-bold text-slate-800 uppercase mt-0.5">{merchantName}</p>
          </div>

          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 shadow-inner">
            <img 
              src={finalQrUrl} 
              alt="Payment QR" 
              className="w-28 h-28 object-contain rounded-md"
            />
          </div>

          <button 
            onClick={copyUpi}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-full border border-slate-100"
          >
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{upiId}</span>
            <Copy size={8} className="text-[#312ECB]" />
          </button>
        </div>

        <div className="bg-white rounded-[1.2rem] p-4 shadow-sm border border-gray-50 space-y-3">
          <div className="text-center">
            <h3 className="text-[8px] font-black uppercase tracking-widest text-slate-400">Step 2: Submit Details</h3>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-1">
              <label className="text-[7px] font-black uppercase text-slate-400 tracking-widest ml-1">Amount (₹)</label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 bg-slate-50 border-none rounded-lg px-3 text-xs font-black"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-red-500 tracking-tight ml-1 leading-none">
                Shi utr dalo varna payment verify nhi hoga
              </label>
              <Input 
                type="text" 
                placeholder="Enter 12-Digit UTR ID" 
                value={utrId}
                maxLength={12}
                onChange={(e) => setUtrId(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-10 bg-slate-50 border-none rounded-lg px-3 text-xs font-black tracking-widest"
              />
            </div>
          </div>

          <Button 
            onClick={handleManualSubmit}
            disabled={loading || !amount || utrId.length !== 12}
            className="w-full h-11 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-lg font-black text-[9px] uppercase tracking-widest shadow-md gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={12} /> : "Submit Request"}
            <CheckCircle2 size={12} />
          </Button>
        </div>

        <button 
          onClick={() => router.push('/orders')}
          className="w-full bg-white rounded-lg p-2.5 flex items-center justify-between border border-gray-100"
        >
          <div className="flex items-center gap-2">
            <History className="text-slate-400" size={14} />
            <span className="text-[8px] font-black uppercase tracking-widest">History</span>
          </div>
          <ChevronRight className="text-slate-300" size={12} />
        </button>
      </main>
    </div>
  );
}
