
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Percent, 
  Save, 
  Zap,
  LayoutGrid,
  Layers,
  Globe,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function DiscountSettingsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [discounts, setDiscounts] = useState({
    single: 0,
    combo: 5,
    bulk: 0
  });
  const [isSaving, setIsSaving] = useState(false);

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";

  useEffect(() => {
    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!db || !user) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDiscounts({
          single: data.single || 0,
          combo: data.combo || 0,
          bulk: data.bulk || 0
        });
      }
    });
    return () => unsub();
  }, [db, user]);

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "globalSettings", "discounts"), {
        ...discounts,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      toast({ title: "Discounts Updated", description: "All order discounts are now live." });
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
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">Discount Manager</h1>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg"
        >
          {isSaving ? "Saving..." : <><Save size={16} /> Update All</>}
        </Button>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 mt-4">
        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Percent size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Global Offers</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Order Discounts</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <LayoutGrid className="text-blue-500" size={18} />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Single Orders</h3>
            </div>
            <div className="relative">
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400">% OFF</span>
              <Input 
                type="number" 
                value={discounts.single}
                onChange={(e) => setDiscounts({...discounts, single: parseFloat(e.target.value) || 0})}
                className="h-14 bg-slate-50 border-none rounded-2xl px-6 text-lg font-black shadow-inner"
              />
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Applied to every standard order.</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-50">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="text-amber-500 fill-current" size={18} />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Combo Orders</h3>
            </div>
            <div className="relative">
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400">% OFF</span>
              <Input 
                type="number" 
                value={discounts.combo}
                onChange={(e) => setDiscounts({...discounts, combo: parseFloat(e.target.value) || 0})}
                className="h-14 bg-slate-50 border-none rounded-2xl px-6 text-lg font-black shadow-inner"
              />
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Applied to multi-service bundle carts.</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-50">
            <div className="flex items-center gap-3 mb-2">
              <Layers className="text-emerald-500" size={18} />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Bulk Orders</h3>
            </div>
            <div className="relative">
              <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-400">% OFF</span>
              <Input 
                type="number" 
                value={discounts.bulk}
                onChange={(e) => setDiscounts({...discounts, bulk: parseFloat(e.target.value) || 0})}
                className="h-14 bg-slate-50 border-none rounded-2xl px-6 text-lg font-black shadow-inner"
              />
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase ml-1">Applied when multiple links are provided.</p>
          </div>

          <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex items-start gap-4">
            <Globe className="text-blue-600 shrink-0" size={20} />
            <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
              Notice: Discounts are calculated on the total cart value. Setting a value to 0 will disable that discount type.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
