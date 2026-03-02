"use client";

import { query, collection, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { History, X } from "lucide-react";
import { format } from "date-fns";

export default function OrdersHistoryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "orders"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
  }, [db, user]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  return (
    <div className="min-h-screen bg-[#E9EBF0] dark:bg-slate-950 flex items-center justify-center p-4 md:p-8 font-body">
      {/* Centered Order History Card */}
      <div className="w-full max-w-lg bg-[#F0F2F5] dark:bg-slate-900 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 px-8 py-6 flex items-center justify-between border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="text-[#312ECB]">
              <History size={24} strokeWidth={3} />
            </div>
            <h1 className="text-[20px] font-black uppercase tracking-tight text-[#111B21] dark:text-white">
              ORDER HISTORY
            </h1>
          </div>
          <button 
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {/* Orders List Container */}
        <main className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-[#312ECB] border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching Logs...</p>
            </div>
          ) : orders && orders.length > 0 ? (
            orders.map((order: any) => (
              <div 
                key={order.id} 
                className="bg-white dark:bg-slate-800 p-5 rounded-[1.8rem] shadow-sm border border-gray-50 dark:border-slate-700/50 flex flex-col gap-1 relative group hover:shadow-md transition-shadow"
              >
                {/* ID Tag */}
                <div className="absolute top-4 right-4 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-full text-[9px] font-black text-[#312ECB]/40 dark:text-white/30 uppercase tracking-tighter">
                  #{order.id.slice(0, 8).toUpperCase()}
                </div>

                {/* Service Name */}
                <h3 className="text-[13px] font-black uppercase text-[#312ECB] dark:text-blue-400 tracking-wide pr-20">
                  {order.platform} {order.service}
                </h3>

                {/* Details Row */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                    QTY: {order.quantity}
                  </span>
                  <span className="text-slate-200 dark:text-slate-700">•</span>
                  <span className="text-[11px] font-bold text-[#25D366] dark:text-emerald-400 uppercase tracking-tight">
                    ₹{order.price?.toFixed(0)}
                  </span>
                </div>

                {/* Date Tag */}
                <div className="mt-1 self-end text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'd MMM').toUpperCase() : ''}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 space-y-4">
              <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <History size={40} className="text-slate-200" />
              </div>
              <div>
                <p className="text-[11px] font-black text-[#111B21] dark:text-white uppercase tracking-[0.2em] mb-1">
                  NO RECENT ACTIVITY
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Orders you place will appear here
                </p>
              </div>
              <Button 
                onClick={() => router.push('/chat')}
                className="rounded-full bg-[#312ECB] hover:bg-[#2825A6] text-white uppercase font-black text-[10px] tracking-widest px-10 h-12 shadow-lg"
              >
                START ORDERING
              </Button>
            </div>
          )}
        </main>

        {/* Footer Branding */}
        <footer className="p-6 bg-slate-50 dark:bg-slate-950/30 text-center">
          <p className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.4em]">
            SOCIALBOOST GROWTH LOGS
          </p>
        </footer>
      </div>
    </div>
  );
}
