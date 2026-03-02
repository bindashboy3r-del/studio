
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Megaphone, Send, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export default function BroadcastPage() {
  const { user, isUserLoading } = useUser();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && (!user || user.email !== "chetanmadhav4@gmail.com")) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  const handleBroadcast = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    
    // In a prototype, we'll simulate the broadcast.
    // Real implementation would save to a 'globalAnnouncements' collection
    // or batch add to all user chat history.
    
    setTimeout(() => {
      toast({
        title: "Broadcast Sent!",
        description: "Your announcement has been sent to all active sessions.",
      });
      setMessage("");
      setIsSending(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body">
      <div className="max-w-xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/admin")}
            className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#111B21]">BROADCAST MSG</h1>
            <p className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">Real-time Announcements</p>
          </div>
        </header>

        <main className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4">
            <Info className="text-blue-600 shrink-0 mt-0.5" size={20} />
            <p className="text-[13px] font-bold text-blue-900 leading-relaxed">
              Your message will appear as a system announcement for every active user on SocialBoost.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-[#111B21] uppercase tracking-widest ml-1">
              Announcement Text
            </label>
            <Textarea 
              placeholder="Type your official announcement here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[200px] bg-slate-50 border-none rounded-2xl p-6 text-sm font-bold placeholder:text-slate-300 shadow-inner focus-visible:ring-1 focus-visible:ring-[#312ECB]/20"
            />
          </div>

          <Button 
            onClick={handleBroadcast}
            disabled={isSending || !message.trim()}
            className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[13px] uppercase tracking-widest rounded-2xl shadow-xl gap-3 transition-all active:scale-95"
          >
            {isSending ? "TRANSMITTING..." : (
              <>
                <Send size={20} /> SEND TO ALL USERS
              </>
            )}
          </Button>
        </main>
      </div>
    </div>
  );
}
