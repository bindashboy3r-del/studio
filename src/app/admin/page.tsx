
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
import { Download, RefreshCw, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function AdminDashboard() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && (!user || !user.email)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!user || !db) return;

    // Path matches firestore.rules: users/{userId}/orders/{orderId}
    // We use collectionGroup to fetch all orders across all users
    const q = query(collectionGroup(db, "orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map(doc => ({
        id: doc.id,
        path: doc.ref.path, // Store the full path for updates
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
    // We must use the full path to update documents in subcollections
    const orderRef = doc(db, orderPath);
    updateDoc(orderRef, { status })
      .catch((error) => {
        const contextualError = new FirestorePermissionError({
          path: orderPath,
          operation: 'update',
          requestResourceData: { status }
        });
        errorEmitter.emit('permission-error', contextualError);
      });
  };

  const exportOrders = () => {
    const csv = [
      ["Order ID", "User ID", "Platform", "Service", "Link", "Quantity", "Price", "Status", "Date"].join(","),
      ...orders.map(o => [
        o.id, o.userId, o.platform, o.service, o.link, o.quantity, o.price, o.status, o.createdAt.toISOString()
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `orders_${new Date().toISOString()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <RefreshCw className="animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="text-primary w-8 h-8" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={exportOrders} className="gap-2 border-slate-700 bg-slate-800 hover:bg-slate-700">
              <Download size={16} /> Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => auth?.signOut()} className="text-red-400 hover:text-red-300 hover:bg-red-950/30">
              <LogOut size={16} /> Sign Out
            </Button>
          </div>
        </header>

        <main className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <Table>
            <TableHeader className="bg-slate-950">
              <TableRow className="border-slate-800">
                <TableHead>Date</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <TableCell className="text-xs text-slate-400">
                    {format(order.createdAt, 'MMM dd, HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold uppercase text-[10px] text-primary">{order.platform}</span>
                      <span className="text-sm">{order.service}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    <a href={order.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs">
                      {order.link}
                    </a>
                  </TableCell>
                  <TableCell>{order.quantity}</TableCell>
                  <TableCell>${order.price ? order.price.toFixed(2) : '0.00'}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === 'Completed' ? 'default' : 'secondary'} className={
                      order.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' : 
                      order.status === 'Processing' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' :
                      order.status === 'Cancelled' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                      'bg-green-500/20 text-green-500 border-green-500/30'
                    }>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select defaultValue={order.status} onValueChange={(val) => updateStatus(order.path, val)}>
                      <SelectTrigger className="w-[130px] h-8 bg-slate-950 border-slate-700 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Processing">Processing</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {orders.length === 0 && (
            <div className="p-12 text-center text-slate-500 font-medium">
              No orders found yet.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
