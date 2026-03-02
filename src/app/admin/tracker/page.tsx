
"use client";

import { useState, useEffect } from "react";
import { 
  collectionGroup, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc 
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
import { format, isValid } from "date-fns";
import { ChevronLeft, RefreshCw, ExternalLink, Copy, Download, AlertTriangle } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";

export default function TrackerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && (!user || user.email !== "chetanmadhav4@gmail.com")) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!user || !db || user.email !== "chetanmadhav4@gmail.com") return;

    const q = query(collectionGroup(db, "orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        
        // Robust date parsing for Firestore Timestamps or ISO Strings
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else {
            const parsed = new Date(data.createdAt);
            if (isValid(parsed)) createdAt = parsed;
          }
        }

        return {
          id: doc.id,
          path: doc.ref.path,
          ...data,
          createdAt
        };
      });
      setOrders(ords);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Tracker Error:", err);
      if (err.message?.includes("index")) {
        setError("Missing Index: Please visit the Firebase Console link in your error log to enable collectionGroup indexing.");
      } else {
        const contextualError = new FirestorePermissionError({
          path: 'orders (collectionGroup)',
          operation: 'list'
        });
        errorEmitter.emit('permission-error', contextualError);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, db]);

  const updateStatus = async (orderPath: string, status: string) => {
    if (!db) return;
    const orderRef = doc(db, orderPath);
    updateDoc(orderRef, { status })
      .then(() => {
        toast({ title: "Updated", description: `Order status set to ${status}` });
      })
      .catch((err) => {
        const contextualError = new FirestorePermissionError({
          path: orderPath,
          operation: 'update',
          requestResourceData: { status }
        });
        errorEmitter.emit('permission-error', contextualError);
      });
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const exportOrders = () => {
    const csv = [
      ["Order ID", "Platform", "Service", "Link", "Quantity", "Price", "UTR ID", "Status", "Date"].join(","),
      ...orders.map(o => [
        o.id, 
        o.platform || 'N/A', 
        o.service || 'N/A', 
        `"${o.link || ''}"`, 
        o.quantity || 0, 
        o.price || 0, 
        o.utrId || 'N/A', 
        o.status || 'Pending', 
        isValid(o.createdAt) ? o.createdAt.toISOString() : ''
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `socialboost_tracker_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
            <button 
              onClick={() => router.push("/admin")}
              className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#111B21]">LIVE TRACKER</h1>
              <p className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">Approve & Reject Orders</p>
            </div>
          </div>
          <Button onClick={exportOrders} className="bg-emerald-500 hover:bg-emerald-600 rounded-2xl h-12 px-6 text-[11px] font-black uppercase tracking-widest gap-2 shadow-lg">
            <Download size={16} /> Export Logs
          </Button>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] flex items-center gap-4 text-red-600 font-bold text-sm">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        <main className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Timestamp</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Service</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Link</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">UTR ID</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Status</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-[11px] font-bold text-slate-400 uppercase">
                      {isValid(order.createdAt) ? (
                        <>
                          {format(order.createdAt, 'MMM dd')}<br/>
                          {format(order.createdAt, 'HH:mm')}
                        </>
                      ) : 'Invalid Date'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black uppercase text-[10px] text-blue-600">{order.platform || 'Platform'}</span>
                        <span className="text-sm font-bold text-slate-800">{order.service || 'N/A'} ({order.quantity || 0})</span>
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
                      <code className="bg-slate-100 px-3 py-1 rounded-lg text-[11px] font-black text-[#111B21]">
                        {order.utrId || 'N/A'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        order.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-600 border-none' : 
                        order.status === 'Processing' ? 'bg-blue-500/10 text-blue-600 border-none' :
                        order.status === 'Cancelled' ? 'bg-red-500/10 text-red-600 border-none' :
                        'bg-emerald-500/10 text-emerald-600 border-none'
                      }>
                        {order.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select defaultValue={order.status || 'Pending'} onValueChange={(val) => updateStatus(order.path, val)}>
                        <SelectTrigger className="w-[120px] h-10 bg-white border-slate-200 rounded-xl text-[10px] font-black uppercase">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending" className="text-[10px] font-black uppercase">Pending</SelectItem>
                          <SelectItem value="Processing" className="text-[10px] font-black uppercase">Processing</SelectItem>
                          <SelectItem value="Completed" className="text-[10px] font-black uppercase text-emerald-600">Completed</SelectItem>
                          <SelectItem value="Cancelled" className="text-[10px] font-black uppercase text-red-600">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-slate-400 font-bold uppercase text-xs tracking-widest">
                      No orders found in the database.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>
    </div>
  );
}
