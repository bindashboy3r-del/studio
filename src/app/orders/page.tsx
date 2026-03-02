
"use client";

import { useMemo } from "react";
import { query, collection } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, X, Clock } from "lucide-react";
import { format, isValid, isAfter } from "date-fns";

export default function OrdersHistoryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "orders");
  }, [db, user]);

  const { data: rawOrdersData, isLoading } = useCollection(ordersQuery);

  const orders = useMemo(() => {
    if (!rawOrdersData) return [];
    
    const processed = rawOrdersData.map(order => {
      let createdAt = new Date();
      if (order.createdAt) {
        if (typeof order.createdAt.toDate === 'function') {
          createdAt = order.createdAt.toDate();
        } else {
          const parsed = new Date(order.createdAt);
          if (isValid(parsed)) createdAt = parsed;
        }
      }

      // Calculate Effective Status for User History
      let effectiveStatus = order.status || 'Pending';
      if (order.status === 'Processing' && order.autoCompleteAt) {
        const completeTime = order.autoCompleteAt.toDate ? order.autoCompleteAt.toDate() : new Date(order.autoCompleteAt);
        if (isAfter(new Date(), completeTime)) {
          effectiveStatus = 'Completed';
        }
      }

      return { ...order, createdAt, effectiveStatus };
    });

    // Client side sort since index is missing for combined query
    return processed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [rawOrdersData]);

  return (
    <div className="min-h-screen bg-slate-200/50 dark:bg-slate-950 flex items-center justify-center p-4 md:p-8 font-body">
      <div className="w-full max-w-lg bg-[#F0F2F5] dark:bg-slate-900 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-500">
        
        <header className="bg-white dark:bg-slate-800 px-8 py-6 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
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
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30 dark:bg-slate-900/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-[#312ECB] border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching Logs...</p>
            </div>
          ) : orders && orders.length > 0 ? (
            orders.map((order: any) => (
              <div 
                key={order.id} 
                className="bg-white dark:bg-slate-800 p-6 rounded-[1.8rem] shadow-sm border border-gray-50 dark:border-slate-700/50 flex flex-col gap-2 relative transition-all hover:shadow-md"
              >
                <div className="absolute top-6 right-6 bg-[#312ECB]/5 dark:bg-blue-400/10 px-3 py-1 rounded-full text-[9px] font-black text-[#312ECB] dark:text-blue-400 uppercase tracking-tighter">
                  #{order.orderId || order.id.slice(0, 8).toUpperCase()}
                </div>

                <h3 className="text-[14px] font-black uppercase text-[#312ECB] dark:text-blue-400 tracking-wide pr-24">
                  {order.platform} {order.service}
                </h3>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                    QTY: {order.quantity}
                  </span>
                  <span className="text-slate-200 dark:text-slate-700">•</span>
                  <span className="text-[11px] font-bold text-[#25D366] dark:text-emerald-400 uppercase">
                    ₹{order.price?.toFixed(0)}
                  </span>
                  <span className="text-slate-200 dark:text-slate-700">•</span>
                  <Badge variant="outline" className={`text-[9px] h-5 font-black px-2 border-none rounded-lg ${
                    order.effectiveStatus === 'Processing' ? 'bg-blue-50 text-blue-600' :
                    order.effectiveStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                    order.effectiveStatus === 'Cancelled' ? 'bg-red-50 text-red-600' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {order.effectiveStatus === 'Processing' && <Clock size={10} className="mr-1 inline animate-spin" />}
                    {order.effectiveStatus}
                  </Badge>
                </div>

                <div className="mt-1 self-end text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {isValid(order.createdAt) ? format(order.createdAt, 'd MMM').toUpperCase() : ''}
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

        <footer className="p-6 bg-white dark:bg-slate-800 text-center border-t border-slate-50 dark:border-slate-700">
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-[0.6em]">
            SOCIALBOOST GROWTH LOGS
          </p>
        </footer>
      </div>
    </div>
  );
}
