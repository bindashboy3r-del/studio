
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
import { useFirestore, useUser } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";
import { getApiOrdersStatus } from "@/app/actions/smm-api";

export default function TrackerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && (!user || user.email !== "chetanmadhav4@gmail.com")) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!user || !db || user.email !== "chetanmadhav4@gmail.com") return;

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

        let effectiveStatus = data.status || 'Pending';
        if (data.status === 'Processing' && data.autoCompleteAt) {
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
  }, [user, db]);

  const syncAllWithApi = async () => {
    if (!db) return;
    setIsSyncing(true);
    
    const needsSync = orders.filter(o => 
      (o.status === 'Pending' || o.status === 'Processing' || o.status === 'In progress') && 
      o.apiOrderId && 
      o.providerId
    );

    if (needsSync.length === 0) {
      toast({ title: "Sync Complete", description: "No orders require API status check." });
      setIsSyncing(false);
      return;
    }

    try {
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

        const result = await getApiOrdersStatus(provider.url, provider.key, byProvider[providerId].join(','));
        if (result.success && result.statuses) {
          for (const apiId in result.statuses) {
            const apiStatus = result.statuses[apiId].status;
            const matchingOrder = needsSync.find(o => o.apiOrderId === apiId);
            if (matchingOrder && apiStatus && apiStatus !== matchingOrder.status) {
              await updateDoc(doc(db, matchingOrder.path), { 
                status: apiStatus,
                apiStatusLastChecked: serverTimestamp()
              });
            }
          }
        }
      }
      toast({ title: "Sync Successful", description: "All active orders updated with latest API status." });
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Error connecting to SMM panels." });
    } finally {
      setIsSyncing(false);
    }
  };

  const updateStatus = async (order: any, newStatus: string) => {
    if (!db) return;
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

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const activeOrders = orders.filter(o => o.effectiveStatus === 'Pending' || o.effectiveStatus === 'Processing' || o.effectiveStatus === 'In progress');
  const historyOrders = orders.filter(o => o.effectiveStatus === 'Completed' || o.effectiveStatus === 'Cancelled' || o.effectiveStatus === 'Canceled' || o.effectiveStatus === 'Refunded');

  const OrderTable = ({ data }: { data: any[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow className="border-slate-100 hover:bg-transparent">
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Order ID</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Service</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Link</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">API Info</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Status</TableHead>
            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((order) => (
            <TableRow key={order.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
              <TableCell className="text-[11px] font-bold text-slate-400 uppercase">
                <span className="text-[#111B21] font-black">{order.orderId || order.id.slice(0,8).toUpperCase()}</span><br/>
                {isValid(order.createdAt) ? format(order.createdAt, 'MMM dd HH:mm') : 'N/A'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-black uppercase text-[10px] text-blue-600">{order.platform || 'Platform'}</span>
                  <span className="text-sm font-bold text-slate-800">{order.service || 'N/A'} ({order.quantity || 0})</span>
                  <span className="text-[9px] font-black text-emerald-600">₹{order.price?.toFixed(2)}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="max-w-[120px] truncate text-[11px] font-bold text-slate-500">
                    {order.link || 'No Link'}
                  </span>
                  {order.link && (
                    <>
                      <button onClick={() => copyToClipboard(order.link, "Link")} className="text-slate-300 hover:text-blue-600"><Copy size={12} /></button>
                      <a href={order.link} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-blue-600"><ExternalLink size={12} /></a>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {order.apiOrderId ? (
                  <div className="flex flex-col gap-1">
                    <Badge variant="secondary" className="text-[9px] w-fit font-black bg-slate-100">API: {order.apiOrderId}</Badge>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">{order.providerId || 'Unknown Provider'}</span>
                  </div>
                ) : order.apiError ? (
                  <div className="flex items-center gap-1 text-red-500">
                    <AlertCircle size={12} />
                    <span className="text-[9px] font-black uppercase">API Error</span>
                  </div>
                ) : (
                  <span className="text-[9px] font-bold text-slate-300 italic">Manual Order</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className={
                  order.effectiveStatus === 'Pending' ? 'bg-yellow-500/10 text-yellow-600 border-none' : 
                  (order.effectiveStatus === 'Processing' || order.effectiveStatus === 'In progress') ? 'bg-blue-500/10 text-blue-600 border-none' :
                  (order.effectiveStatus === 'Cancelled' || order.effectiveStatus === 'Canceled') ? 'bg-red-500/10 text-red-600 border-none' :
                  order.effectiveStatus === 'Refunded' ? 'bg-amber-100 text-amber-700 border-none' :
                  'bg-emerald-500/10 text-emerald-600 border-none'
                }>
                  {(order.effectiveStatus === 'Processing' || order.effectiveStatus === 'In progress') && <Clock size={10} className="mr-1 inline animate-spin" />}
                  {order.effectiveStatus === 'Refunded' && <Wallet size={10} className="mr-1 inline" />}
                  {order.effectiveStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {order.effectiveStatus === 'Pending' ? (
                  <Select onValueChange={(val) => updateStatus(order, val)}>
                    <SelectTrigger className="w-[120px] h-10 bg-white border-slate-200 rounded-xl text-[10px] font-black uppercase">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Processing" className="text-[10px] font-black uppercase text-blue-600">Processing</SelectItem>
                      <SelectItem value="Cancelled" className="text-[10px] font-black uppercase text-red-600">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Locked</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin")} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#111B21]">LIVE TRACKER</h1>
              <p className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">Approve & Manage Orders</p>
            </div>
          </div>
          <Button 
            onClick={syncAllWithApi} 
            disabled={isSyncing}
            className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-12 px-6 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg"
          >
            {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <Globe size={16} />}
            Sync with APIs
          </Button>
        </header>

        <main className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <Tabs defaultValue="pending" className="w-full">
            <div className="px-8 pt-6 pb-2 border-b border-slate-50 flex items-center justify-between">
              <TabsList className="bg-slate-100 rounded-2xl p-1 h-12">
                <TabsTrigger value="pending" className="rounded-xl px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">
                  Active ({activeOrders.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-xl px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">
                  History ({historyOrders.length})
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
        </main>
      </div>
    </div>
  );
}
