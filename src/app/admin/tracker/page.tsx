
"use client";

import { useState, useEffect } from "react";
import { 
  collectionGroup, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc,
  serverTimestamp,
  getDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isValid, addMinutes, isAfter } from "date-fns";
import { ChevronLeft, RefreshCw, ExternalLink, Copy, Clock, Globe, Wallet, AlertCircle } from "lucide-react";
import { useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";
import { getApiOrdersStatus } from "@/app/actions/smm-api";
import { cn } from "@/lib/utils";

export default function TrackerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const ADMIN_ID = "s55uL0f8PmcypR75usVYOLwVs7O2";
  const isActuallyAdmin = user?.email === ADMIN_EMAIL || user?.uid === ADMIN_ID;

  useEffect(() => {
    if (!isUserLoading && (!user || !isActuallyAdmin)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, isActuallyAdmin, router]);

  useEffect(() => {
    if (!user || !db || !isActuallyAdmin) {
      if (!isUserLoading && !isActuallyAdmin) setLoading(false);
      return;
    }

    const q = collectionGroup(db, "orders");
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else {
            const parsed = new Date(data.createdAt);
            if (isValid(parsed)) createdAt = parsed;
          }
        }

        // Status normalization for Admin
        let effectiveStatus = data.status || 'Pending';
        const normalized = effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1).toLowerCase();
        effectiveStatus = (normalized === 'In progress' || normalized === 'In-progress') ? 'Processing' : normalized;

        if (effectiveStatus === 'Processing' && data.autoCompleteAt) {
          const completeTime = data.autoCompleteAt.toDate ? data.autoCompleteAt.toDate() : new Date(data.autoCompleteAt);
          if (isAfter(new Date(), completeTime)) {
            effectiveStatus = 'Completed';
          }
        }

        return {
          id: doc.id,
          path: doc.ref.path,
          ...data,
          createdAt,
          effectiveStatus
        };
      });

      ords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setOrders(ords);
      setLoading(false);
    }, (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'orders (collectionGroup)',
        operation: 'list'
      }));
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, db, isActuallyAdmin, isUserLoading]);

  // Automatic sync on mount
  useEffect(() => {
    if (orders.length > 0 && !isSyncing && isActuallyAdmin) {
      const activeOrdersCount = orders.filter(o => 
        ['pending', 'processing', 'in progress', 'inprogress'].includes((o.status || 'pending').toLowerCase()) && o.apiOrderId
      ).length;
      
      if (activeOrdersCount > 0) {
        syncAllWithApi(true); // silent sync
      }
    }
  }, [orders.length, isActuallyAdmin]);

  const syncAllWithApi = async (silent = false) => {
    if (!db || !isActuallyAdmin || isSyncing) return;
    if (!silent) setIsSyncing(true);
    
    const activeStatuses = ['pending', 'processing', 'in progress', 'inprogress'];
    const needsSync = orders.filter(o => 
      activeStatuses.includes((o.status || 'pending').toLowerCase()) && 
      o.apiOrderId && 
      o.providerId
    );

    if (needsSync.length === 0) {
      if (!silent) {
        toast({ title: "Sync Complete", description: "No orders require API status check." });
        setIsSyncing(false);
      }
      return;
    }

    try {
      const apiSettingsSnap = await getDoc(doc(db, "globalSettings", "api"));
      if (!apiSettingsSnap.exists()) {
        if (!silent) toast({ variant: "destructive", title: "API Config Missing" });
        setIsSyncing(false);
        return;
      }
      const apiSettings = apiSettingsSnap.data();

      const byProvider: Record<string, string[]> = {};
      needsSync.forEach(o => {
        if (!byProvider[o.providerId]) byProvider[o.providerId] = [];
        byProvider[o.providerId].push(o.apiOrderId);
      });

      for (const providerId in byProvider) {
        const provider = apiSettings.providers?.find((p: any) => p.id === providerId);
        if (!provider || !provider.url || !provider.key) continue;

        const result = await getApiOrdersStatus(provider.url, provider.key, byProvider[providerId].join(','));
        if (result.success && result.statuses) {
          for (const apiId in result.statuses) {
            const apiStatus = result.statuses[apiId].status;
            const matchingOrder = needsSync.find(o => o.apiOrderId === apiId);
            
            if (matchingOrder && apiStatus && apiStatus.toLowerCase() !== (matchingOrder.status || '').toLowerCase()) {
              // Map various "Finished" statuses to app "Completed"
              let finalStatus = apiStatus;
              const s = apiStatus.toLowerCase();
              if (s === 'completed' || s === 'success' || s === 'finish' || s === 'finished') finalStatus = 'Completed';
              if (s === 'canceled' || s === 'cancelled' || s === 'fail' || s === 'error') finalStatus = 'Cancelled';

              await updateDoc(doc(db, matchingOrder.path), { 
                status: finalStatus,
                apiStatusLastChecked: serverTimestamp()
              });
            }
          }
        }
      }
      if (!silent) toast({ title: "Sync Successful", description: "All active orders updated with latest API status." });
    } catch (e) {
      if (!silent) toast({ variant: "destructive", title: "Sync Failed", description: "Error connecting to SMM panels." });
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  const updateStatus = async (order: any, newStatus: string) => {
    if (!db || !isActuallyAdmin) return;
    const orderRef = doc(db, order.path);
    const updateData: any = { status: newStatus };
    
    if (newStatus === 'Processing') {
      updateData.autoCompleteAt = addMinutes(new Date(), 45);
    } else {
      updateData.autoCompleteAt = null;
    }
    
    updateDoc(orderRef, updateData)
      .then(() => {
        toast({ title: "Status Updated", description: `Order set to ${newStatus}.` });
      });
  };

  const activeStatusesList = ['Pending', 'Processing', 'In progress', 'In-progress', 'In Progress'];
  const activeOrders = orders.filter(o => activeStatusesList.includes(o.effectiveStatus));
  const historyOrders = orders.filter(o => !activeStatusesList.includes(o.effectiveStatus));

  const OrderTable = ({ data }: { data: any[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow className="border-slate-100 hover:bg-transparent">
            <TableHead className="text-[9px] font-black uppercase tracking-widest py-4">Order Info</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest py-4">Service Details</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest py-4">API Hub</TableHead>
            <TableHead className="text-[9px] font-black uppercase tracking-widest py-4">Status</TableHead>
            <TableHead className="text-right text-[9px] font-black uppercase tracking-widest py-4">Control</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((order) => (
            <TableRow key={order.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
              <TableCell className="text-[10px] font-bold text-slate-400 uppercase">
                <span className="text-[#111B21] font-black">{order.orderId || order.id.slice(0,8).toUpperCase()}</span><br/>
                {isValid(order.createdAt) ? format(order.createdAt, 'dd MMM HH:mm') : 'N/A'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-black uppercase text-[9px] text-blue-600">{order.platform || 'Platform'}</span>
                  <span className="text-[11px] font-bold text-slate-800 truncate max-w-[150px]">{order.service || 'N/A'}</span>
                  <span className="text-[9px] font-black text-emerald-600">₹{order.price?.toFixed(2)} ({order.quantity || 0})</span>
                </div>
              </TableCell>
              <TableCell>
                {order.apiOrderId ? (
                  <div className="flex flex-col gap-0.5">
                    <Badge variant="secondary" className="text-[8px] w-fit font-black bg-slate-100 h-4 px-1.5">ID: {order.apiOrderId}</Badge>
                    <span className="text-[7px] font-bold text-slate-400 uppercase">{order.providerId?.slice(0,10)}...</span>
                  </div>
                ) : (
                  <span className="text-[8px] font-bold text-slate-300 italic">Manual</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className={cn(
                  "text-[8px] h-5 font-black px-2 border-none rounded-lg",
                  order.effectiveStatus === 'Pending' ? 'bg-yellow-500/10 text-yellow-600' : 
                  (order.effectiveStatus === 'Processing' || order.effectiveStatus === 'In progress') ? 'bg-blue-500/10 text-blue-600' :
                  (order.effectiveStatus === 'Cancelled' || order.effectiveStatus === 'Canceled') ? 'bg-red-500/10 text-red-600' :
                  order.effectiveStatus === 'Refunded' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-500/10 text-emerald-600'
                )}>
                  {(order.effectiveStatus === 'Processing' || order.effectiveStatus === 'In progress') && <Clock size={10} className="mr-1 inline animate-spin" />}
                  {order.effectiveStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {order.effectiveStatus === 'Pending' ? (
                  <Select onValueChange={(val) => updateStatus(order, val)}>
                    <SelectTrigger className="w-[80px] h-8 bg-white border-slate-200 rounded-lg text-[8px] font-black uppercase">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Processing" className="text-[8px] font-black uppercase text-blue-600">Approve</SelectItem>
                      <SelectItem value="Cancelled" className="text-[8px] font-black uppercase text-red-600">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-[8px] font-black text-slate-300 uppercase">Fixed</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (loading || (!user && !isUserLoading)) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-10">
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/admin")} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400">
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-sm font-black tracking-tight text-[#111B21] uppercase">Live Tracker</h1>
        </div>
        <Button 
          onClick={() => syncAllWithApi()} 
          disabled={isSyncing}
          className="bg-[#312ECB] hover:bg-[#2825A6] rounded-lg h-8 px-3 font-black uppercase text-[8px] tracking-widest gap-1.5 shadow-sm"
        >
          {isSyncing ? <RefreshCw className="animate-spin" size={12} /> : <Globe size={12} />}
          Sync API
        </Button>
      </header>

      <main className="max-w-4xl mx-auto p-3 space-y-4">
        <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <Tabs defaultValue="pending" className="w-full">
            <div className="px-4 pt-4 border-b border-slate-50 flex items-center justify-between">
              <TabsList className="bg-slate-100 rounded-xl p-1 h-9">
                <TabsTrigger value="pending" className="rounded-lg px-4 text-[8px] font-black uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">
                  Active ({activeOrders.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg px-4 text-[8px] font-black uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">
                  History
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="pending" className="mt-0">
              <OrderTable data={activeOrders} />
            </TabsContent>
            
            <TabsContent value="history" className="mt-0">
              <OrderTable data={historyOrders} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
