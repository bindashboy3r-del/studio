
"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  Timestamp,
  addDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  Zap, 
  Wallet, 
  PlusCircle, 
  Bell, 
  Package, 
  Gift, 
  LayoutGrid, 
  ShoppingCart,
  ChevronRight,
  TrendingUp,
  History,
  Info,
  Clock,
  CheckCircle2,
  X,
  CreditCard,
  QrCode,
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { SMMService, PLATFORMS } from "@/app/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/BottomNav";

export default function DashboardPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // States
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  // Auth Protection
  useEffect(() => {
    if (!isUserLoading && !currentUser) router.push("/");
  }, [currentUser, isUserLoading, router]);

  // Data Fetching
  const { data: userData } = useDoc(useMemoFirebase(() => currentUser && db ? doc(db, "users", currentUser.uid) : null, [db, currentUser]));
  const walletBalance = userData?.balance || 0;

  useEffect(() => {
    if (!db || !currentUser) return;

    // Broadcasts
    const unsubBroadcast = onSnapshot(query(collection(db, "globalAnnouncements"), orderBy("timestamp", "desc")), (snap) => {
      if (!snap.empty) setActiveBroadcast(snap.docs[0].data());
    });

    // Global Discounts
    onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) setGlobalDiscounts({ 
        single: snap.data().single || 0, 
        combo: snap.data().combo || 0, 
        bulk: snap.data().bulk || 0 
      });
    });

    // Notifications
    const qNotif = query(collection(db, "users", currentUser.uid, "notifications"), orderBy("createdAt", "desc"));
    onSnapshot(qNotif, (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Recent Orders
    const qOrders = query(collection(db, "users", currentUser.uid, "orders"), orderBy("createdAt", "desc"));
    onSnapshot(qOrders, (snap) => setRecentOrders(snap.docs.slice(0, 3).map(d => ({ id: d.id, ...d.data() }))));

    return () => unsubBroadcast();
  }, [db, currentUser]);

  const markAllRead = async () => {
    if (!db || !currentUser) return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
      if (!n.read) batch.update(doc(db, "users", currentUser.uid, "notifications", n.id), { read: true });
    });
    await batch.commit();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-[#030712]"><Zap className="animate-pulse text-[#312ECB]" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#030712] font-body text-slate-100 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#312ECB] flex items-center justify-center text-white shadow-lg">
            <Zap size={20} className="fill-current" />
          </div>
          <div>
            <h1 className="text-base font-black italic tracking-tighter text-white uppercase">SOCIALBOOST</h1>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Premium SMM Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { markAllRead(); setIsNotifOpen(true); }} 
            className="relative p-2.5 bg-white/5 rounded-xl border border-white/5 text-slate-400"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-[#030712]">
                {unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => router.push('/profile')} className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-white font-black text-sm uppercase">
            {currentUser?.displayName?.[0] || 'U'}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-6">
        {/* Wallet Card */}
        <div className="bg-gradient-to-br from-[#312ECB] to-[#1E1B8F] rounded-[2.5rem] p-7 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Available Balance</p>
                <h2 className="text-4xl font-black italic tracking-tight">₹{walletBalance.toFixed(2)}</h2>
              </div>
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Wallet size={24} />
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={() => router.push('/add-funds')}
                className="flex-1 h-14 bg-white text-[#312ECB] hover:bg-slate-50 rounded-2xl font-black text-xs uppercase tracking-widest gap-2 shadow-xl"
              >
                <PlusCircle size={18} /> Add Money
              </Button>
              <Button 
                onClick={() => router.push('/refer')}
                className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest gap-2 shadow-xl"
              >
                <Gift size={18} /> Refer & Earn
              </Button>
            </div>
          </div>
          {/* Decorative shapes */}
          <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-5%] w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl" />
        </div>

        {/* Global Announcement */}
        {activeBroadcast && activeBroadcast.active && (
          <div className="bg-slate-900 border border-white/5 rounded-[1.8rem] p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <Info size={20} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-200 leading-relaxed">{activeBroadcast.text}</p>
              {activeBroadcast.buttonUrl && (
                <button 
                  onClick={() => window.open(activeBroadcast.buttonUrl, '_blank')}
                  className="mt-2 text-[10px] font-black text-[#312ECB] uppercase tracking-widest flex items-center gap-1"
                >
                  {activeBroadcast.buttonText || 'Learn More'} <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => router.push('/new-order')}
            className="bg-white/5 hover:bg-white/10 border border-white/5 p-6 rounded-[2rem] text-left transition-all active:scale-95 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#312ECB]/20 text-[#312ECB] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ShoppingCart size={24} />
            </div>
            <h3 className="text-sm font-black uppercase text-white">New Order</h3>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Start growing now</p>
          </button>
          
          <button 
            onClick={() => router.push('/orders')}
            className="bg-white/5 hover:bg-white/10 border border-white/5 p-6 rounded-[2rem] text-left transition-all active:scale-95 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <History size={24} />
            </div>
            <h3 className="text-sm font-black uppercase text-white">History</h3>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Track your orders</p>
          </button>
        </div>

        {/* Quick Stats & Offers */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1">Exclusive Offers</h4>
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <div>
                <h5 className="text-[13px] font-black uppercase text-white">60% Deposit Bonus</h5>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">On every refill today</p>
              </div>
            </div>
            <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase px-3 py-1">LIVE</Badge>
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Recent Activity</h4>
            <button onClick={() => router.push('/orders')} className="text-[9px] font-black text-[#312ECB] uppercase">View All</button>
          </div>
          
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      order.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {order.status === 'Completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-white truncate uppercase">{order.service}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">#{order.orderId || order.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-white">₹{order.price?.toFixed(2)}</p>
                    <p className={cn(
                      "text-[8px] font-black uppercase mt-1",
                      order.status === 'Completed' ? "text-emerald-500" : "text-blue-500"
                    )}>{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/5 rounded-[2rem] py-12 flex flex-col items-center justify-center opacity-30">
              <Package size={40} className="mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest">No activity yet</p>
            </div>
          )}
        </div>
      </main>

      {/* Notifications Drawer */}
      <Dialog open={isNotifOpen} onOpenChange={setIsNotifOpen}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-2xl bg-slate-950 p-0 overflow-hidden">
          <header className="bg-[#312ECB] p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={20} />
              <DialogTitle className="font-black uppercase text-sm tracking-widest">Inbox</DialogTitle>
            </div>
            <button onClick={() => setIsNotifOpen(false)}><X size={20} /></button>
          </header>
          <ScrollArea className="h-[400px] p-5">
            {notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map((n) => (
                  <div key={n.id} className={cn("p-4 rounded-[1.5rem] border transition-all", n.read ? "bg-slate-900/50 border-white/5" : "bg-white/5 border-[#312ECB]/20 shadow-lg")}>
                    <h4 className="text-[11px] font-black text-[#312ECB] uppercase mb-1">{n.title}</h4>
                    <p className="text-[10px] font-bold text-slate-300 leading-relaxed">{n.message}</p>
                    <p className="text-[7px] font-black text-slate-500 uppercase mt-2">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 opacity-30">
                <Bell size={48} className="mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">No new updates</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Bottom Nav */}
      <BottomNav />
    </div>
  );
}
