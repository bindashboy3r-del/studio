
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Copy, 
  Download, 
  Wallet, 
  Info,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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

  const upiId = "smmxpressbot@slc";
  const numAmount = parseFloat(amount) || 0;
  
  const upiLink = `upi://pay?pa=${upiId}&pn=SocialBoost&am=${numAmount.toFixed(2)}&cu=INR`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) {
        setGlobalBonus(snap.data().bonusPercentage || 0);
      }
    });
    return () => unsub();
  }, [db]);

  const handleDownloadQR = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SocialBoost_Pay_${numAmount}.png`;
      a.click();
    } catch (e) {
      window.open(qrUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyUPI = () => {
    navigator.clipboard.writeText(upiId);
    toast({ title: "Copied!", description: "UPI ID copied to clipboard." });
  };

  const handleSubmit = async () => {
    if (!user || !db || numAmount < 10 || utr.length !== 12) return;
    setLoading(true);
    
    try {
      await addDoc(collection(db, "fundRequests"), {
        userId: user.uid,
        userEmail: user.email,
        displayName: user.displayName,
        amount: numAmount,
        utrId: utr,
        status: 'Pending',
        createdAt: serverTimestamp(),
      });
      
      toast({ 
        title: "Request Submitted!", 
        description: "Admin will verify your payment and update balance shortly." 
      });
      router.push("/chat");
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Submission failed." });
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
        <h1 className="text-sm font-black uppercase tracking-[0.2em]">Add Wallet Funds</h1>
        <div className="w-12" />
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 mt-4">
        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Wallet size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Balance Top-up</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Refill Wallet</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        {globalBonus > 0 && (
          <div className="bg-emerald-500 rounded-3xl p-5 text-white flex items-center justify-between shadow-lg shadow-emerald-500/20 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Zap className="fill-current" size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Limited Offer</p>
                <h3 className="text-lg font-black uppercase">Get {globalBonus}% Extra!</h3>
              </div>
            </div>
            <Badge className="bg-white text-emerald-600 font-black border-none">ACTIVE</Badge>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-50 space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Step 1: Enter Amount (Min ₹10)</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-14 bg-slate-50 border-none rounded-2xl pl-10 pr-5 text-lg font-black focus-visible:ring-1 focus-visible:ring-[#312ECB]/20"
              />
            </div>
            {globalBonus > 0 && numAmount >= 10 && (
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest ml-1">
                + Extra ₹{((numAmount * globalBonus) / 100).toFixed(0)} will be added to your wallet!
              </p>
            )}
          </div>

          {numAmount >= 10 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Step 2: Scan & Pay</label>
                <div className="bg-slate-50 rounded-3xl p-6 flex flex-col items-center gap-4 border border-slate-100">
                  <div className="bg-white p-3 rounded-[2rem] shadow-inner border border-slate-100">
                    <img src={qrUrl} alt="Payment QR" className="w-48 h-48 block rounded-xl" />
                  </div>
                  <div className="flex w-full gap-2">
                    <Button variant="outline" onClick={copyUPI} className="flex-1 h-12 rounded-2xl border-slate-200 text-[#312ECB] font-black text-[10px] uppercase gap-2">
                      <Copy size={14} /> Copy UPI ID
                    </Button>
                    <Button variant="outline" onClick={handleDownloadQR} disabled={isDownloading} className="flex-1 h-12 rounded-2xl border-slate-200 text-[#312ECB] font-black text-[10px] uppercase gap-2">
                      <Download size={14} /> Save QR
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Step 3: Submit 12-Digit UTR ID</label>
                <p className="text-[9px] font-bold text-red-500 uppercase tracking-tight ml-1 mb-1">
                  ⚠️ Yaha sahi 12-digit UTR ID bharein. Galat ID dalne par payment verify nahi hoga.
                </p>
                <Input 
                  placeholder="Enter Transaction ID" 
                  value={utr}
                  maxLength={12}
                  onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-14 bg-slate-50 border-none rounded-2xl px-6 text-sm font-black tracking-[0.2em] focus-visible:ring-1 focus-visible:ring-[#312ECB]/20 shadow-inner"
                />
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl flex items-start gap-3 border border-blue-100/50">
                <Info size={16} className="text-[#312ECB] mt-0.5" />
                <p className="text-[10px] font-bold text-blue-600 uppercase leading-relaxed">
                  Note: Funds are credited after verification. Check order status in history.
                </p>
              </div>

              <Button 
                onClick={handleSubmit}
                disabled={loading || utr.length !== 12}
                className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-[1.5rem] font-black text-[13px] uppercase tracking-widest shadow-2xl transition-all active:scale-95"
              >
                {loading ? "Processing..." : "Submit Payment Request"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
