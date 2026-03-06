
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Zap,
  Loader2,
  QrCode,
  Copy,
  CheckCircle2,
  MessageCircle,
  Download,
  Send,
  Gift,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function AddFundsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [utrId, setUtrId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [globalBonus, setGlobalBonus] = useState(0);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");

  useEffect(() => {
    if (!db || !user) return;
    const unsubFinance = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setGlobalBonus(snap.data().bonusPercentage || 0);
    });
    const unsubPayment = onSnapshot(doc(db, "globalSettings", "payment"), (snap) => {
      if (snap.exists()) setPaymentConfig(snap.data());
    });
    return () => { unsubFinance(); unsubPayment(); };
  }, [db, user]);

  if (isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]"><Loader2 className="animate-spin text-[#312ECB]" /></div>;

  const upiId = paymentConfig?.upiId || "smmxpressbot@slc";
  const merchantName = paymentConfig?.merchantName || "SocialBoost";
  const finalQrUrl = paymentConfig?.qrImageUrl || `https://quickchart.io/qr?text=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&cu=INR`)}&size=400&margin=1&format=png`;

  const handleDownloadQR = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(finalQrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SocialBoost_QR.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "QR Saved!" });
    } catch (e) { window.open(finalQrUrl, '_blank'); } 
    finally { setIsDownloading(false); }
  };

  const handleManualSubmit = async () => {
    if (!user || !db || !amount || !utrId) { toast({ variant: "destructive", title: "Missing Fields" }); return; }
    const amtNum = parseFloat(amount);
    if (amtNum < 5) { toast({ variant: "destructive", title: "Amount Too Low", description: "Min ₹5 required." }); return; }
    if (utrId.length !== 12) { toast({ variant: "destructive", title: "Invalid UTR", description: "UTR must be 12 digits." }); return; }

    setLoading(true);
    const payload = { 
      userId: user.uid, 
      userEmail: user.email || '', 
      displayName: user.displayName || 'User', 
      amount: amtNum, 
      utrId: utrId.trim(), 
      status: 'Pending', 
      type: 'Manual', 
      createdAt: serverTimestamp() 
    };

    addDoc(collection(db, "fundRequests"), payload)
      .then(() => {
        setWhatsappMsg(`🚀 *NEW PAYMENT SUBMITTED!*\n\n👤 *User:* ${user.displayName || user.email}\n🔢 *UTR ID:* ${utrId.trim()}\n💰 *Amount:* ₹${amount}\n\nKripya verify karein.`);
        setShowConfirmPopup(true);
        setAmount(""); setUtrId("");
      })
      .catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'fundRequests', operation: 'create', requestResourceData: payload }));
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-body text-[#111B21] pb-20">
      <header className="bg-white px-4 py-2.5 flex items-center justify-between border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[9px] tracking-widest">
          <ChevronLeft size={14} /> Back
        </button>
        <h1 className="text-[9px] font-black uppercase tracking-[0.2em]">Add Funds</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-3 space-y-2.5 mt-1">
        <div onClick={() => router.push('/refer')} className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[1.2rem] p-4 text-white shadow-lg flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20"><Gift size={16} /></div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.3em] text-white/60">Referral Program</p>
              <h2 className="text-[13px] font-black uppercase tracking-tight">Refer & Earn 5% Daily</h2>
            </div>
          </div>
          <ArrowRight size={16} />
        </div>

        {globalBonus > 0 && (
          <div className="bg-emerald-500 rounded-lg p-2 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <Zap className="fill-current animate-pulse" size={12} />
              <p className="text-[9px] font-black uppercase">Offer: Get {globalBonus}% Bonus!</p>
            </div>
            <Badge className="bg-white text-emerald-600 border-none text-[8px] font-black px-2">ACTIVE</Badge>
          </div>
        )}

        <div className="bg-white rounded-[1.2rem] p-4 shadow-sm border border-gray-50 flex flex-col items-center space-y-3">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <img src={finalQrUrl} alt="Payment QR" className="w-32 h-32 object-contain rounded-md" />
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { navigator.clipboard.writeText(upiId); toast({ title: "Copied!" }); }} className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[8px] font-black text-slate-500 uppercase">{upiId}</span>
            </button>
            <button onClick={handleDownloadQR} disabled={isDownloading} className="px-4 py-2 bg-[#312ECB]/10 text-[#312ECB] rounded-xl border border-[#312ECB]/20 flex items-center justify-center gap-2">
              {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={14} />}
              <span className="text-[8px] font-black uppercase">Save QR</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[1.5rem] p-6 shadow-xl border border-gray-50 space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Amount (Min ₹5)</label>
              <Input type="number" placeholder="₹0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-4 text-sm font-black text-[#111B21]" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-red-500 tracking-tight ml-1 animate-pulse">Shi UTR ID dalo varna verify nhi hoga</label>
              <Input type="text" placeholder="Enter 12-Digit UTR ID" value={utrId} maxLength={12} onChange={(e) => setUtrId(e.target.value.replace(/[^0-9]/g, ''))} className="h-12 bg-slate-50 border-none rounded-2xl px-4 text-sm font-black tracking-widest text-[#111B21]" />
            </div>
          </div>
          <Button onClick={handleManualSubmit} disabled={loading || !amount || utrId.length !== 12} className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg gap-2">
            {loading ? <Loader2 className="animate-spin" size={12} /> : "Submit Request"}
            <CheckCircle2 size={12} />
          </Button>
        </div>
      </main>

      <Dialog open={showConfirmPopup} onOpenChange={setShowConfirmPopup}>
        <DialogContent className="max-w-[340px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <div className="bg-[#312ECB] p-6 text-center text-white">
            <MessageCircle size={40} className="mx-auto mb-2" />
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Confirm with Admin</DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <Button onClick={() => { window.open(`https://wa.me/919116399517?text=${encodeURIComponent(whatsappMsg)}`, '_blank'); setShowConfirmPopup(false); }} className="w-full h-12 bg-[#25D366] hover:bg-[#1EBE57] text-white font-black text-[10px] uppercase rounded-xl shadow-lg gap-2">
              <Send size={16} /> SEND ON WHATSAPP
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
