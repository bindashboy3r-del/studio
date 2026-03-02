
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Megaphone, 
  Send, 
  Info, 
  LayoutGrid, 
  Zap,
  Radio,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function BroadcastPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [message, setMessage] = useState("Hello guys\nWelcome to instaflow\nAgar koi problem aaye to profile me jake support pe click krke hume contect kar sakte hai\n\nThanks you for useing instaflow");
  const [isLive, setIsLive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && (!user || user.email !== "chetanmadhav4@gmail.com")) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  const handlePublish = async () => {
    if (!message.trim() || !db) return;
    setIsSending(true);
    
    const broadcastRef = doc(db, "globalAnnouncements", "current");
    const data = {
      text: message,
      active: true,
      timestamp: serverTimestamp(),
      adminEmail: user?.email
    };

    setDoc(broadcastRef, data)
      .then(() => {
        setIsLive(true);
        toast({
          title: "Broadcast Published!",
          description: "All active users will see this message now.",
        });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: broadcastRef.path,
          operation: 'write',
          requestResourceData: data
        }));
      })
      .finally(() => setIsSending(false));
  };

  const handleCancel = async () => {
    if (!db) return;
    const broadcastRef = doc(db, "globalAnnouncements", "current");
    
    deleteDoc(broadcastRef)
      .then(() => {
        setIsLive(false);
        setMessage("");
        toast({
          title: "Broadcast Cancelled",
          description: "Announcement has been removed from all user feeds.",
        });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: broadcastRef.path,
          operation: 'delete'
        }));
      });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-10">
      {/* Header matching provided screenshot layout */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">Admin Panel</h1>
        </div>
        <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          <span className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">Super Admin Access</span>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-6 space-y-8 mt-4">
        <header className="space-y-1">
          <h2 className="text-[32px] font-black text-[#111B21] tracking-tighter uppercase">Broadcast Manager</h2>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Real-time Global Announcements</p>
        </header>

        {/* Live Broadcast Card */}
        <div className="bg-[#312ECB] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 rounded-[1.2rem] bg-white/10 flex items-center justify-center border border-white/20">
              <Megaphone size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight uppercase">Live Broadcast</h3>
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1">Connected to all user sessions</p>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4 relative z-10">
            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl ${isLive ? 'bg-[#25D366]' : 'bg-slate-900/40'} border border-white/10 transition-colors`}>
              <Switch checked={isLive} onCheckedChange={(val) => !val && handleCancel()} className="data-[state=checked]:bg-white data-[state=unchecked]:bg-slate-700" />
              <span className="text-[11px] font-black uppercase tracking-widest">{isLive ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          
          {/* Decorative pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
        </div>

        {/* Message Content Area */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message Content</label>
              <Textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your announcement here..."
                className="min-h-[200px] bg-slate-50 border-none rounded-2xl p-6 text-[14px] font-bold text-slate-700 placeholder:text-slate-300 shadow-inner focus-visible:ring-1 focus-visible:ring-[#312ECB]/20 resize-none"
              />
              <div className="flex items-center gap-2 mt-2">
                <Zap size={14} className="text-yellow-500 fill-current" />
                <p className="text-[10px] font-bold text-slate-400 italic">Real-time update: Users will see this as soon as you save.</p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-full border-t border-slate-50 relative">
                  <span className="absolute left-1/2 -top-3 -translate-x-1/2 bg-white px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Live Preview</span>
                </div>
                
                <div className="w-full border-2 border-dashed border-slate-100 rounded-2xl p-6 min-h-[100px] flex items-center justify-center">
                  {isLive ? (
                    <p className="text-sm font-bold text-slate-600 text-center whitespace-pre-wrap">{message}</p>
                  ) : (
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Broadcast is currently disabled.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-8 flex flex-col gap-4 items-center">
            <button 
              onClick={handleCancel}
              className="text-[11px] font-black text-slate-400 hover:text-red-500 uppercase tracking-[0.3em] transition-colors"
            >
              Cancel
            </button>
            <Button 
              onClick={handlePublish}
              disabled={isSending || !message.trim()}
              className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[13px] uppercase tracking-widest rounded-2xl shadow-xl gap-3 transition-all active:scale-95"
            >
              <Send size={18} className="fill-current" />
              {isSending ? "Publishing..." : "Publish Now"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
