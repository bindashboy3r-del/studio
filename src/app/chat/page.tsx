
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
  Bell,
  MessageSquareText,
  Package,
  Megaphone
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SMMService, Platform } from "@/app/lib/constants";
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { placeApiOrder } from "@/app/actions/smm-api";

type ChatState = 
  | 'idle' 
  | 'initial'
  | 'choosing_order_type'
  | 'choosing_service' 
  | 'entering_quantity' 
  | 'entering_bulk_links'
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
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [showSocialMenu, setShowSocialMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [sessionStart, setSessionStart] = useState<Timestamp | null>(null);
  
  const hasInitialGreeted = useRef(false);
  const hasBroadcastShown = useRef(false);
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

  const servicesQuery = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db, currentUser]);
  const { data: rawDynamicServices } = useCollection<SMMService>(servicesQuery);

  const dynamicServices = useMemo(() => {
    if (!rawDynamicServices) return [];
    return [...rawDynamicServices].filter(s => s.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawDynamicServices]);

  const userDocRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, "users", currentUser.uid);
  }, [db, currentUser]);
  const { data: userData } = useDoc(userDocRef);
  const walletBalance = userData?.balance || 0;

  useEffect(() => {
    if (!db || !currentUser) return; 
    
    const unsubBroadcast = onSnapshot(
      query(collection(db, "globalAnnouncements"), where("active", "==", true)), 
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
          docs.sort((a, b) => {
            const timeA = a.timestamp?.toMillis?.() || a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.toMillis?.() || b.timestamp?.seconds || 0;
            return timeB - timeA;
          });
          const latest = docs[0];
          setActiveBroadcast(latest);
          if (!hasBroadcastShown.current) {
            setIsBroadcastOpen(true);
            hasBroadcastShown.current = true;
          }
        }
      }
    );

    const unsubDiscounts = onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setGlobalDiscounts({ single: Number(d.single) || 0, combo: Number(d.combo) || 0, bulk: Number(d.bulk) || 0 });
      }
    });

    const unsubSocial = onSnapshot(doc(db, "globalSettings", "social"), (snap) => {
      if (snap.exists()) setSocialLinks(snap.data());
    });

    const unsubPayment = onSnapshot(doc(db, "globalSettings", "payment"), (snap) => {
      if (snap.exists()) setPaymentConfig(snap.data());
    });

    const unsubNotifs = onSnapshot(collection(db, "users", currentUser.uid, "notifications"), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((n: any) => n.read === false);
      setNotifications(items);
    });

    return () => { unsubBroadcast(); unsubDiscounts(); unsubSocial(); unsubPayment(); unsubNotifs(); };
  }, [db, currentUser]);

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
      return { ...o, createdAt };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [rawOrders]);

  const chatLogsQuery = useMemoFirebase(() => {
    if (!db || !currentUser || !isLogsOpen) return null;
    return query(collection(db, "users", currentUser.uid, "chatMessages"), orderBy("timestamp", "desc"), limit(100));
  }, [db, currentUser, isLogsOpen]);
  const { data: rawLogs } = useCollection(chatLogsQuery);

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

    const cleanText = text.toLowerCase();

    // 1. PAYMENT SUBMISSION (MANUAL/UPI)
    if (text.startsWith("SUBMIT_PAYMENT:")) {
      const [, linksInput, utr] = text.split(":");
      await addMessage('user', `Payment Submitted (UTR: ${utr})`);
      
      const type = currentOrder.type || 'single';
      const disc = globalDiscounts[type] || 0;
      const links = linksInput.split('\n').filter(l => l.trim());
      const numLinks = links.length;

      // Logic for Multi-Link or Combo
      let totalPrice = 0;
      let serviceNames = "";

      if (type === 'combo') {
        const qty = currentOrder.items[0]?.quantity;
        const basePrice = currentOrder.items.reduce((acc, item) => acc + (qty / 1000) * (item.service.pricePer1000 || 0), 0);
        totalPrice = basePrice * (1 - disc / 100);
        serviceNames = "Combo (Likes+Views+Comments)";
      } else {
        const s = currentOrder.items[0]?.service;
        const qty = currentOrder.items[0]?.quantity;
        totalPrice = (qty / 1000) * (s.pricePer1000 || 0) * (1 - disc / 100) * numLinks;
        serviceNames = s.name;
      }

      const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;

      await addDoc(collection(db, "users", currentUser.uid, "orders"), {
        orderId,
        service: serviceNames,
        quantity: currentOrder.items[0]?.quantity,
        price: totalPrice,
        status: 'Pending',
        type: 'Manual',
        links: links,
        utrId: utr,
        platform: 'instagram',
        createdAt: serverTimestamp()
      });

      botReply(`✅ Details Submitted!\n\n🔢 Order ID: #${orderId}\n💰 Amount: ₹${totalPrice.toFixed(2)}\n\nAdmin 30-60 mins mein verify karke order start kar denge. Status check karte rahein. 🚀`);
      setChatState('idle');
      return;
    }

    // 2. WALLET CONFIRMATION
    if (text.startsWith("CONFIRM_WALLET:")) {
      const [, linksInput] = text.split(":");
      await addMessage('user', "Confirming Wallet Payment...");
      
      const type = currentOrder.type || 'single';
      const disc = globalDiscounts[type] || 0;
      const links = linksInput.split('\n').filter(l => l.trim());
      const numLinks = links.length;

      let totalPrice = 0;
      if (type === 'combo') {
        const qty = currentOrder.items[0]?.quantity;
        const basePrice = currentOrder.items.reduce((acc, item) => acc + (qty / 1000) * (item.service.pricePer1000 || 0), 0);
        totalPrice = basePrice * (1 - disc / 100);
      } else {
        const s = currentOrder.items[0]?.service;
        const qty = currentOrder.items[0]?.quantity;
        totalPrice = (qty / 1000) * (s.pricePer1000 || 0) * (1 - disc / 100) * numLinks;
      }
      
      if (walletBalance >= totalPrice) {
        setIsTyping(true);
        try {
          const apiSnap = await getDoc(doc(db, "globalSettings", "api"));
          const apiData = apiSnap.data();
          const batch = writeBatch(db);
          const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;

          // For each item and each link, create an order record
          // In Combo, we place 3 separate API orders
          if (type === 'combo') {
            const qty = currentOrder.items[0].quantity;
            for (const item of currentOrder.items) {
              const mapping = apiData?.mappings?.[item.service.id];
              const provider = apiData?.providers?.find((p: any) => p.id === mapping?.providerId);
              if (provider && mapping?.remoteServiceId) {
                await placeApiOrder({
                  apiUrl: provider.url,
                  apiKey: provider.key,
                  serviceId: mapping.remoteServiceId,
                  link: links[0],
                  quantity: qty
                });
              }
            }
          } else {
            const s = currentOrder.items[0].service;
            const qty = currentOrder.items[0].quantity;
            for (const l of links) {
              const mapping = apiData?.mappings?.[s.id];
              const provider = apiData?.providers?.find((p: any) => p.id === mapping?.providerId);
              if (provider && mapping?.remoteServiceId) {
                await placeApiOrder({
                  apiUrl: provider.url,
                  apiKey: provider.key,
                  serviceId: mapping.remoteServiceId,
                  link: l,
                  quantity: qty
                });
              }
            }
          }

          const userOrderRef = doc(collection(db, "users", currentUser.uid, "orders"));
          batch.update(userDocRef!, { balance: increment(-totalPrice) });
          batch.set(userOrderRef, {
            orderId,
            service: type === 'combo' ? "Combo Bundle" : currentOrder.items[0].service.name,
            quantity: currentOrder.items[0].quantity,
            price: totalPrice,
            status: 'Processing',
            type: 'API',
            links: links,
            platform: 'instagram',
            createdAt: serverTimestamp()
          });
          
          await batch.commit();
          botReply(`🎉 Order Placed Successfully!\n\n🆔 Order ID: ${orderId}\n💰 Paid: ₹${totalPrice.toFixed(2)}\n\nOrder process ho raha hai. Check 'Orders' for updates.`);
          setChatState('idle');
        } catch (e) {
          botReply("❌ Kuch technical issue hua. Admin ko contact karein.");
        } finally {
          setIsTyping(false);
        }
      } else {
        botReply("❌ Low Balance! Please refill your wallet.");
      }
      return;
    }

    await addMessage('user', text);

    // 3. MENU PRIORITY
    if (cleanText === 'hi' || cleanText === 'menu') {
      setChatState('choosing_order_type');
      botReply("Choose your boost style:", [
        `1. SINGLE ORDER (${globalDiscounts.single}% OFF)`, 
        `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)`, 
        `3. BULK ORDER (${globalDiscounts.bulk}% OFF)`
      ]);
      return;
    }

    // 4. FLOW HANDLERS
    if (cleanText.includes("single order") && chatState === 'choosing_order_type') {
      setChatState('choosing_service'); 
      setCurrentOrder({ type: 'single', platform: 'instagram', items: [] });
      botReply(`Pick a Service. You get ${globalDiscounts.single}% OFF!`, dynamicServices.map((s, i) => `${i + 1}. ${s.name}`));
      return;
    }

    if (cleanText.includes("combo order") && chatState === 'choosing_order_type') {
      const likes = dynamicServices.find(s => s.name.toLowerCase().includes('likes'));
      const views = dynamicServices.find(s => s.name.toLowerCase().includes('views'));
      const comments = dynamicServices.find(s => s.name.toLowerCase().includes('comments'));

      if (likes && views && comments) {
        setChatState('entering_quantity'); 
        setCurrentOrder({ 
          type: 'combo', 
          platform: 'instagram', 
          items: [
            { service: likes, quantity: 0, link: '' },
            { service: views, quantity: 0, link: '' },
            { service: comments, quantity: 0, link: '' }
          ] 
        });
        botReply(`🎁 COMBO BUNDLE: Get Likes + Views + Comments at ${globalDiscounts.combo}% OFF!\n\n📊 Enter Quantity for the bundle (Min: 100).`);
      } else {
        botReply("⚠️ Combo services currently unavailable.");
      }
      return;
    }

    if (cleanText.includes("bulk order") && chatState === 'choosing_order_type') {
      setChatState('choosing_service'); 
      setCurrentOrder({ type: 'bulk', platform: 'instagram', items: [] });
      botReply(`🚀 BULK MODE: Pick a Service to apply to MULTIPLE links. You get ${globalDiscounts.bulk}% OFF!`, dynamicServices.map((s, i) => `${i + 1}. ${s.name}`));
      return;
    }

    // Service Selection
    const serviceMatch = dynamicServices.find((s, i) => cleanText === (i + 1).toString() || cleanText.includes(s.name.toLowerCase()));
    if (serviceMatch && chatState === 'choosing_service') {
      setCurrentOrder(p => ({ ...p, items: [{ service: serviceMatch, quantity: 0, link: '' }] }));
      setChatState('entering_quantity');
      botReply(`📊 Enter Quantity for ${serviceMatch.name}?\n(Minimum: ${serviceMatch.minQuantity})`);
      return;
    }

    // Quantity Input
    if (chatState === 'entering_quantity') {
      const qty = parseInt(text);
      if (isNaN(qty)) return;

      const type = currentOrder.type || 'single';
      const minNeeded = type === 'combo' ? 100 : currentOrder.items[0]?.service.minQuantity;

      if (qty >= minNeeded) {
        const updatedItems = currentOrder.items.map(item => ({ ...item, quantity: qty }));
        setCurrentOrder(p => ({ ...p, items: updatedItems }));
        setChatState('choosing_payment_method');
        
        let rawPrice = 0;
        if (type === 'combo') {
          rawPrice = currentOrder.items.reduce((acc, item) => acc + (qty / 1000) * (item.service.pricePer1000 || 0), 0);
        } else {
          rawPrice = (qty / 1000) * (currentOrder.items[0].service.pricePer1000 || 0);
        }

        const disc = globalDiscounts[type] || 0;
        const discounted = rawPrice * (1 - disc / 100);
        
        const summary = `✅ ${type.toUpperCase()} SUMMARY\n───────────────\n${type === 'combo' ? 'Bundle: Likes+Views+Comments' : 'Service: ' + currentOrder.items[0].service.name}\nQuantity: ${qty}\nPrice: ₹${rawPrice.toFixed(2)}\nDiscount: ${disc}%\nFinal Price: ₹${discounted.toFixed(2)}\n───────────────\n💳 Wallet: ₹${walletBalance.toFixed(0)}`;
        
        const paymentOptions: string[] = [];
        if (paymentConfig?.walletEnabled !== false) paymentOptions.push("💳 PAY FROM WALLET");
        if (paymentConfig?.upiEnabled !== false) paymentOptions.push("📲 PAY VIA UPI QR");

        botReply(summary, paymentOptions, { 
          rawPrice: rawPrice, 
          paymentPrice: discounted, 
          discountPct: disc,
          isBulk: type === 'bulk'
        });
      } else {
        botReply(`⚠️ Error: Minimum ${minNeeded} required.`);
      }
      return;
    }

    // Payment Selection
    if (chatState === 'choosing_payment_method') {
      const type = currentOrder.type || 'single';
      const qty = currentOrder.items[0]?.quantity;
      let rawPrice = 0;
      let serviceName = "";

      if (type === 'combo') {
        rawPrice = currentOrder.items.reduce((acc, item) => acc + (qty / 1000) * (item.service.pricePer1000 || 0), 0);
        serviceName = "Combo Bundle";
      } else {
        rawPrice = (qty / 1000) * (currentOrder.items[0].service.pricePer1000 || 0);
        serviceName = currentOrder.items[0].service.name;
      }

      const disc = globalDiscounts[type] || 0;
      const discounted = rawPrice * (1 - disc / 100);

      if (cleanText.includes("wallet")) {
        if (walletBalance >= discounted) {
          botReply(type === 'bulk' ? `Paste your links below & Confirm Order.` : `Enter Link & Confirm Wallet Payment?`, [], { 
            isWalletCard: true, 
            paymentPrice: discounted, 
            rawPrice: rawPrice, 
            discountPct: disc,
            serviceName: serviceName,
            quantity: qty,
            isBulk: type === 'bulk'
          });
        } else {
          botReply("❌ Low Balance! Please refill your wallet.", ["💳 ADD FUNDS", "🏠 MENU"]);
        }
      } else if (cleanText.includes("upi")) {
        botReply(`Scan the QR to Pay:`, [], { 
          isPaymentCard: true, 
          paymentPrice: discounted, 
          rawPrice: rawPrice, 
          discountPct: disc,
          serviceName: serviceName,
          quantity: qty,
          isBulk: type === 'bulk'
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
      <header className="glass-header px-4 py-3 flex items-center justify-between shadow-3d-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#312ECB] flex items-center justify-center text-white shadow-3d-sm"><Zap className="fill-current" size={18} /></div>
          <h1 className="text-[18px] font-black italic tracking-tighter text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsNotifOpen(true)} className="relative p-2 text-slate-400 rounded-xl shadow-3d-sm active:shadow-3d-pressed">
            <Bell size={20} />
            {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900" />}
          </button>
          <button onClick={() => router.push('/profile')} className="w-9 h-9 rounded-2xl bg-slate-800 text-white font-black text-sm shadow-3d-sm border border-white/5 active:shadow-3d-pressed">
            {currentUser?.displayName?.[0] || 'U'}
          </button>
        </div>
      </header>

      <div className="bg-slate-900/50 backdrop-blur-md px-4 py-2 flex items-center justify-between border-b border-white/5 z-40">
        <button onClick={() => router.push('/add-funds')} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 shadow-3d-sm active:shadow-3d-pressed">
          <Wallet size={14} /><span className="text-[11px] font-black text-emerald-400">₹{walletBalance.toFixed(0)}</span><PlusCircle size={14} />
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsOrdersOpen(true)} className="text-[10px] font-black uppercase text-[#312ECB] flex items-center gap-1.5 shadow-3d-sm rounded-xl px-3 py-1.5 active:shadow-3d-pressed">
            <Package size={14} /> ORDERS
          </button>
          <button onClick={() => setIsLogsOpen(true)} className="text-[10px] font-black uppercase text-pink-500 flex items-center gap-1.5 shadow-3d-sm rounded-xl px-3 py-1.5 active:shadow-3d-pressed">
            <MessageSquareText size={14} /> HISTORY
          </button>
        </div>
      </div>

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
            isBulk={m.isBulk}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />

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

      {/* Popups */}
      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-3d bg-[#030712] p-0 overflow-hidden">
          <header className="bg-gradient-to-r from-[#312ECB] to-purple-600 p-6 text-white relative">
             <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-3d-sm animate-pulse">
                  <Megaphone size={24} className="text-white fill-current" />
                </div>
                <DialogTitle className="text-white font-black uppercase text-[10px] tracking-[0.3em] mt-2">Special Update</DialogTitle>
             </div>
             <button onClick={() => setIsBroadcastOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">
               <X size={18} />
             </button>
          </header>
          <div className="p-8 space-y-6 text-center">
             <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-3d-pressed">
                <p className="text-[13px] font-bold text-slate-200 leading-relaxed italic">
                  "{activeBroadcast?.text}"
                </p>
             </div>
             <Button onClick={() => setIsBroadcastOpen(false)} className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed">Got it! 🚀</Button>
          </div>
        </DialogContent>
      </Dialog>

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
                    <div className="space-y-0.5"><p className="text-[11px] font-black text-white">{n.title}</p><p className="text-[10px] font-bold text-slate-400">{n.message}</p></div>
                  </div>
                )) : <div className="flex flex-col items-center justify-center py-20 opacity-20 text-white"><Bell size={40} /><p className="text-[10px] font-black uppercase mt-4">Inbox Clear</p></div>}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
        <DialogContent className="max-w-[360px] rounded-[2.5rem] border-none shadow-3d bg-[#030712] p-0 overflow-hidden">
          <header className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-white/5">
             <DialogTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white"><Package size={16} className="inline mr-2" /> Order History</DialogTitle>
          </header>
          <ScrollArea className="h-[500px] p-4">
             <div className="space-y-3">
                {userOrders.length > 0 ? userOrders.map((order: any) => {
                  const displayId = order.orderId || order.id.slice(0, 8).toUpperCase();
                  return (
                    <div key={order.id} className="bg-slate-900 p-4 rounded-[1.2rem] shadow-3d-sm border border-white/5 flex flex-col gap-1.5">
                       <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-black uppercase text-[#312ECB] truncate max-w-[180px]">{order.service}</h3>
                          <Badge className="text-[8px] font-black bg-slate-800 text-slate-400">#{displayId}</Badge>
                       </div>
                       <div className="flex items-center gap-2.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Qty: {order.quantity}</span>
                          <span className="text-[9px] font-black text-emerald-600">₹{order.price?.toFixed(2)}</span>
                          <Badge className={cn("ml-auto text-[8px] h-4.5 font-black px-2 border-none rounded-md", order.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500')}>{order.status}</Badge>
                       </div>
                    </div>
                  );
                }) : <div className="text-center py-20 opacity-20 text-white"><Package size={40} className="mx-auto" /><p className="text-[10px] font-black uppercase mt-4">No Orders</p></div>}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="max-w-[360px] rounded-[2.5rem] border-none shadow-3d bg-[#030712] p-0 overflow-hidden">
          <header className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-white/5">
             <DialogTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white"><MessageSquareText size={16} className="inline mr-2" /> Chat Logs</DialogTitle>
          </header>
          <ScrollArea className="h-[500px] p-4">
             <div className="space-y-3">
                {rawLogs?.map((log: any) => (
                  <div key={log.id} className={cn("p-3 rounded-2xl shadow-3d-sm border flex flex-col gap-1", log.sender === 'bot' ? "bg-slate-900 ml-0 mr-8 border-white/5" : "bg-emerald-950/20 ml-8 mr-0 border-emerald-500/10")}>
                     <div className="flex items-center justify-between">
                        <span className={cn("text-[7px] font-black uppercase tracking-widest", log.sender === 'bot' ? "text-[#312ECB]" : "text-emerald-600")}>{log.sender === 'bot' ? 'Assistant' : 'You'}</span>
                        <span className="text-[7px] font-bold text-slate-400">{log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm') : ''}</span>
                     </div>
                     <p className="text-[10px] font-bold text-slate-200 leading-relaxed">{log.text}</p>
                  </div>
                ))}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
