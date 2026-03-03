
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  QrCode, 
  Save, 
  CreditCard, 
  User, 
  Link as LinkIcon,
  ShieldCheck,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function PaymentSettingsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [upiId, setUpiId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!db || !user) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "payment"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUpiId(data.upiId || "");
        setMerchantName(data.merchantName || "");
        setQrImageUrl(data.qrImageUrl || "");
      }
    });
    return () => unsub();
  }, [db, user]);

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "globalSettings", "payment"), {
        upiId,
        merchantName,
        qrImageUrl,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      toast({ title: "Payment Settings Saved", description: "Users will now see updated QR and UPI details." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed", description: "Database error." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-20">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">Payment Gateways</h1>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg"
        >
          {isSaving ? "Saving..." : <><Save size={16} /> Save Changes</>}
        </Button>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 mt-4">
        <div className="bg-[#EC4899] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <QrCode size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Paytm / UPI Config</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Merchant Settings</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business UPI ID</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <Input 
                  placeholder="e.g. merchant@paytm" 
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold focus-visible:ring-1 focus-visible:ring-pink-500/20 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Merchant Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <Input 
                  placeholder="e.g. SocialBoost Official" 
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold focus-visible:ring-1 focus-visible:ring-pink-500/20 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custom QR URL (Optional)</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <Input 
                  placeholder="https://imgur.com/your-qr.png" 
                  value={qrImageUrl}
                  onChange={(e) => setQrImageUrl(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold focus-visible:ring-1 focus-visible:ring-pink-500/20 shadow-inner"
                />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-1">
                If empty, system will auto-generate QR based on UPI ID.
              </p>
            </div>
          </div>

          <div className="bg-pink-50 p-5 rounded-3xl border border-pink-100 flex items-start gap-4">
            <ShieldCheck className="text-pink-600 shrink-0" size={20} />
            <p className="text-[10px] font-bold text-pink-700 leading-relaxed uppercase">
              Important: These details are public. All payments made by users will be sent directly to this UPI/Merchant account.
            </p>
          </div>

          <div className="pt-4">
            <div className="w-full border-t border-slate-50 relative mb-8">
              <span className="absolute left-1/2 -top-3 -translate-x-1/2 bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Preview</span>
            </div>
            
            <div className="flex flex-col items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 border-dashed">
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <img 
                  src={qrImageUrl || `https://quickchart.io/qr?text=${encodeURIComponent(`upi://pay?pa=${upiId || 'test@upi'}&pn=${merchantName || 'SocialBoost'}`)}&size=300`} 
                  alt="QR Preview" 
                  className="w-32 h-32"
                />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-black text-slate-800">{merchantName || 'Merchant Name'}</p>
                <p className="text-[9px] font-bold text-slate-400">{upiId || 'upi-id@bank'}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
