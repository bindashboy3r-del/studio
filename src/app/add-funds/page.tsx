
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Copy, 
  Download, 
  Wallet, 
  Info,
  Zap,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot, increment, writeBatch, getDoc, query, where, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { verifyPaytmTransaction } from "@/app/actions/paytm-automation";

export default function AddFundsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [globalBonus, setGlobalBonus] = useState(0);
  
  const [paymentConfig, setPaymentConfig] = useState({
    upiId: "smmxpressbot@slc",
    merchantName: "SocialBoost",
    qrImageUrl: "",
    paytmMid: "",
    paytmKey: ""
  });

  const numAmount = parseFloat(amount) || 0;
  const upiLink = `upi://pay?pa=${paymentConfig.upiId}&pn=${encodeURIComponent(paymentConfig.merchantName)}&am=${numAmount.toFixed(2)}&cu=INR`;
  const generatedQrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;
  const activeQrUrl = paymentConfig.qrImageUrl || generatedQrUrl;

  useEffect(() => {
    if (!db) return;
    
    onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setGlobalBonus(snap.data().bonusPercentage || 0);
    });

    onSnapshot(doc(db, "globalSettings", "payment"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPaymentConfig({
          upiId: data.upiId || "smmxpressbot@slc",
          merchantName: data.merchantName || "SocialBoost",
          qrImageUrl: data.qrImageUrl || "",
          paytmMid: data.paytmMid || "",
          paytmKey: data.paytmKey || ""
        });
      }
    });
  }, [db]);

  const handleSubmit = async () => {
    if (!user || !db || numAmount < 10 || utr.length !== 12) {
      toast({ variant: "destructive", title: "Invalid Data", description: "Minimum ₹10 and valid 12-digit UTR required." });
      return;
    }
    setLoading(true);
    
    try {
      // 1. Check for Duplicate UTR in Database
      const q = query(collection(db, "fundRequests"), where("utrId", "==", utr));
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast({ variant: "destructive", title: "Duplicate ID", description: "This UTR has already been used." });
        setLoading(false);
        return;
      }

      // 2. Call Automated Paytm Verification
      const verification = await verifyPaytmTransaction({
        utrId: utr,
        amount: numAmount,
        mid: paymentConfig.paytmMid,
        merchantKey: paymentConfig.paytmKey
      });

      if (!verification.success) {
        toast({ variant: "destructive", title: "Verification Failed", description: verification.message });
        setLoading(false);
        return;
      }

      // 3. Automation Success -> Credit Wallet Instantly
      const bonusAmount = (numAmount * globalBonus) / 100;
      const totalCredit = numAmount + bonusAmount;

      const batch = writeBatch(db);

      // Record the request as Approved (since automated)
      const reqRef = doc(collection(db, "fundRequests"));
      batch.set(reqRef, {
        userId: user.uid,
        userEmail: user.email,
        displayName: user.displayName,
        amount: numAmount,
        utrId: utr,
        status: 'Approved',
        finalCreditAmount: totalCredit,
        verifiedBy: 'Paytm Automation',
        createdAt: serverTimestamp(),
        processedAt: serverTimestamp()
      });

      // Update User Balance
      const userRef = doc(db, "users", user.uid);
      batch.update(userRef, {
        balance: increment(totalCredit)
      });

      // Send Notification
      const notifRef = doc(collection(db, "users", user.uid, "notifications"));
      batch.set(notifRef, {
        title: '💰 Instant Wallet Credit!',
        message: `Your payment of ₹${numAmount} was verified. ₹${totalCredit.toFixed(2)} added to wallet.`,
        read: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      
      toast({ title: "Success!", description: `₹${totalCredit.toFixed(2)} added to your wallet instantly!` });
      router.push("/chat");
    } catch (error) {
      toast({ variant: "destructive", title: "System Error", description: "Automation failed. Please contact admin." });
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
        <h1 className="text-sm font-black uppercase tracking-[0.2em]">Automated Top-up</h1>
        <div className="w-12" />
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 mt-4">
        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Zap size={28} className="fill-current" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Instant Verification</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Paytm Auto-Credit</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        {globalBonus > 0 && (
          <div className="bg-emerald-500 rounded-3xl p-5 text-white flex items-center justify-between shadow-lg animate-pulse">
            <div className="flex items-center gap-3">
              <Zap className="fill-current" size={20} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest">System Bonus</p>
                <h3 className="text-lg font-black uppercase">Get {globalBonus}% Extra!</h3>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">1. Enter Amount (Min ₹10)</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-14 bg-slate-50 border-none rounded-2xl pl-10 pr-5 text-lg font-black"
              />
            </div>
          </div>

          {numAmount >= 10 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">2. Scan & Pay Any App</label>
                <div className="bg-slate-50 rounded-3xl p-6 flex flex-col items-center gap-4 border border-slate-100">
                  <div className="bg-white p-3 rounded-[2rem] shadow-inner border border-slate-100">
                    <img src={activeQrUrl} alt="Payment QR" className="w-48 h-48 block rounded-xl" />
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-black text-slate-800">{paymentConfig.merchantName}</p>
                    <p className="text-[10px] font-bold text-slate-400">{paymentConfig.upiId}</p>
                  </div>
                  <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(paymentConfig.upiId);
                    toast({ title: "Copied!" });
                  }} className="w-full h-12 rounded-2xl border-slate-200 text-[#312ECB] font-black text-[10px] uppercase gap-2">
                    <Copy size={14} /> Copy UPI ID
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">3. Automated UTR Verification</label>
                <Input 
                  placeholder="Paste 12-Digit Transaction ID" 
                  value={utr}
                  maxLength={12}
                  onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-14 bg-slate-50 border-none rounded-2xl px-6 text-sm font-black tracking-[0.2em] shadow-inner"
                />
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl flex items-start gap-3 border border-blue-100/50">
                <CheckCircle2 size={16} className="text-emerald-500 mt-0.5" />
                <p className="text-[10px] font-bold text-blue-600 uppercase leading-relaxed">
                  Note: Balance will be added instantly after Paytm MID verification. No manual wait.
                </p>
              </div>

              <Button 
                onClick={handleSubmit}
                disabled={loading || utr.length !== 12}
                className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-[1.5rem] font-black text-[13px] uppercase tracking-widest shadow-2xl"
              >
                {loading ? <><Loader2 className="animate-spin mr-2" /> Verifying via Paytm...</> : "Verify & Credit Now"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
