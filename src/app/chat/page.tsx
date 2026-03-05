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
  Moon, 
  Sun,
  History,
  X,
  Megaphone,
  Zap,
  Wallet,
  PlusCircle,
  Share2,
  Instagram,
  MessageCircle,
  Loader2,
  Bell,
  CheckCheck,
  MessageSquareText
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SMMService, Platform } from "@/app/lib/constants";
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { subDays } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [showSocialMenu, setShowSocialMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const hasInitialGreeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserLoading && !currentUser) router.push("/");
  }, [currentUser, isUserLoading, router]);

  const navigateWithSession = (path: string, keep: boolean) => {
    if (keep) sessionStorage.setItem('keepChatSession', 'true');
    else {
      sessionStorage.removeItem('keepChatSession');
      sessionStorage.removeItem('chatSessionStartTime');
    }
    router.push(path);
  };

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

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return query(collection(db, "users", currentUser.uid, "chatMessages"), orderBy("timestamp", "asc"));
  }, [db, currentUser]);
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
    if (currentUser && !isMessagesLoading && !hasInitialGreeted.current) {
      hasInitialGreeted.current = true;
      if (!messages || messages.length === 0) {
        setChatState('initial');
        botReply("👋 Welcome to SocialBoost! 3D Automation Active. Type 'Hi' to begin. 🚀");
      }
    }
  }, [currentUser, isMessagesLoading, messages]);

  const calculateTotalPrice = (itemsOverride?: OrderItem[], typeOverride?: string) => {
    const items = itemsOverride || currentOrder.items;
    const type = typeOverride || currentOrder.type;
    const raw = items.reduce((sum, item) => {
      const multiplier = (type === 'bulk' && currentOrder.bulkLinks) ? currentOrder.bulkLinks.length : 1;
      return sum + ((item.quantity / 1000) * (item.service.pricePer1000 || 0) * multiplier);
    }, 0);
    const disc = type === 'combo' ? globalDiscounts.combo : type === 'bulk' ? globalDiscounts.bulk : globalDiscounts.single;
    return {
      raw,
      discounted: raw * (1 - disc / 100),
      discountPct: disc
    };
  };

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !currentUser) return;
    if (!manualText) setInputValue("");
    await addMessage('user', text);
    const cleanText = text.toLowerCase();

    const isSwitch = cleanText.includes("order") || cleanText === 'hi' || cleanText === 'menu';
    const serviceMatch = dynamicServices.find((s, i) => cleanText === (i + 1).toString() || cleanText.includes(s.name.toLowerCase()));

    if (isSwitch) {
      setChatState('choosing_order_type');
      botReply("Choose your boost style (3D Neumorphic Mode):", [
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
        const { raw, discounted, discountPct } = calculateTotalPrice(updated);
        
        const summary = `✅ ORDER SUMMARY\n───────────────\n💰 Real Price: ₹${raw.toFixed(2)}\n🎁 Discount: ${discountPct}%\n🔥 You Pay: ₹${discounted.toFixed(2)}\n───────────────\n💳 Wallet: ₹${walletBalance.toFixed(0)}`;
        
        botReply(summary, ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"], { 
          rawPrice: raw, 
          paymentPrice: discounted, 
          discountPct 
        });
      } else if (s) botReply(`⚠️ Error: Minimum ${s.minQuantity} required.`);
      return;
    }

    if (chatState === 'choosing_payment_method') {
      const { raw, discounted, discountPct } = calculateTotalPrice();
      if (cleanText.includes("wallet")) {
        if (walletBalance >= discounted) botReply(`Confirm Wallet Payment of ₹${discounted.toFixed(2)}?`, [], { isWalletCard: true, paymentPrice: discounted, rawPrice: raw, discountPct });
        else botReply("❌ Low Balance! Please refill your wallet.", ["💳 ADD FUNDS", "🏠 MENU"]);
      } else if (cleanText.includes("upi")) {
        botReply(`Scan the 3D QR to Pay:`, [], { isPaymentCard: true, paymentPrice: discounted, rawPrice: raw, discountPct });
      }
    }
  };

  if (isUserLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-[#030712]"><Loader2 className="w-8 h-8 text-[#312ECB] animate-spin mb-3" /></div>;

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative whatsapp-bg font-body">
      <header className="glass-header px-4 py-3 flex items-center justify-between shadow-3d-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#312ECB] flex items-center justify-center text-white shadow-3d-sm"><Zap className="fill-current" size={18} /></div>
          <h1 className="text-[18px] font-black italic tracking-tighter text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-3">
          <Sheet open={isNotifOpen} onOpenChange={setIsNotifOpen}>
            <SheetTrigger asChild>
              <div className="relative cursor-pointer">
                <button className="text-slate-400 p-2 rounded-xl shadow-3d-sm active:shadow-3d-pressed">
                  <Bell size={20} />
                </button>
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] p-0 rounded-l-[2rem] border-none shadow-3d bg-[#030712]">
              <SheetHeader className="p-6 bg-[#312ECB] text-white rounded-tl-[2rem] shadow-3d-sm">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-white font-black uppercase text-xs flex items-center gap-2">Notifications</SheetTitle>
                  {notifications.length > 0 && (
                    <Button onClick={async () => { const batch = writeBatch(db!); notifications.forEach(n => batch.update(doc(db!, "users", currentUser!.uid, "notifications", n.id), { read: true })); await batch.commit(); }} variant="ghost" className="h-7 text-[8px] font-black uppercase bg-white/10 rounded-lg px-2 shadow-3d-sm">Clear</Button>
                  )}
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 h-full custom-scrollbar">
                {notifications.length > 0 ? notifications.map(n => (
                  <div key={n.id} className="bg-slate-900 p-4 rounded-2xl shadow-3d-sm border border-white/5 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB] shrink-0"><Zap size={14} /></div>
                    <div className="space-y-0.5"><p className="text-[11px] font-black">{n.title}</p><p className="text-[10px] font-bold text-slate-400">{n.message}</p></div>
                  </div>
                )) : <div className="flex flex-col items-center justify-center py-20 opacity-20"><Bell size={40} /><p className="text-[10px] font-black uppercase mt-4">Inbox Clear</p></div>}
              </div>
            </SheetContent>
          </Sheet>
          <button onClick={() => navigateWithSession('/profile', false)} className="w-9 h-9 rounded-2xl bg-slate-800 text-white font-black text-sm shadow-3d-sm active:shadow-3d-pressed border border-white/5">
            {currentUser?.displayName?.[0] || 'U'}
          </button>
        </div>
      </header>

      <div className="bg-slate-900/50 backdrop-blur-md px-4 py-2 flex items-center justify-between border-b border-white/5 z-40">
        <button onClick={() => navigateWithSession('/add-funds', false)} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 shadow-3d-sm active:shadow-3d-pressed">
          <Wallet size={14} /><span className="text-[11px] font-black">₹{walletBalance.toFixed(0)}</span><PlusCircle size={14} />
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => navigateWithSession('/orders', true)} className="text-[10px] font-black uppercase text-[#312ECB] flex items-center gap-1.5 shadow-3d-sm rounded-xl px-3 py-1.5 active:shadow-3d-pressed">
            <History size={14} /> ORDERS
          </button>
          <button onClick={() => navigateWithSession('/chat-logs', true)} className="text-[10px] font-black uppercase text-pink-500 flex items-center gap-1.5 shadow-3d-sm rounded-xl px-3 py-1.5 active:shadow-3d-pressed">
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
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />

        <div className="fixed bottom-24 left-4 z-50 flex flex-col items-start gap-3">
          {showSocialMenu && (
            <div className="flex flex-col gap-3 mb-2 animate-in slide-in-from-bottom-5 duration-300">
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-3d active:shadow-3d-pressed transition-all">
                  <Instagram size={20} />
                </a>
              )}
              {socialLinks?.whatsapp && (
                <a href={socialLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#25D366] rounded-2xl flex items-center justify-center text-white shadow-3d active:shadow-3d-pressed transition-all">
                  <MessageCircle size={20} />
                </a>
              )}
            </div>
          )}
          <button 
            onClick={() => setShowSocialMenu(!showSocialMenu)} 
            className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-3d transition-all active:shadow-3d-pressed", showSocialMenu ? "bg-red-500 rotate-90 shadow-3d-pressed" : "bg-[#312ECB]")}
          >
            {showSocialMenu ? <X size={24} /> : <Share2 size={24} />}
          </button>
        </div>
      </main>

      <footer className="p-4 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 z-50">
        <div className="flex items-center gap-3 bg-slate-950 rounded-[1.8rem] p-1.5 shadow-3d-pressed">
          <Input 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && handleSend()} 
            placeholder="Type your 3D Request..." 
            className="flex-1 bg-transparent border-none font-bold text-sm h-11 focus-visible:ring-0 shadow-none text-white placeholder:text-slate-600" 
          />
          <Button 
            onClick={() => handleSend()} 
            size="icon" 
            className="rounded-2xl h-10 w-10 bg-[#312ECB] hover:bg-[#2825A6] shadow-3d active:shadow-3d-pressed transition-all"
          >
            <Send size={18} />
          </Button>
        </div>
      </footer>
    </div>
  );
}