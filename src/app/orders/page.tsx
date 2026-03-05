
"use client";

import { useMemo, useEffect, useState } from "react";
import { query, collection, doc, updateDoc, getDoc, writeBatch, increment, serverTimestamp, getDocs, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, X, Clock, Copy, RefreshCw, Wallet, AlertCircle, ChevronLeft, Package } from "lucide-react";
import { format, isValid, isAfter, subMinutes, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getApiOrdersStatus } from "@/app/actions/smm-api";
import { cn } from "@/lib/utils";

export default function OrdersHistoryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  // 90-Day Auto-Cleanup for Orders
  useEffect(() => {
    if (!db || !user) return;
    const cleanupOldOrders = async () => {
      try {
        const ninetyDaysAgo = subDays(new Date(), 90);
        const qClean = query(
          collection(db, "users", user.uid, "orders"), 
          where("createdAt", "<", ninetyDaysAgo)
        );
        const snap = await getDocs(qClean);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          console.log(`Auto-cleaned ${snap.size} old order records.`);
        }
      } catch (e) {
        console.error("Orders cleanup failed", e);
      }
    };
    cleanupOldOrders();
  }, [db, user]);

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

      let effectiveStatus = order.status || 'Pending';
      const normalized = effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1).toLowerCase();
      effectiveStatus = (normalized === 'In progress' || normalized === 'In-progress') ? 'Processing' : normalized;

      // Virtual Auto-Completion Logic (45 minutes)
      if (effectiveStatus !== 'Completed' && effectiveStatus !== 'Cancelled' && order.autoCompleteAt) {
        const completeTime = order.autoCompleteAt.toDate ? order.autoCompleteAt.toDate() : new Date(order.autoCompleteAt);
        if (isAfter(new Date(), completeTime)) {
          effectiveStatus = 'Completed';
        }
      }

      return { ...order, createdAt, effectiveStatus };
    });

    return processed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [rawOrdersData]);

  // Real-time API Status Sync Logic
  useEffect(() => {
    if (!db || !user || !orders.length || isSyncing) return;

    const syncApiOrders = async () => {
      const activeStatuses = ['pending', 'processing', 'in progress', 'inprogress'];
      const needsSync = orders.filter(o => 
        activeStatuses.includes((o.status || 'pending').toLowerCase()) && 
        o.apiOrderId && 
        o.providerId
      );

      if (needsSync.length === 0) return;

      const apiSettingsSnap = await getDoc(doc(db, "globalSettings", "api"));
      if (!apiSettingsSnap.exists()) return;
      const apiSettings = apiSettingsSnap.data();

      const byProvider: Record<string, string[]> = {};
      needsSync.forEach(o => {
        if (!byProvider[o.providerId]) byProvider[o.providerId] = [];
        byProvider[o.providerId].push(o.apiOrderId);
      });

      for (const providerId in byProvider) {
        const provider = apiSettings.providers?.find((p: any) => p.id === providerId);
        if (!provider || !provider.url || !provider.key) continue;

        const idsStr = byProvider[providerId].join(',');
        const result = await getApiOrdersStatus(provider.url, provider.key, idsStr);

        if (result.success && result.statuses) {
          for (const apiId in result.statuses) {
            const apiStatus = result.statuses[apiId].status;
            const matchingOrder = needsSync.find(o => o.apiOrderId === apiId);
            
            if (matchingOrder && apiStatus && apiStatus.toLowerCase() !== (matchingOrder.status || '').toLowerCase()) {
              let finalStatus = apiStatus;
              const s = apiStatus.toLowerCase();
              if (s === 'completed' || s === 'success' || s === 'finish' || s === 'finished') finalStatus = 'Completed';
              if (s === 'canceled' || s === 'cancelled' || s === 'fail' || s === 'error') finalStatus = 'Cancelled';

              const orderRef = doc(db, "users", user.uid, "orders", matchingOrder.id);
              await updateDoc(orderRef, { 
                status: finalStatus,
                apiStatusLastChecked: serverTimestamp()
              }).catch(e => console.error("Update status failed", e));
            }
          }
        }
      }
    };

    const timer = setTimeout(() => syncApiOrders(), 1500);
    return () => clearTimeout(timer);
  }, [db, user, orders.length, isSyncing]);

  const copyOrderId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: "Copied!", description: "Order ID copied to clipboard." });
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-slate-950 font-body pb-10">
      <header className="bg-white dark:bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 sticky top-0 z-50 shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[9px] tracking-widest">
          <ChevronLeft size={14} /> Back
        </button>
        <h1 className="text-[9px] font-black uppercase tracking-[0.2em]">Order History</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-3 space-y-3 mt-1">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-center gap-2">
          <Package className="text-[#312ECB]" size={14} />
          <p className="text-[8px] font-black text-[#312ECB] uppercase tracking-widest">Orders are kept for 90 days</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-[#312ECB] border-t-transparent rounded-full animate-spin" />
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Syncing History...</p>
          </div>
        ) : orders && orders.length > 0 ? (
          orders.map((order: any) => {
            const displayId = order.orderId || order.id.slice(0, 8).toUpperCase();
            return (
              <div 
                key={order.id} 
                className="bg-white dark:bg-slate-900 p-4 rounded-[1.2rem] shadow-sm border border-gray-50 dark:border-slate-800 flex flex-col gap-1.5 relative transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black uppercase text-[#312ECB] dark:text-blue-400 tracking-tight truncate max-w-[180px]">
                    {order.service}
                  </h3>
                  <button 
                    onClick={() => copyOrderId(displayId)}
                    className="bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[8px] font-black text-slate-400 uppercase flex items-center gap-1"
                  >
                    #{displayId} <Copy size={8} />
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Qty: {order.quantity}
                  </span>
                  <span className="text-slate-200 dark:text-slate-700">•</span>
                  <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                    ₹{order.price?.toFixed(2)}
                  </span>
                  <Badge className={cn(
                    "ml-auto text-[8px] h-4.5 font-black px-2 border-none rounded-md",
                    order.effectiveStatus === 'Processing' || order.effectiveStatus === 'In progress' ? 'bg-blue-50 text-blue-600' :
                    order.effectiveStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                    order.effectiveStatus === 'Refunded' ? 'bg-amber-100 text-amber-700' :
                    (order.effectiveStatus === 'Cancelled' || order.effectiveStatus === 'Canceled') ? 'bg-red-50 text-red-600' :
                    'bg-slate-100 text-slate-400'
                  )}>
                    {(order.effectiveStatus === 'Processing' || order.effectiveStatus === 'In progress') && <Clock size={8} className="mr-1 inline animate-spin" />}
                    {order.effectiveStatus}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-50 dark:border-slate-800/50">
                  <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                    {order.platform} Hub
                  </span>
                  <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {isValid(order.createdAt) ? format(order.createdAt, 'dd MMM') : ''}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <History size={32} className="text-slate-200" />
            </div>
            <p className="text-[10px] font-black text-[#111B21] dark:text-white uppercase tracking-[0.2em]">No Activity Yet</p>
            <Button onClick={() => router.push('/chat')} className="rounded-xl bg-[#312ECB] text-white font-black text-[9px] px-8 h-10">Start Ordering</Button>
          </div>
        )}
      </main>
    </div>
  );
}
