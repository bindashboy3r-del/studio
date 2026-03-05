
"use client";

import { useMemo, useEffect } from "react";
import { query, collection, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquareText, Clock } from "lucide-react";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";

export default function ChatLogsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/");
  }, [user, isUserLoading, router]);

  const logsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "chatMessages"), orderBy("timestamp", "desc"), limit(100));
  }, [db, user]);

  const { data: logs, isLoading } = useCollection(logsQuery);

  const processedLogs = useMemo(() => {
    if (!logs) return [];
    return logs.map(log => {
      let timestamp = new Date();
      if (log.timestamp) {
        timestamp = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      }
      return { ...log, timestamp };
    });
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-slate-950 font-body pb-10">
      <header className="bg-white dark:bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[9px] tracking-widest">
          <ChevronLeft size={14} /> Back
        </button>
        <h1 className="text-[9px] font-black uppercase tracking-[0.2em]">Chat History</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-3 space-y-3 mt-1">
        <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-xl border border-pink-100 dark:border-pink-900/30 flex items-center gap-2">
          <Clock className="text-pink-500" size={14} />
          <p className="text-[8px] font-black text-pink-600 uppercase tracking-widest">Chats are cleared every 7 days</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-[#312ECB] border-t-transparent rounded-full animate-spin" />
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fetching Logs...</p>
          </div>
        ) : processedLogs && processedLogs.length > 0 ? (
          processedLogs.map((log: any) => (
            <div 
              key={log.id} 
              className={cn(
                "p-3 rounded-2xl shadow-sm border flex flex-col gap-1",
                log.sender === 'bot' 
                  ? "bg-white dark:bg-slate-900 border-gray-50 dark:border-slate-800 ml-0 mr-10" 
                  : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 ml-10 mr-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-[7px] font-black uppercase tracking-widest",
                  log.sender === 'bot' ? "text-[#312ECB]" : "text-emerald-600"
                )}>
                  {log.sender === 'bot' ? 'Assistant' : 'You'}
                </span>
                <span className="text-[7px] font-bold text-slate-400 uppercase">
                  {isValid(log.timestamp) ? format(log.timestamp, 'HH:mm • dd MMM') : ''}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                {log.text}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <MessageSquareText size={32} className="text-slate-200" />
            </div>
            <p className="text-[10px] font-black text-[#111B21] dark:text-white uppercase tracking-[0.2em]">No Recent Chats</p>
            <Button onClick={() => router.push('/chat')} className="rounded-xl bg-[#312ECB] text-white font-black text-[9px] px-8 h-10">Say Hi!</Button>
          </div>
        )}
      </main>
    </div>
  );
}
