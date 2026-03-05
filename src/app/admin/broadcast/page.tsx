
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Megaphone, 
  Send, 
  Zap,
  Layers,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, serverTimestamp, onSnapshot, writeBatch } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";

const SLOTS = ["slot1", "slot2", "slot3"];

export default function BroadcastPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [activeSlot, setActiveSlot] = useState("slot1");
  const [slotData, setSlotData] = useState<Record<string, { text: string; active: boolean }>>({
    slot1: { text: "", active: false },
    slot2: { text: "", active: false },
    slot3: { text: "", active: false },
  });
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const ADMIN_ID = "s55uL0f8PmcypR75usVYOLwVs7O2";
    const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
    if (!isUserLoading && (!user || (user.email !== ADMIN_EMAIL && user.uid !== ADMIN_ID))) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  // Sync all slots with Firestore
  useEffect(() => {
    if (!db || !user) return;
    
    const unsubscribes = SLOTS.map(slotId => {
      const docRef = doc(db, "globalAnnouncements", slotId);
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setSlotData(prev => ({
            ...prev,
            [slotId]: { text: data.text || "", active: data.active || false }
          }));
        }
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [db, user]);

  const handlePublish = async () => {
    const currentData = slotData[activeSlot];
    if (!db) return;
    setIsSending(true);
    
    const ref = doc(db, "globalAnnouncements", activeSlot);
    
    setDoc(ref, {
      text: currentData.text,
      active: currentData.active,
      timestamp: serverTimestamp(),
      adminEmail: user?.email
    }, { merge: true })
      .then(() => {
        toast({
          title: currentData.active ? "Broadcast Published!" : "Draft Saved",
          description: currentData.active 
            ? "Your message is now LIVE for all users." 
            : `Slot ${activeSlot.slice(-1)} updated (Offline).`,
        });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `globalAnnouncements/${activeSlot}`,
          operation: 'write',
          requestResourceData: currentData
        }));
      })
      .finally(() => setIsSending(false));
  };

  const updateCurrentSlot = (updates: Partial<{ text: string; active: boolean }>) => {
    setSlotData(prev => ({
      ...prev,
      [activeSlot]: { ...prev[activeSlot], ...updates }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-10">
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">Admin Panel</h1>
        </div>
        <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          <span className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">Broadcast Control</span>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-6 space-y-6 mt-4">
        <header className="space-y-1">
          <h2 className="text-[32px] font-black text-[#111B21] tracking-tighter uppercase">Broadcast Slots</h2>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Manage 3 announcements independently.</p>
        </header>

        {/* Slot Selector */}
        <div className="flex bg-white p-1.5 rounded-[1.5rem] shadow-sm border border-slate-100">
          {SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={cn(
                "flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative",
                activeSlot === slot 
                  ? "bg-[#312ECB] text-white shadow-lg" 
                  : "text-slate-400 hover:bg-slate-50"
              )}
            >
              Slot {slot.slice(-1)}
              {slotData[slot].active && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>
          ))}
        </div>

        <div className={cn(
          "rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl transition-all duration-500",
          slotData[activeSlot].active ? "bg-[#312ECB]" : "bg-slate-800"
        )}>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 rounded-[1.2rem] bg-white/10 flex items-center justify-center border border-white/20">
              <Megaphone size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight uppercase">
                {slotData[activeSlot].active ? 'Status: ONLINE' : 'Status: OFFLINE'}
              </h3>
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1">
                Configuring Slot {activeSlot.slice(-1)}
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4 relative z-10">
            <div className={cn(
              "flex items-center gap-3 px-5 py-2.5 rounded-2xl border border-white/10 transition-colors",
              slotData[activeSlot].active ? 'bg-[#25D366]' : 'bg-slate-900/40'
            )}>
              <Switch 
                checked={slotData[activeSlot].active} 
                onCheckedChange={(val) => updateCurrentSlot({ active: val })} 
                className="data-[state=checked]:bg-white data-[state=unchecked]:bg-slate-700" 
              />
              <span className="text-[11px] font-black uppercase tracking-widest">
                {slotData[activeSlot].active ? 'Public' : 'Hidden'}
              </span>
            </div>
          </div>
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message Content (Slot {activeSlot.slice(-1)})</label>
              <Textarea 
                value={slotData[activeSlot].text}
                onChange={(e) => updateCurrentSlot({ text: e.target.value })}
                placeholder="Type your announcement here..."
                className="min-h-[180px] bg-slate-50 border-none rounded-2xl p-6 text-[14px] font-bold text-slate-700 placeholder:text-slate-300 shadow-inner focus-visible:ring-1 focus-visible:ring-[#312ECB]/20 resize-none"
              />
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-full border-t border-slate-50 relative">
                  <span className="absolute left-1/2 -top-3 -translate-x-1/2 bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Preview</span>
                </div>
                
                <div className="w-full border-2 border-dashed border-slate-100 rounded-3xl p-6 min-h-[100px] flex items-center justify-center bg-slate-50/50">
                  {slotData[activeSlot].text ? (
                    <p className="text-sm font-bold text-slate-600 text-center whitespace-pre-wrap leading-relaxed">{slotData[activeSlot].text}</p>
                  ) : (
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Slot Empty</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-8 flex flex-col gap-4 items-center">
            <div className="flex w-full gap-3">
              <Button 
                variant="outline"
                onClick={() => updateCurrentSlot({ text: "", active: false })}
                className="flex-1 h-14 border-slate-200 text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-2xl"
              >
                Clear
              </Button>
              <Button 
                onClick={handlePublish}
                disabled={isSending || !slotData[activeSlot].text.trim()}
                className="flex-[2] h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[13px] uppercase tracking-widest rounded-2xl shadow-xl gap-3 transition-all active:scale-95"
              >
                <Send size={18} />
                {isSending ? "Syncing..." : "Publish Now"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
