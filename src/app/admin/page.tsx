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
import { format } from "date-fns";
import { Download, RefreshCw, LayoutDashboard, LogOut, ExternalLink, Copy, CheckCircle } from "lucide-react";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && (!user || user.email !== "chetanmadhav4@gmail.com")) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!user || !db) return;

    // Use collectionGroup to fetch all orders across all users
    const q = query(collectionGroup(db, "orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map(doc => ({
        id: doc.id,
        path: doc.ref.path,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      setOrders(ords);
      setLoading(false);
    }, (error) => {
      const contextualError = new FirestorePermissionError({
        path: 'orders (collectionGroup)',
        operation: 'list'
      });
      errorEmitter.emit('permission-error', contextualError);
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
      .catch((error) => {
        const contextualError = new FirestorePermissionError({
          path: orderPath,
          operation: 'update',
          requestResourceData: { status }
        });
        errorEmitter.emit('permission-error', contextualError);
      });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const exportOrders = () => {
    const csv = [
      ["Order ID", "User ID", "Platform", "Service", "Link", "Quantity", "Price", "UTR ID", "Status", "Date"].join(","),
      ...orders.map(o => [
        o.id, o.userId, o.platform, o.service, o.link, o.quantity, o.price, o.utrId, o.status, o.createdAt.toISOString()
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `socialboost_orders_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <RefreshCw className="animate-spin text-red-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-body">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
              <LayoutDashboard className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Admin Control</h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Order Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={exportOrders} className="rounded-xl border-slate-700 bg-slate-800 hover:bg-slate-700 text-[11px] font-black uppercase tracking-widest px-6 h-11 gap-2">
              <Download size={16} /> Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => auth?.signOut()} className="rounded-xl text-red-400 hover:text-red-300 hover:bg-red-950/30 text-[11px] font-black uppercase tracking-widest px-6 h-11 gap-2">
              <LogOut size={16} /> Sign Out
            </Button>
          </div>
        </header>

        <main className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-950">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Date</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Service Info</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Order Details</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Target Link</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Payment UTR</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Status</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <TableCell className="text-[11px] font-bold text-slate-500 uppercase">
                      {format(order.createdAt, 'MMM dd')}<br/>
                      {format(order.createdAt, 'HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black uppercase text-[10px] text-red-500">{order.platform}</span>
                        <span className="text-sm font-bold">{order.service}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-400">Qty: {order.quantity}</span>
                        <span className="text-sm font-black text-green-500">₹{order.price?.toFixed(0)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="max-w-[150px] truncate text-[11px] font-bold text-blue-400">
                          {order.link}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(order.link, "Link")}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                          <Copy size={12} />
                        </button>
                        <a href={order.link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-slate-800 px-3 py-1 rounded-lg text-[11px] font-black tracking-tighter text-yellow-500">
                          {order.utrId || 'N/A'}
                        </code>
                        {order.utrId && (
                          <button 
                            onClick={() => copyToClipboard(order.utrId, "UTR ID")}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        order.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30 font-black text-[10px] uppercase rounded-lg px-3 py-1' : 
                        order.status === 'Processing' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30 font-black text-[10px] uppercase rounded-lg px-3 py-1' :
                        order.status === 'Cancelled' ? 'bg-red-500/20 text-red-500 border-red-500/30 font-black text-[10px] uppercase rounded-lg px-3 py-1' :
                        'bg-green-500/20 text-green-500 border-green-500/30 font-black text-[10px] uppercase rounded-lg px-3 py-1'
                      }>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select defaultValue={order.status} onValueChange={(val) => updateStatus(order.path, val)}>
                        <SelectTrigger className="w-[140px] h-10 bg-slate-950 border-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          <SelectItem value="Pending" className="text-[11px] font-black uppercase">Pending</SelectItem>
                          <SelectItem value="Processing" className="text-[11px] font-black uppercase">Processing</SelectItem>
                          <SelectItem value="Completed" className="text-[11px] font-black uppercase text-green-500">Completed</SelectItem>
                          <SelectItem value="Cancelled" className="text-[11px] font-black uppercase text-red-500">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {orders.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                <RefreshCw size={48} className="text-slate-700 mb-2" />
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">No orders discovered in the database</p>
              </div>
            )}
          </div>
        </main>
      </div>
      <footer className="mt-12 text-center">
        <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.8em]">
          SOCIALBOOST CORE DASHBOARD v2.5
        </p>
      </footer>
    </div>
  );
}
