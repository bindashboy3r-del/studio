
"use client";

import { useMemo, useEffect, useState } from "react";
import { query, collection, doc, updateDoc, getDoc, writeBatch, increment, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, X, Clock, Copy, RefreshCw, Wallet, AlertCircle } from "lucide-react";
import { format, isValid, isAfter, subMinutes } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getApiOrdersStatus } from "@/app/actions/smm-api";

export default function OrdersHistoryPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

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

    return processed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [rawOrdersData]);

  // Automatic Refund Logic (30 Minute Window)
  useEffect(() => {
    if (!db || !user || !orders.length || isSyncing) return;

    const checkRefunds = async () => {
      const thirtyMinsAgo = subMinutes(new Date(), 30);
      
      // Orders eligible for refund:
      // 1. Status is 'Pending'
      // 2. Created > 30 mins ago
      // 3. Paid via Wallet
      // 4. API failed (no apiOrderId OR apiError exists)
      const eligibleForRefund = orders.filter(o => 
        o.status === 'Pending' && 
        o.paymentMethod === 'Wallet' &&
        isAfter(thirtyMinsAgo, o.createdAt) &&
        (!o.apiOrderId || o.apiError)
      );

      if (eligibleForRefund.length === 0) return;

      setIsSyncing(true);
      const batch = writeBatch(db);

      for (const order of eligibleForRefund) {
        const orderRef = doc(db, "users", user.uid, "orders", order.id);
        const userRef = doc(db, "users", user.uid);
        const notifRef = doc(collection(db, "users", user.uid, "notifications"));

        // 1. Mark Order as Refunded
        batch.update(orderRef, { 
          status: 'Refunded', 
          refundedAt: serverTimestamp(),
          refundReason: order.apiError || 'API Timeout / Manual Failure'
        });

        // 2. Add Balance back
        batch.update(userRef, {
          balance: increment(order.price || 0)
        });

        // 3. Send Notification
        batch.set(notifRef, {
          title: '💸 Auto-Refund Processed',
          message: `Your order #${order.orderId || order.id.slice(0,8)} failed to start. ₹${order.price?.toFixed(2)} has been refunded to your wallet.`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      try {
        await batch.commit();
        toast({ 
          title: "System Update", 
          description: `${eligibleForRefund.length} failed orders have been automatically refunded.` 
        });
      } catch (e) {
        console.error("Refund Batch Failed", e);
      } finally {
        setIsSyncing(false);
      }
    };

    checkRefunds();
  }, [db, user, orders, isSyncing]);

  // Real-time API Status Sync Logic
  useEffect(() => {
    if (!db || !user || !orders.length || isSyncing) return;

    const syncApiOrders = async () => {
      const needsSync = orders.filter(o => 
        (o.status === 'Pending' || o.status === 'Processing' || o.status === 'In progress') && 
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
        if (!provider) continue;

        const idsStr = byProvider[providerId].join(',');
        const result = await getApiOrdersStatus(provider.url, provider.key, idsStr);

        if (result.success && result.statuses) {
          for (const apiId in result.statuses) {
            const apiStatus = result.statuses[apiId].status;
            const matchingOrder = needsSync.find(o => o.apiOrderId === apiId);
            
            if (matchingOrder && apiStatus && apiStatus !== matchingOrder.status) {
              const orderRef = doc(db, "users", user.uid, "orders", matchingOrder.id);
              updateDoc(orderRef, { 
                status: apiStatus,
                apiStatusLastChecked: serverTimestamp()
              }).catch(e => console.error("Update status failed", e));
            }
          }
        }
      }
    };

    syncApiOrders();
  }, [db, user, orders, isSyncing]);

  const copyOrderId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: "Copied!", description: "Order ID copied to clipboard." });
  };

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
            orders.map((order: any) => {
              const displayId = order.orderId || order.id.slice(0, 8).toUpperCase();
              return (
                <div 
                  key={order.id} 
                  className="bg-white dark:bg-slate-800 p-6 rounded-[1.8rem] shadow-sm border border-gray-50 dark:border-slate-700/50 flex flex-col gap-2 relative transition-all hover:shadow-md"
                >
                  <button 
                    onClick={() => copyOrderId(displayId)}
                    className="absolute top-6 right-6 bg-[#312ECB]/5 dark:bg-blue-400/10 px-3 py-1 rounded-full text-[9px] font-black text-[#312ECB] dark:text-blue-400 uppercase tracking-tighter flex items-center gap-1.5 hover:bg-[#312ECB]/10 transition-colors"
                  >
                    #{displayId}
                    <Copy size={10} />
                  </button>

                  <h3 className="text-[14px] font-black uppercase text-[#312ECB] dark:text-blue-400 tracking-wide pr-24">
                    {order.platform} {order.service}
                  </h3>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                      QTY: {order.quantity}
                    </span>
                    <span className="text-slate-200 dark:text-slate-700">•</span>
                    <span className="text-[11px] font-bold text-[#25D366] dark:text-emerald-400 uppercase">
                      ₹{order.price?.toFixed(2)}
                    </span>
                    <span className="text-slate-200 dark:text-slate-700">•</span>
                    <Badge variant="outline" className={`text-[9px] h-5 font-black px-2 border-none rounded-lg ${
                      order.effectiveStatus === 'Processing' || order.effectiveStatus === 'In progress' ? 'bg-blue-50 text-blue-600' :
                      order.effectiveStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                      order.effectiveStatus === 'Refunded' ? 'bg-amber-100 text-amber-700' :
                      order.effectiveStatus === 'Cancelled' || order.effectiveStatus === 'Canceled' ? 'bg-red-50 text-red-600' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {(order.effectiveStatus === 'Processing' || order.effectiveStatus === 'In progress') && <Clock size={10} className="mr-1 inline animate-spin" />}
                      {order.effectiveStatus === 'Refunded' && <Wallet size={10} className="mr-1 inline" />}
                      {order.effectiveStatus}
                    </Badge>
                  </div>

                  {order.effectiveStatus === 'Refunded' && (
                    <div className="mt-2 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-xl border border-amber-100 dark:border-amber-800/30 flex items-start gap-2">
                      <AlertCircle size={12} className="text-amber-600 mt-0.5" />
                      <p className="text-[9px] font-bold text-amber-700 dark:text-amber-500 uppercase leading-tight">
                        Reason: {order.refundReason || 'Order failed to place on server.'}
                      </p>
                    </div>
                  )}

                  <div className="mt-1 self-end text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {isValid(order.createdAt) ? format(order.createdAt, 'd MMM').toUpperCase() : ''}
                  </div>
                </div>
              );
            })
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
