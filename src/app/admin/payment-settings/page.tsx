
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
  Zap,
  Lock
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
  const [paytmMid, setPaytmMid] = useState("");
  const [paytmKey, setPaytmKey] = useState("");
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
        setPaytmMid(data.paytmMid || "");
        setPaytmKey(data.paytmKey || "");
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
        paytmMid,
        paytmKey,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      toast({ title: "Settings Saved", description: "Paytm Automation & QR details updated." });
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
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">Gateway Config</h1>
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
        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Zap size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Auto-Verification</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Paytm Automation</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase text-blue-600 tracking-widest border-b pb-2">Automation Credentials</h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paytm MID (Merchant ID)</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <Input 
                  placeholder="Enter Paytm MID" 
                  value={paytmMid}
                  onChange={(e) => setPaytmMid(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Merchant Key (Secret)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <Input 
                  type="password"
                  placeholder="Enter Merchant Key" 
                  value={paytmKey}
                  onChange={(e) => setPaytmKey(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-[11px] font-black uppercase text-pink-600 tracking-widest border-b pb-2">Public QR Display</h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business UPI ID</label>
              <Input 
                placeholder="e.g. paytmqr2810@paytm" 
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="h-14 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
              />
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">QR URL (Optional)</label>
              <Input 
                placeholder="Direct Link to QR Image" 
                value={qrImageUrl}
                onChange={(e) => setQrImageUrl(e.target.value)}
                className="h-14 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
              />
            </div>
          </div>

          <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex items-start gap-4">
            <ShieldCheck className="text-blue-600 shrink-0" size={20} />
            <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
              Important: Paytm MID automation uses the Transaction ID provided by users. Ensure your Paytm MID is active for 'Order Status Query' API.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
