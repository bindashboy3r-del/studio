
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  where,
  limit,
  onSnapshot,
  doc,
  writeBatch,
  increment,
  getDoc,
  getDocs,
  Timestamp
} from "firebase/firestore";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Send, 
  History as HistoryIcon,
  X,
  Zap,
  Wallet,
  PlusCircle,
  Share2,
  Instagram,
  MessageCircle,
  Loader2,
  Bell,
  MessageSquareText,
  Package,
  Clock,
  Copy,
  ChevronLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SMMService, Platform } from "@/app/lib/constants";
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { subDays, format, isValid, isAfter } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type ChatState = 
  | 'idle' 
  | 'initial'
  | 'choosing_order_type'
  | 'choosing_service' 
  | 'entering_quantity' 
  | 'choosing_payment_method';

interface OrderItem {
  service: SMMService;
  quantity: number;
  link: string;
}

interface OrderInProgress {
  type: 'single' | 'combo' | 'bulk';
  platform: Platform;
  items: OrderItem[];
  bulkLinks?: string[];
}

export default function ChatPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [currentOrder, setCurrentOrder] = useState<OrderInProgress>({
    type: 'single',
    platform: 'instagram',
    items: []
  });
  
  // Dialog States
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [showSocialMenu, setShowSocialMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [sessionStart, setSessionStart] = useState<Timestamp | null>(null);
  
  const hasInitialGreeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const keepSession = sessionStorage.getItem('keepChatSession') === 'true';
    let sessionTimeStr = sessionStorage.getItem('chatSessionStartTime');
    if (!keepSession || !sessionTimeStr) {
      const now = new Date();
      sessionTimeStr = now.toISOString();
      sessionStorage.setItem('chatSessionStartTime', sessionTimeStr);
    }
    setSessionStart(Timestamp.fromDate(new Date(sessionTimeStr)));
    sessionStorage.removeItem('keepChatSession');
  }, []);

  useEffect(() => {
    if (!isUserLoading && !currentUser) router.push("/");
  }, [currentUser, isUserLoading, router]);

  // Dynamic Services
  const servicesQuery = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db, currentUser]);
  const { data: rawDynamicServices } = useCollection<SMMService>(servicesQuery);

  const dynamicServices = useMemo(() => {
    if (!rawDynamicServices) return [];
    return [...rawDynamicServices].filter(s => s.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawDynamicServices]);

  // Wallet Balance
  const userDocRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, "users", currentUser.uid);
  }, [db, currentUser]);
  const { data: userData } = useDoc(userDocRef);
  const walletBalance = userData?.balance || 0;

  // Global Sync
  useEffect(() => {
    if (!db || !currentUser) return; 
    const unsubBroadcast = onSnapshot(query(collection(db, "globalAnnouncements"), where("active", "==", true), limit(1)), (snap) => {
      if (!snap.empty) setActiveBroadcast(snap.docs[0].data());
      else setActiveBroadcast(null);
    });
    const unsubDiscounts = onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setGlobalDiscounts({ single: Number(d.single) || 0, combo: Number(d.combo) || 0, bulk: Number(d.bulk) || 0 });
      }
    });
    const unsubSocial = onSnapshot(doc(db, "globalSettings", "social"), (snap) => {
      if (snap.exists()) setSocialLinks(snap.data());
    });
    const unsubNotifs = onSnapshot(query(collection(db, "users", currentUser.uid, "notifications"), orderBy("createdAt", "desc"), limit(50)), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((n: any) => n.read === false);
      setNotifications(items);
    });
    return () => { unsubBroadcast(); unsubDiscounts(); unsubSocial(); unsubNotifs(); };
  }, [db, currentUser]);

  // Orders Query for Popup
  const userOrdersQuery = useMemoFirebase(() => {
    if (!db || !currentUser || !isOrdersOpen) return null;
    return collection(db, "users", currentUser.uid, "orders");
  }, [db, currentUser, isOrdersOpen]);
  const { data: rawOrders } = useCollection(userOrdersQuery);
  const userOrders = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.map(o => {
      let createdAt = new Date();
      if (o.createdAt?.toDate) createdAt = o.createdAt.toDate();
      let effectiveStatus = o.status || 'Pending';
      return { ...o, createdAt, effectiveStatus };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [rawOrders]);

  // Chat Logs Query for Popup
  const chatLogsQuery = useMemoFirebase(() => {
    if (!db || !currentUser || !isLogsOpen) return null;
    return query(collection(db, "users", currentUser.uid, "chatMessages"), orderBy("timestamp", "desc"), limit(100));
  }, [db, currentUser, isLogsOpen]);
  const { data: rawLogs } = useCollection(chatLogsQuery);

  // Messages for Current Session
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !currentUser || !sessionStart) return null;
    return query(
      collection(db, "users", currentUser.uid, "chatMessages"), 
      where("timestamp", ">=", sessionStart),
      orderBy("timestamp", "asc")
    );
  }, [db, currentUser, sessionStart]);
  const { data: messages, isLoading: isMessagesLoading } = useCollection(messagesQuery);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const addMessage = async (sender: 'user' | 'bot', text: string, options?: string[], extraData?: any) => {
    if (!currentUser || !db) return;
    addDoc(collection(db, "users", currentUser.uid, "chatMessages"), { 
      userId: currentUser.uid, 
      sender, 
      text, 
      options: options || [], 
      timestamp: serverTimestamp(), 
      ...extraData 
    });
  };

  const botReply = async (text: string, options?: string[], extraData?: any) => {
    setIsTyping(true);
    setTimeout(async () => {
      await addMessage('bot', text, options, extraData);
      setIsTyping(false);
    }, 800);
  };

  useEffect(() => {
    if (currentUser && !isMessagesLoading && !hasInitialGreeted.current && sessionStart) {
      hasInitialGreeted.current = true;
      if (!messages || messages.length === 0) {
        setChatState('initial');
        botReply("👋 Welcome to SocialBoost! Automation Active. Type 'Hi' to begin. 🚀");
      }
    }
  }, [currentUser, isMessagesLoading, messages, sessionStart]);

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !currentUser) return;
    if (!manualText) setInputValue("");

    // Special Commands from Button Pay
    if (text.startsWith("SUBMIT_PAYMENT:")) {
      const [, link, utr] = text.split(":");
      await addMessage('user', `Payment Submitted (UTR: ${utr})`);
      botReply(`✅ Details Submitted!\n\n🔗 Link: ${link}\n🔢 UTR: ${utr}\n\nAdmin 30-60 mins mein verify karke order start kar denge. Status check karte rahein. 🚀`);
      setChatState('idle');
      return;
    }

    if (text.startsWith("CONFIRM_WALLET:")) {
      await addMessage('user', "Confirming Wallet Payment...");
      const s = currentOrder.items[0]?.service;
      const qty = currentOrder.items[0]?.quantity;
      const price = (qty / 1000) * (s.pricePer1000 || 0) * (1 - globalDiscounts.single / 100);
      
      if (walletBalance >= price) {
        const batch = writeBatch(db);
        const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
        const userOrderRef = doc(collection(db, "users", currentUser.uid, "orders"));
        
        batch.update(userDocRef!, { balance: increment(-price) });
        batch.set(userOrderRef, {
          orderId,
          service: s.name,
          quantity: qty,
          price,
          status: 'Pending',
          platform: 'instagram',
          createdAt: serverTimestamp(),
          autoCompleteAt: null
        });
        
        await batch.commit();
        botReply(`🎉 Order Placed Successfully!\n\n🆔 Order ID: ${orderId}\n💰 Paid: ₹${price.toFixed(2)}\n\nOrder process ho raha hai. Check 'Orders' for updates.`);
        setChatState('idle');
      } else {
        botReply("❌ Low Balance! Please refill your wallet.");
      }
      return;
    }

    await addMessage('user', text);
    const cleanText = text.toLowerCase();

    if (cleanText.includes("order") || cleanText === 'hi' || cleanText === 'menu') {
      setChatState('choosing_order_type');
      botReply("Choose your boost style:", [
        `1. SINGLE ORDER (${globalDiscounts.single}% OFF)`, 
        `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)`, 
        `3. BULK ORDER (${globalDiscounts.bulk}% OFF)`
      ]);
      return;
    }

    if (cleanText.includes("single")) {
      setChatState('choosing_service'); 
      setCurrentOrder({ type: 'single', platform: 'instagram', items: [] });
      botReply(`Pick a Service. You get ${globalDiscounts.single}% OFF!`, dynamicServices.map((s, i) => `${i + 1}. ${s.name}`));
      return;
    }

    const serviceMatch = dynamicServices.find((s, i) => cleanText === (i + 1).toString() || cleanText.includes(s.name.toLowerCase()));
    if (serviceMatch && chatState === 'choosing_service') {
      setCurrentOrder(p => ({ ...p, items: [{ service: serviceMatch, quantity: 0, link: '' }] }));
      setChatState('entering_quantity');
      botReply(`📊 Enter Quantity for ${serviceMatch.name}?\n(Minimum: ${serviceMatch.minQuantity})`);
      return;
    }

    if (chatState === 'entering_quantity') {
      const qty = parseInt(text);
      const s = currentOrder.items[0]?.service;
      if (s && qty >= s.minQuantity) {
        const updated = [{ service: s, quantity: qty, link: '' }];
        setCurrentOrder(p => ({ ...p, items: updated }));
        setChatState('choosing_payment_method');
        const raw = (qty / 1000) * (s.pricePer1000 || 0);
        const disc = globalDiscounts.single;
        const discounted = raw * (1 - disc / 100);
        
        const summary = `✅ ORDER SUMMARY\n───────────────\nOriginal Price: ₹${raw.toFixed(2)}\nDiscount Applied: ${disc}%\n🔥 You Pay: ₹${discounted.toFixed(2)}\n───────────────\n💳 Wallet Balance: ₹${walletBalance.toFixed(0)}`;
        
        botReply(summary, ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"], { 
          rawPrice: raw, 
          paymentPrice: discounted, 
          discountPct: disc 
        });
      } else if (s) botReply(`⚠️ Error: Minimum ${s.minQuantity} required.`);
      return;
    }

    if (chatState === 'choosing_payment_method') {
      const s = currentOrder.items[0]?.service;
      const qty = currentOrder.items[0]?.quantity;
      const raw = (qty / 1000) * (s.pricePer1000 || 0);
      const discounted = raw * (1 - globalDiscounts.single / 100);

      if (cleanText.includes("wallet")) {
        if (walletBalance >= discounted) botReply(`Confirm Wallet Payment of ₹${discounted.toFixed(2)}?`, [], { 
          isWalletCard: true, 
          paymentPrice: discounted, 
          rawPrice: raw, 
          discountPct: globalDiscounts.single,
          serviceName: s?.name,
          quantity: qty
        });
        else botReply("❌ Low Balance! Please refill your wallet.", ["💳 ADD FUNDS", "🏠 MENU"]);
      } else if (cleanText.includes("upi")) {
        botReply(`Scan the QR to Pay:`, [], { 
          isPaymentCard: true, 
          paymentPrice: discounted, 
          rawPrice: raw, 
          discountPct: globalDiscounts.single,
          serviceName: s?.name,
          quantity: qty
        });
      }
    }
  };

  const handleClearNotifs = async () => {
    if (!db || !currentUser) return;
    const batch = writeBatch(db);
    notifications.forEach(n => batch.update(doc(db, "users", currentUser.uid, "notifications", n.id), { read: true }));
    await batch.commit();
    setIsNotifOpen(false);
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative whatsapp-bg font-body">
      {/* 3D Header */}
      <header className="glass-header px-4 py-3 flex items-center justify-between shadow-3d-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#312ECB] flex items-center justify-center text-white shadow-3d-sm"><Zap className="fill-current" size={18} /></div>
          <h1 className="text-[18px] font-black italic tracking-tighter text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Notification Dialog */}
          <button onClick={() => setIsNotifOpen(true)} className="relative p-2 text-slate-400 rounded-xl shadow-3d-sm active:shadow-3d-pressed">
            <Bell size={20} />
            {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900" />}
          </button>
          <button onClick={() => router.push('/profile')} className="w-9 h-9 rounded-2xl bg-slate-800 text-white font-black text-sm shadow-3d-sm border border-white/5 active:shadow-3d-pressed">
            {currentUser?.displayName?.[0] || 'U'}
          </button>
        </div>
      </header>

      {/* Sub Header (Balance & Links) */}
      <div className="bg-slate-900/50 backdrop-blur-md px-4 py-2 flex items-center justify-between border-b border-white/5 z-40">
        <button onClick={() => router.push('/add-funds')} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 shadow-3d-sm active:shadow-3d-pressed">
          <Wallet size={14} /><span className="text-[11px] font-black">₹{walletBalance.toFixed(0)}</span><PlusCircle size={14} />
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsOrdersOpen(true)} className="text-[10px] font-black uppercase text-[#312ECB] flex items-center gap-1.5 shadow-3d-sm rounded-xl px-3 py-1.5 active:shadow-3d-pressed">
            <HistoryIcon size={14} /> ORDERS
          </button>
          <button onClick={() => setIsLogsOpen(true)} className="text-[10px] font-black uppercase text-pink-500 flex items-center gap-1.5 shadow-3d-sm rounded-xl px-3 py-1.5 active:shadow-3d-pressed">
            <MessageSquareText size={14} /> HISTORY
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col relative pb-24 custom-scrollbar">
        {messages?.map(m => (
          <MessageBubble 
            key={m.id} 
            sender={m.sender} 
            text={m.text} 
            options={m.options} 
            onOptionClick={handleSend} 
            isPaymentCard={m.isPaymentCard} 
            paymentPrice={m.paymentPrice} 
            rawPrice={m.rawPrice}
            isWalletCard={m.isWalletCard} 
            timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} 
            dynamicServices={dynamicServices} 
            discountPct={m.discountPct ?? 0} 
            serviceName={m.serviceName}
            quantity={m.quantity}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />

        {/* Small Floating Social Button (Bottom Left) */}
        <div className="fixed bottom-24 left-4 z-50 flex flex-col items-start gap-3">
          {showSocialMenu && (
            <div className="flex flex-col gap-3 mb-2 animate-in slide-in-from-bottom-5">
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" className="w-8 h-8 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-3d">
                  <Instagram size={16} />
                </a>
              )}
              {socialLinks?.whatsapp && (
                <a href={socialLinks.whatsapp} target="_blank" className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center text-white shadow-3d">
                  <MessageCircle size={16} />
                </a>
              )}
            </div>
          )}
          <button 
            onClick={() => setShowSocialMenu(!showSocialMenu)} 
            className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-3d transition-all active:shadow-3d-pressed", showSocialMenu ? "bg-red-500 rotate-90" : "bg-[#312ECB]")}
          >
            {showSocialMenu ? <X size={20} /> : <Share2 size={20} />}
          </button>
        </div>
      </main>

      {/* 3D Input Footer */}
      <footer className="p-4 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 z-50">
        <div className="flex items-center gap-3 bg-slate-950 rounded-[1.8rem] p-1.5 shadow-3d-pressed">
          <Input 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && handleSend()} 
            placeholder="Type your Request..." 
            className="flex-1 bg-transparent border-none font-bold text-sm h-11 focus-visible:ring-0 text-white placeholder:text-slate-600" 
          />
          <Button onClick={() => handleSend()} size="icon" className="rounded-2xl h-10 w-10 bg-[#312ECB] hover:bg-[#2825A6] shadow-3d active:shadow-3d-pressed">
            <Send size={18} />
          </Button>
        </div>
      </footer>

      {/* POPUP: Notifications */}
      <Dialog open={isNotifOpen} onOpenChange={setIsNotifOpen}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-3d bg-[#030712] p-0 overflow-hidden">
          <header className="bg-[#312ECB] p-6 text-white">
             <div className="flex items-center justify-between">
                <DialogTitle className="text-white font-black uppercase text-xs flex items-center gap-2"><Bell size={16} /> Notifications</DialogTitle>
                <Button onClick={handleClearNotifs} variant="ghost" className="h-7 text-[8px] font-black uppercase bg-white/10 rounded-lg px-2">Clear All</Button>
             </div>
          </header>
          <ScrollArea className="h-[400px] p-4">
             <div className="space-y-3">
                {notifications.length > 0 ? notifications.map(n => (
                  <div key={n.id} onClick={handleClearNotifs} className="bg-slate-900 p-4 rounded-2xl shadow-3d-sm border border-white/5 flex items-start gap-3 cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB] shrink-0"><Zap size={14} /></div>
                    <div className="space-y-0.5"><p className="text-[11px] font-black">{n.title}</p><p className="text-[10px] font-bold text-slate-400">{n.message}</p></div>
                  </div>
                )) : <div className="flex flex-col items-center justify-center py-20 opacity-20"><Bell size={40} /><p className="text-[10px] font-black uppercase mt-4">Inbox Clear</p></div>}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* POPUP: Order History */}
      <Dialog open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
        <DialogContent className="max-w-[360px] rounded-[2.5rem] border-none shadow-3d bg-[#F0F2F5] dark:bg-[#030712] p-0 overflow-hidden">
          <header className="bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-gray-100">
             <DialogTitle className="text-[10px] font-black uppercase tracking-[0.2em]"><Package size={16} className="inline mr-2" /> Order History</DialogTitle>
          </header>
          <ScrollArea className="h-[500px] p-4">
             <div className="space-y-3">
                {userOrders.length > 0 ? userOrders.map((order: any) => {
                  const displayId = order.orderId || order.id.slice(0, 8).toUpperCase();
                  return (
                    <div key={order.id} className="bg-white dark:bg-slate-900 p-4 rounded-[1.2rem] shadow-3d-sm border border-gray-50 flex flex-col gap-1.5">
                       <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-black uppercase text-[#312ECB] truncate max-w-[180px]">{order.service}</h3>
                          <Badge className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400">#{displayId}</Badge>
                       </div>
                       <div className="flex items-center gap-2.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Qty: {order.quantity}</span>
                          <span className="text-[9px] font-black text-emerald-600">₹{order.price?.toFixed(2)}</span>
                          <Badge className={cn("ml-auto text-[8px] h-4.5 font-black px-2 border-none rounded-md", order.effectiveStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>{order.effectiveStatus}</Badge>
                       </div>
                    </div>
                  );
                }) : <div className="text-center py-20 opacity-20"><Package size={40} className="mx-auto" /><p className="text-[10px] font-black uppercase mt-4">No Orders</p></div>}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* POPUP: Chat History (Logs) */}
      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="max-w-[360px] rounded-[2.5rem] border-none shadow-3d bg-[#F0F2F5] dark:bg-[#030712] p-0 overflow-hidden">
          <header className="bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-gray-100">
             <DialogTitle className="text-[10px] font-black uppercase tracking-[0.2em]"><MessageSquareText size={16} className="inline mr-2" /> Chat Logs</DialogTitle>
          </header>
          <ScrollArea className="h-[500px] p-4">
             <div className="space-y-3">
                {rawLogs?.map((log: any) => (
                  <div key={log.id} className={cn("p-3 rounded-2xl shadow-3d-sm border flex flex-col gap-1", log.sender === 'bot' ? "bg-white dark:bg-slate-900 ml-0 mr-8" : "bg-emerald-50 dark:bg-emerald-950/20 ml-8 mr-0")}>
                     <div className="flex items-center justify-between">
                        <span className={cn("text-[7px] font-black uppercase tracking-widest", log.sender === 'bot' ? "text-[#312ECB]" : "text-emerald-600")}>{log.sender === 'bot' ? 'Assistant' : 'You'}</span>
                        <span className="text-[7px] font-bold text-slate-400">{log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm') : ''}</span>
                     </div>
                     <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed">{log.text}</p>
                  </div>
                ))}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
