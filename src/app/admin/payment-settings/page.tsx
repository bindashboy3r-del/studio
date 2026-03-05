"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  QrCode, 
  Save, 
  CreditCard, 
  Link as LinkIcon,
  ShieldCheck,
  Wallet,
  Zap,
  ToggleLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  const [walletEnabled, setWalletEnabled] = useState(true);
  const [upiEnabled, setUpiEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";

  useEffect(() => {
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
        setWalletEnabled(data.walletEnabled ?? true);
        setUpiEnabled(data.upiEnabled ?? true);
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
        walletEnabled,
        upiEnabled,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      toast({ title: "Settings Saved", description: "Payment controls updated successfully." });
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
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">Payment Hub Config</h1>
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
        {/* Payment Visibility Controls */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
            <ToggleLeft className="text-[#312ECB]" size={20} />
            <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Visibility Controls</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl shadow-inner border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <Wallet size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-800">Wallet Payment</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Show during checkout</p>
                </div>
              </div>
              <Switch checked={walletEnabled} onCheckedChange={setWalletEnabled} className="data-[state=checked]:bg-[#312ECB]" />
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl shadow-inner border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <QrCode size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-800">UPI / QR Payment</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Show during checkout</p>
                </div>
              </div>
              <Switch checked={upiEnabled} onCheckedChange={setUpiEnabled} className="data-[state=checked]:bg-[#312ECB]" />
            </div>
          </div>
        </div>

        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Zap size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Global Settings</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">QR & UPI Config</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="space-y-4 pt-4">
            <h3 className="text-[11px] font-black uppercase text-pink-600 tracking-widest border-b pb-2">Public Payment Details</h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business UPI ID</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <Input 
                  placeholder="e.g. paytmqr2810@paytm" 
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Merchant Name</label>
              <Input 
                placeholder="e.g. SocialBoost Official" 
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="h-14 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custom QR Image URL (Optional)</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <Input 
                  placeholder="Direct link to your QR png/jpg" 
                  value={qrImageUrl}
                  onChange={(e) => setQrImageUrl(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold shadow-inner"
                />
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 ml-1">Leave empty to use auto-generated QR.</p>
            </div>
          </div>

          <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex items-start gap-4">
            <ShieldCheck className="text-blue-600 shrink-0" size={20} />
            <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
              Notice: These details are visible to all users on the Add Funds page. Ensure UPI is correct.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}