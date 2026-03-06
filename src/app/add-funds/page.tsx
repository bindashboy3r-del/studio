
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Wallet, 
  Zap,
  Loader2,
  QrCode,
  Copy,
  CheckCircle2,
  MessageCircle,
  Download,
  Send,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { doc, onSnapshot, collection, addDoc, serverTimestamp, getDoc, updateDoc, increment, arrayUnion, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
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
  const [redeemCode, setRedeemCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
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
    return () => {
      unsubFinance();
      unsubPayment();
    };
  }, [db, user]);

  if (isUserLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]"><Loader2 className="animate-spin text-[#312ECB]" /></div>;
  }

  const upiId = paymentConfig?.upiId || "smmxpressbot@slc";
  const merchantName = paymentConfig?.merchantName || "SocialBoost";
  const customQrUrl = paymentConfig?.qrImageUrl;
  
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&cu=INR`;
  const generatedQr = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;
  const finalQrUrl = customQrUrl || generatedQr;

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
    } catch (e) {
      window.open(finalQrUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!user || !db || !amount || !utrId) {
      toast({ variant: "destructive", title: "Missing Fields" });
      return;
    }

    const amtNum = parseFloat(amount);
    if (amtNum < 5) {
      toast({ variant: "destructive", title: "Amount Too Low", description: "Min ₹5 required." });
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
        amount: amtNum,
        utrId: utrId.trim(),
        status: 'Pending',
        type: 'Manual',
        createdAt: serverTimestamp()
      });

      const msg = `🚀 *NEW PAYMENT SUBMITTED!*\n\n👤 *User:* ${user.displayName || user.email}\n🔢 *UTR ID:* ${utrId.trim()}\n💰 *Amount:* ₹${amount}\n\nKripya mera payment verify karein.`;
      setWhatsappMsg(msg);
      setShowConfirmPopup(true);
      toast({ title: "Request Logged!" });
      setAmount("");
      setUtrId("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: "Server error." });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!user || !db || !redeemCode) return;
    setIsRedeeming(true);
    const codeId = redeemCode.trim().toUpperCase();
    
    try {
      const codeRef = doc(db, "redeemCodes", codeId);
      const snap = await getDoc(codeRef);
      
      if (!snap.exists()) {
        toast({ variant: "destructive", title: "Invalid Code", description: "Yeh code sahi nahi hai." });
        setIsRedeeming(false);
        return;
      }

      const data = snap.data();
      if (data.usedCount >= data.limit) {
        toast({ variant: "destructive", title: "Limit Reached", description: "Yeh code ab khatam ho chuka hai." });
        setIsRedeeming(false);
        return;
      }

      if (data.usedBy && data.usedBy.includes(user.uid)) {
        toast({ variant: "destructive", title: "Already Used", description: "Aapne yeh code pehle hi redeem kar liya hai." });
        setIsRedeeming(false);
        return;
      }

      const batch = writeBatch(db);
      batch.update(codeRef, { 
        usedCount: increment(1), 
        usedBy: arrayUnion(user.uid) 
      });
      batch.update(doc(db, "users", user.uid), { 
        balance: increment(data.amount) 
      });
      
      const notifRef = doc(collection(db, "users", user.uid, "notifications"));
      batch.set(notifRef, {
        title: "🎁 Voucher Redeemed!",
        message: `₹${data.amount} added to your wallet via code: ${codeId}`,
        read: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: "Redeemed Successfully!", description: `₹${data.amount} aapke wallet mein add ho gaye hain.` });
      setRedeemCode("");
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Kuch technical issue hai." });
    } finally {
      setIsRedeeming(false);
    }
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
        <div className="bg-[#312ECB] rounded-[1.2rem] p-4 text-white shadow-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
            <QrCode size={16} />
          </div>
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.3em] text-white/60">Wallet Refill</p>
            <h2 className="text-[15px] font-black uppercase tracking-tight">Scan & Pay</h2>
          </div>
        </div>

        {globalBonus > 0 && (
          <div className="bg-emerald-500 rounded-lg p-2 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <Zap className="fill-current animate-pulse" size={12} />
              <p className="text-[9px] font-black uppercase">Offer: Get {globalBonus}% Extra Bonus!</p>
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
              <Copy size={10} className="text-[#312ECB]" />
            </button>
            <button onClick={handleDownloadQR} disabled={isDownloading} className="px-4 py-2 bg-[#312ECB]/10 text-[#312ECB] rounded-xl border border-[#312ECB]/20 flex items-center justify-center gap-2">
              {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={14} />}
              <span className="text-[8px] font-black uppercase">Save QR</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-gray-50 space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Amount (Min ₹5)</label>
              <Input type="number" placeholder="₹0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-4 text-sm font-black text-[#111B21]" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-red-500 tracking-tight ml-1 animate-pulse">Shi utr dalo varna payment verify nhi hoga</label>
              <Input type="text" placeholder="Enter 12-Digit UTR ID" value={utrId} maxLength={12} onChange={(e) => setUtrId(e.target.value.replace(/[^0-9]/g, ''))} className="h-12 bg-slate-50 border-none rounded-2xl px-4 text-sm font-black tracking-widest text-[#111B21]" />
            </div>
          </div>
          <Button onClick={handleManualSubmit} disabled={loading || !amount || utrId.length !== 12} className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg gap-2">
            {loading ? <Loader2 className="animate-spin" size={12} /> : "Submit Request"}
            <CheckCircle2 size={12} />
          </Button>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50 space-y-4">
          <div className="flex items-center gap-2">
            <Ticket className="text-orange-500" size={16} />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#111B21]">Redeem Voucher</h3>
          </div>
          <div className="flex gap-2">
            <Input placeholder="ENTER CODE" value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} className="h-12 bg-slate-50 border-none rounded-2xl px-4 text-sm font-black flex-1 text-[#111B21]" />
            <Button onClick={handleRedeem} disabled={isRedeeming || !redeemCode} className="h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-[9px] uppercase px-6">
              {isRedeeming ? <Loader2 className="animate-spin" size={14} /> : "Redeem"}
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={showConfirmPopup} onOpenChange={setShowConfirmPopup}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <div className="bg-[#312ECB] p-6 text-center text-white">
            <MessageCircle size={40} className="mx-auto mb-2" />
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Send to Admin</DialogTitle>
          </div>
          <div className="p-6 space-y-4">
            <Button onClick={() => { window.open(`https://wa.me/919116399517?text=${encodeURIComponent(whatsappMsg)}`, '_blank'); setShowConfirmPopup(false); }} className="w-full h-12 bg-[#25D366] hover:bg-[#1EBE57] text-white font-black text-[10px] uppercase rounded-2xl shadow-lg gap-2">
              <Send size={16} /> SEND ON WHATSAPP
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
