"use client";

import { query, collection, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, History, Rocket } from "lucide-react";
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
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-slate-950 font-body text-[#111B21] dark:text-white p-6">
      <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden min-h-[80vh] flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-6 py-6 flex items-center justify-between sticky top-0 z-50">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-2 text-[#312ECB] dark:text-white font-black uppercase text-xs tracking-widest hover:opacity-70 transition-opacity"
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <History size={18} className="text-[#312ECB]" />
            <h1 className="text-sm font-black uppercase tracking-widest">Order History</h1>
          </div>
          <div className="w-12" />
        </header>

        {/* Branding Banner */}
        <div className="bg-[#312ECB] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <Rocket size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-black uppercase text-sm tracking-widest">Growth Tracking</h2>
            <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">Active Services</p>
          </div>
        </div>

        {/* Orders List */}
        <main className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="text-center py-20 text-slate-400 font-black uppercase text-xs tracking-widest animate-pulse">
              Loading History...
            </div>
          ) : orders && orders.length > 0 ? (
            orders.map((order: any) => (
              <div 
                key={order.id} 
                className="p-5 border border-gray-100 dark:border-slate-800 rounded-[2rem] bg-slate-50/50 dark:bg-slate-800/50 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                    <span className="font-black text-[10px] uppercase text-[#312ECB] dark:text-blue-400 tracking-widest">
                      {order.platform}
                    </span>
                    <span className="font-bold text-sm">
                      {order.service}
                    </span>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border-2 ${
                    order.status === 'Completed' ? 'border-emerald-100 text-emerald-600 bg-emerald-50' : 
                    order.status === 'Pending' ? 'border-amber-100 text-amber-600 bg-amber-50' :
                    'border-gray-100 text-slate-500 bg-white'
                  }`}>
                    {order.status}
                  </Badge>
                </div>
                
                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold mb-3 truncate bg-white dark:bg-slate-900 p-2 rounded-xl">
                  {order.link}
                </div>

                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400">Quantity</span>
                    <span className="text-[#111B21] dark:text-white text-xs">{order.quantity}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-center">
                    <span className="text-slate-400">Total Price</span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs">${order.price?.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-slate-400">Date</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, HH:mm') : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <History size={32} className="text-slate-300" />
              </div>
              <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">
                No recent orders found
              </p>
              <Button 
                variant="outline" 
                onClick={() => router.push('/chat')}
                className="rounded-full border-[#312ECB] text-[#312ECB] uppercase font-black text-[10px] tracking-widest px-8"
              >
                Start Growing Now
              </Button>
            </div>
          )}
        </main>

        {/* Branding Footer */}
        <footer className="p-8 text-center bg-slate-50 dark:bg-slate-800/30">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
            SOCIALBOOST SECURE GROWTH SYSTEMS
          </p>
        </footer>
      </div>
    </div>
  );
}