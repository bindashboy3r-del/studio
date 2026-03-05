
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
import { format, isValid } from "date-fns";
import { ChevronLeft, RefreshCw, Globe, Clock } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
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
  const isActuallyAdmin = user?.email === ADMIN_EMAIL || user?.uid === "s55uL0f8PmcypR75usVYOLwVs7O2";

  useEffect(() => {
    if (!isUserLoading && (!user || !isActuallyAdmin)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, isActuallyAdmin, router]);

  useEffect(() => {
    if (!user || !db || !isActuallyAdmin) return;

    const q = collectionGroup(db, "orders");
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        if (data.createdAt?.toDate) createdAt = data.createdAt.toDate();
        
        return {
          id: doc.id,
          path: doc.ref.path,
          ...data,
          createdAt
        };
      });

      ords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setOrders(ords);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, db, isActuallyAdmin]);

  const syncAllWithApi = async () => {
    if (!db || !isActuallyAdmin || isSyncing) return;
    setIsSyncing(true);
    
    const needsSync = orders.filter(o => 
      ['pending', 'processing'].includes((o.status || 'pending').toLowerCase()) && 
      o.apiOrderId && 
      o.providerId
    );

    if (needsSync.length === 0) {
      toast({ title: "Sync Complete", description: "No API orders require status check." });
      setIsSyncing(false);
      return;
    }

    try {
      const apiSettingsSnap = await getDoc(doc(db, "globalSettings", "api"));
      const apiSettings = apiSettingsSnap.data();

      const byProvider: Record<string, string[]> = {};
      needsSync.forEach(o => {
        if (!byProvider[o.providerId]) byProvider[o.providerId] = [];
        byProvider[o.providerId].push(o.apiOrderId);
      });

      for (const providerId in byProvider) {
        const provider = apiSettings?.providers?.find((p: any) => p.id === providerId);
        if (!provider?.url || !provider?.key) continue;

        const result = await getApiOrdersStatus(provider.url, provider.key, byProvider[providerId].join(','));
        if (result.success && result.statuses) {
          for (const apiId in result.statuses) {
            const apiStatus = result.statuses[apiId].status;
            const matchingOrder = needsSync.find(o => o.apiOrderId === apiId);
            
            if (matchingOrder && apiStatus) {
              let finalStatus = apiStatus;
              const s = apiStatus.toLowerCase();
              if (['completed', 'success', 'finished'].includes(s)) finalStatus = 'Completed';
              if (['canceled', 'cancelled', 'fail'].includes(s)) finalStatus = 'Cancelled';

              await updateDoc(doc(db, matchingOrder.path), { 
                status: finalStatus,
                apiStatusLastChecked: serverTimestamp()
              });
            }
          }
        }
      }
      toast({ title: "Sync Successful" });
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsSyncing(false);
    }
  };

  const updateStatus = async (order: any, newStatus: string) => {
    if (!db || !isActuallyAdmin) return;
    updateDoc(doc(db, order.path), { status: newStatus })
      .then(() => toast({ title: "Status Updated" }));
  };

  const OrderTable = ({ data }: { data: any[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow className="border-slate-100 hover:bg-transparent">
            <TableHead className="text-[9px] font-black uppercase py-4">Order Info</TableHead>
            <TableHead className="text-[9px] font-black uppercase py-4">Service</TableHead>
            <TableHead className="text-[9px] font-black uppercase py-4">API/Manual</TableHead>
            <TableHead className="text-[9px] font-black uppercase py-4">Status</TableHead>
            <TableHead className="text-right text-[9px] font-black uppercase py-4">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((order) => (
            <TableRow key={order.id} className="border-slate-50 hover:bg-slate-50/50">
              <TableCell className="text-[10px] font-bold text-slate-400 uppercase">
                <span className="text-[#111B21] font-black">{order.orderId || 'N/A'}</span><br/>
                {isValid(order.createdAt) ? format(order.createdAt, 'dd MMM HH:mm') : 'N/A'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-800 truncate max-w-[150px]">{order.service}</span>
                  <span className="text-[9px] font-black text-emerald-600">₹{order.price?.toFixed(2)} ({order.quantity})</span>
                </div>
              </TableCell>
              <TableCell>
                {order.type === 'API' ? (
                  <Badge variant="secondary" className="text-[8px] font-black bg-blue-50 text-blue-600">API: {order.apiOrderId}</Badge>
                ) : (
                  <Badge variant="outline" className="text-[8px] font-black border-orange-200 text-orange-600 uppercase">MANUAL</Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge className={cn(
                  "text-[8px] h-5 font-black px-2 border-none rounded-lg",
                  order.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-600' : 
                  order.status === 'Processing' ? 'bg-blue-500/10 text-blue-600' :
                  order.status === 'Cancelled' ? 'bg-red-500/10 text-red-600' :
                  'bg-emerald-500/10 text-emerald-600'
                )}>
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Select onValueChange={(val) => updateStatus(order, val)}>
                  <SelectTrigger className="w-[80px] h-8 text-[8px] font-black uppercase border-slate-200">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Processing" className="text-[8px] font-black uppercase text-blue-600">Approve</SelectItem>
                    <SelectItem value="Completed" className="text-[8px] font-black uppercase text-emerald-600">Complete</SelectItem>
                    <SelectItem value="Cancelled" className="text-[8px] font-black uppercase text-red-600">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-10">
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/admin")} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft size={18} /></button>
          <h1 className="text-sm font-black tracking-tight text-[#111B21] uppercase">Live Tracker</h1>
        </div>
        <Button onClick={syncAllWithApi} disabled={isSyncing} className="bg-[#312ECB] rounded-lg h-8 px-3 font-black uppercase text-[8px] gap-1.5">
          {isSyncing ? <RefreshCw className="animate-spin" size={12} /> : <Globe size={12} />}
          Sync API
        </Button>
      </header>

      <main className="max-w-4xl mx-auto p-3 space-y-4">
        <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <Tabs defaultValue="all" className="w-full">
            <div className="px-4 pt-4 border-b border-slate-50">
              <TabsList className="bg-slate-100 rounded-xl p-1 h-9">
                <TabsTrigger value="all" className="rounded-lg px-4 text-[8px] font-black uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">All Orders</TabsTrigger>
                <TabsTrigger value="manual" className="rounded-lg px-4 text-[8px] font-black uppercase data-[state=active]:bg-orange-500 data-[state=active]:text-white">Manual Needs Action</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="all" className="mt-0"><OrderTable data={orders} /></TabsContent>
            <TabsContent value="manual" className="mt-0"><OrderTable data={orders.filter(o => o.type === 'Manual' && o.status === 'Pending')} /></TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
