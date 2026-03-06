
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
  CheckCircle2,
  MessageCircle,
  Download,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, onSnapshot, collection, addDoc, serverTimestamp, query, where, orderBy, getDoc, updateDoc, increment, arrayUnion, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function AddFundsPage() {
  const { user } = useUser();
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
  
  // Popup States
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");

  // History Query - Corrected to avoid permission conflicts
  const historyQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "fundRequests"), 
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [db, user]);
  const { data: fundHistory, isLoading: isHistoryLoading } = useCollection(historyQuery);

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
      toast({ title: "QR Saved!", description: "Image downloaded successfully." });
    } catch (e) {
      window.open(finalQrUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!user || !db || !amount || !utrId) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Amount & UTR required." });
      return;
    }

    const amtNum = parseFloat(amount);
    if (amtNum < 5) {
      toast({ variant: "destructive", title: "Amount Too Low", description: "Minimum deposit ₹5 required." });
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

      const username = user?.displayName || user?.email || "User";
      const msg = `🚀 *NEW PAYMENT SUBMITTED!*\n\n👤 *User Name:* ${username}\n🔢 *UTR ID:* ${utrId.trim()}\n💰 *Amount:* ₹${amount}\n\nKripya mera payment check karein aur balance add karein. Dhanyawad!`;
      
      setWhatsappMsg(msg);
      setShowConfirmPopup(true);
      
      toast({ 
        title: "Request Logged!", 
        description: "Please confirm sending details to admin." 
      });

    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: "Try again later." });
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
        toast({ variant: "destructive", title: "Invalid Code", description: "This code does not exist." });
        setIsRedeeming(false);
        return;
      }

      const data = snap.data();
      if (data.usedCount >= data.limit) {
        toast({ variant: "destructive", title: "Code Expired", description: "This code's usage limit is reached." });
        setIsRedeeming(false);
        return;
      }

      if (data.usedBy && data.usedBy.includes(user.uid)) {
        toast({ variant: "destructive", title: "Already Used", description: "You have already redeemed this code." });
        setIsRedeeming(false);
        return;
      }

      const batch = writeBatch(db);
      
      // 1. Update Code usage
      batch.update(codeRef, {
        usedCount: increment(1),
        usedBy: arrayUnion(user.uid)
      });

      // 2. Add Balance
      const userRef = doc(db, "users", user.uid);
      batch.update(userRef, { balance: increment(data.amount) });

      // 3. Notification
      const notifRef = doc(collection(db, "users", user.uid, "notifications"));
      batch.set(notifRef, {
        title: "🎁 Voucher Redeemed!",
        message: `₹${data.amount} added to your wallet via code: ${codeId}`,
        read: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: "Redeemed Successfully!", description: `₹${data.amount} has been added to your wallet.` });
      setRedeemCode("");
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to redeem code." });
    } finally {
      setIsRedeeming(false);
    }
  };

  const confirmWhatsAppSend = () => {
    const adminNumber = "919116399517";
    window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
    setShowConfirmPopup(false);
  };

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    toast({ title: "Copied!", description: "UPI ID copied." });
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
          <div className="bg-emerald-500 rounded-lg p-2 text-white flex items-center justify-between shadow-md animate-in fade-in zoom-in">
            <div className="flex items-center gap-2">
              <Zap className="fill-current animate-pulse" size={12} />
              <p className="text-[9px] font-black uppercase">Mega Offer: Get {globalBonus}% Extra Bonus!</p>
            </div>
            <Badge className="bg-white text-emerald-600 border-none text-[8px] font-black px-2">ACTIVE</Badge>
          </div>
        )}

        <div className="bg-white rounded-[1.2rem] p-4 shadow-sm border border-gray-50 flex flex-col items-center space-y-3">
          <div className="text-center">
            <h3 className="text-[8px] font-black uppercase tracking-widest text-slate-400">Step 1: Pay via QR</h3>
            <p className="text-[8px] font-bold text-slate-800 uppercase mt-0.5">{merchantName}</p>
          </div>

          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 shadow-inner">
            <img 
              src={finalQrUrl} 
              alt="Payment QR" 
              className="w-32 h-32 object-contain rounded-md"
            />
          </div>

          <div className="flex gap-2 w-full">
            <button 
              onClick={copyUpi}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-50 rounded-xl border border-slate-100 shadow-sm active:scale-95 transition-all"
            >
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{upiId}</span>
              <Copy size={10} className="text-[#312ECB]" />
            </button>
            <button 
              onClick={handleDownloadQR}
              disabled={isDownloading}
              className="px-4 py-2 bg-[#312ECB]/10 text-[#312ECB] rounded-xl border border-[#312ECB]/20 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={14} />}
              <span className="text-[8px] font-black uppercase">Save QR</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-gray-50 space-y-4">
          <div className="text-center">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Step 2: Submit Details</h3>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Amount (Min ₹5)</label>
              <Input 
                type="number" 
                placeholder="₹0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 bg-slate-50 border-none rounded-2xl px-4 text-sm font-black shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-red-500 tracking-tight ml-1 leading-none animate-pulse">
                Shi utr dalo varna payment verify nhi hoga
              </label>
              <Input 
                type="text" 
                placeholder="Enter 12-Digit UTR ID" 
                value={utrId}
                maxLength={12}
                onChange={(e) => setUtrId(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-12 bg-slate-50 border-none rounded-2xl px-4 text-sm font-black tracking-widest shadow-inner"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleManualSubmit}
              disabled={loading || !amount || utrId.length !== 12}
              className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg gap-2 active:scale-95 transition-all"
            >
              {loading ? <Loader2 className="animate-spin" size={12} /> : "Submit Request"}
              <CheckCircle2 size={12} />
            </Button>
          </div>
        </div>

        {/* Redeem Code Section */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50 space-y-4">
          <div className="flex items-center gap-2">
            <Ticket className="text-orange-500" size={16} />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Redeem Voucher</h3>
          </div>
          <div className="flex gap-2">
            <Input 
              placeholder="ENTER CODE" 
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              className="h-12 bg-slate-50 border-none rounded-2xl px-4 text-sm font-black shadow-inner flex-1"
            />
            <Button 
              onClick={handleRedeem}
              disabled={isRedeeming || !redeemCode}
              className="h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest px-6 shadow-md"
            >
              {isRedeeming ? <Loader2 className="animate-spin" size={14} /> : "Redeem"}
            </Button>
          </div>
        </div>

        {/* Recent Deposits History */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50 space-y-4">
          <div className="flex items-center gap-2">
            <History className="text-[#312ECB]" size={16} />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Recent Deposits</h3>
          </div>

          <div className="space-y-3">
            {isHistoryLoading ? (
              <div className="py-10 flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-[#312ECB]" size={20} />
                <p className="text-[8px] font-black uppercase text-slate-400">Loading History...</p>
              </div>
            ) : fundHistory && fundHistory.length > 0 ? (
              fundHistory.slice(0, 10).map((req: any) => (
                <div key={req.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      req.status === 'Approved' ? "bg-emerald-100 text-emerald-600" :
                      req.status === 'Rejected' ? "bg-red-100 text-red-600" :
                      "bg-amber-100 text-amber-600"
                    )}>
                      {req.status === 'Approved' ? <CheckCircle size={16} /> : 
                       req.status === 'Rejected' ? <XCircle size={16} /> : 
                       <Clock size={16} />}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800">₹{req.amount}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">{req.utrId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={cn(
                      "text-[7px] font-black uppercase border-none px-2 h-4",
                      req.status === 'Approved' ? "bg-emerald-50 text-emerald-600" :
                      req.status === 'Rejected' ? "bg-red-50 text-red-600" :
                      "bg-amber-50 text-amber-600"
                    )}>
                      {req.status}
                    </Badge>
                    <p className="text-[7px] font-bold text-slate-300 mt-1 uppercase">
                      {req.createdAt?.toDate ? format(req.createdAt.toDate(), "dd MMM HH:mm") : ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-slate-300">
                <AlertCircle className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-[9px] font-black uppercase tracking-widest">No Recent Deposits</p>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => router.push('/chat')}
          className="w-full bg-white rounded-2xl p-3.5 flex items-center justify-between border border-gray-100 shadow-sm active:bg-slate-50"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="text-slate-400" size={16} />
            <span className="text-[9px] font-black uppercase tracking-widest">Back to Chat</span>
          </div>
          <ChevronRight className="text-slate-300" size={14} />
        </button>
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmPopup} onOpenChange={setShowConfirmPopup}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <div className="bg-[#312ECB] p-6 text-center text-white">
            <MessageCircle size={40} className="mx-auto mb-2" />
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Send to Admin</DialogTitle>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Verify your payment details</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>UTR ID:</span>
                <span className="text-slate-900">{utrId}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>Amount:</span>
                <span className="text-emerald-600">₹{amount}</span>
              </div>
            </div>
            <p className="text-[11px] font-bold text-slate-500 text-center leading-relaxed">
              Details have been logged. Click below to send confirmation to admin on WhatsApp.
            </p>
            <Button 
              onClick={confirmWhatsAppSend}
              className="w-full h-12 bg-[#25D366] hover:bg-[#1EBE57] text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg gap-2"
            >
              <Send size={16} /> SEND ON WHATSAPP
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
