
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Share2, 
  Save, 
  Instagram, 
  Facebook, 
  Youtube, 
  MessageCircle,
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function SocialSettingsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [links, setLinks] = useState({
    instagram: "",
    facebook: "",
    youtube: "",
    whatsapp: ""
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
    const unsub = onSnapshot(doc(db, "globalSettings", "social"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLinks({
          instagram: data.instagram || "",
          facebook: data.facebook || "",
          youtube: data.youtube || "",
          whatsapp: data.whatsapp || ""
        });
      }
    });
    return () => unsub();
  }, [db, user]);

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "globalSettings", "social"), {
        ...links,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      toast({ title: "Social Links Saved", description: "Floating menu will update for all users." });
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
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">Social Links Config</h1>
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
        <div className="bg-[#F43F5E] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Share2 size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Global Settings</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">External Links</h2>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="space-y-4 pt-4">
            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">Admin Profiles</h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instagram Link</label>
              <div className="relative">
                <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500" size={18} />
                <Input 
                  placeholder="https://instagram.com/yourhandle" 
                  value={links.instagram}
                  onChange={(e) => setLinks({...links, instagram: e.target.value})}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Facebook Link</label>
              <div className="relative">
                <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" size={18} />
                <Input 
                  placeholder="https://facebook.com/yourhandle" 
                  value={links.facebook}
                  onChange={(e) => setLinks({...links, facebook: e.target.value})}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">YouTube Channel</label>
              <div className="relative">
                <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600" size={18} />
                <Input 
                  placeholder="https://youtube.com/@yourhandle" 
                  value={links.youtube}
                  onChange={(e) => setLinks({...links, youtube: e.target.value})}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp Number Link</label>
              <div className="relative">
                <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
                <Input 
                  placeholder="https://wa.me/919116399517" 
                  value={links.whatsapp}
                  onChange={(e) => setLinks({...links, whatsapp: e.target.value})}
                  className="h-14 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex items-start gap-4">
            <LinkIcon className="text-blue-600 shrink-0" size={20} />
            <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
              Notice: These links appear in the floating menu on the chat screen. Ensure you include "https://" in every link.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
