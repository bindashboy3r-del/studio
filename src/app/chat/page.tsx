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
import { placeApiOrder } from "@/app/actions/smm-api";
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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark'); 
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [showSocialMenu, setShowSocialMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  
  const hasInitialGreeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth Guard
  useEffect(() => {
    if (!isUserLoading && !currentUser) router.push("/");
  }, [currentUser, isUserLoading, router]);

  // Session Management: Persistence for History/Orders only
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const isReturning = sessionStorage.getItem('keepChatSession') === 'true';
    const storedStartTime = sessionStorage.getItem('chatSessionStartTime');
    
    if (isReturning && storedStartTime) {
      setSessionStartTime(new Date(storedStartTime));
    } else {
      const now = new Date();
      setSessionStartTime(now);
      sessionStorage.setItem('chatSessionStartTime', now.toISOString());
    }
    
    // Clear flag so navigation to other pages resets chat next time
    sessionStorage.removeItem('keepChatSession');
  }, []);

  const navigateWithSession = (path: string, keep: boolean) => {
    if (keep) sessionStorage.setItem('keepChatSession', 'true');
    else {
      sessionStorage.removeItem('keepChatSession');
      sessionStorage.removeItem('chatSessionStartTime');
    }
    router.push(path);
  };

  // 7-Day Rolling Auto-Cleanup
  useEffect(() => {
    if (!db || !currentUser) return;
    const cleanup = async () => {
      try {
        const sevenDaysAgo = subDays(new Date(), 7);
        const qClean = query(collection(db, "users", currentUser.uid, "chatMessages"), where("timestamp", "<", sevenDaysAgo));
        const snap = await getDocs(qClean);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (e) {}
    };
    cleanup();
  }, [db, currentUser]);

  const servicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db]);
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
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      const initialTheme = savedTheme || 'dark';
      setTheme(initialTheme);
      document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

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
    const unsubNotifs = onSnapshot(query(collection(db, "users", currentUser.uid, "notifications"), where("read", "==", false), orderBy("createdAt", "desc"), limit(20)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubBroadcast(); unsubDiscounts(); unsubSocial(); unsubNotifs(); };
  }, [db, currentUser]);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return query(collection(db, "users", currentUser.uid, "chatMessages"), where("timestamp", ">=", Timestamp.fromDate(sessionStartTime)), orderBy("timestamp", "asc"));
  }, [db, currentUser, sessionStartTime]);
  const { data: messages, isLoading: isMessagesLoading } = useCollection(messagesQuery);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const addMessage = async (sender: 'user' | 'bot', text: string, options?: string[], extraData?: any) => {
    if (!currentUser || !db) return;
    addDoc(collection(db, "users", currentUser.uid, "chatMessages"), { userId: currentUser.uid, sender, text, options: options || [], timestamp: serverTimestamp(), ...extraData });
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
        botReply("👋 Welcome to SocialBoost! Type 'Hi' to start growing your Instagram. 🚀");
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
    return raw * (1 - disc / 100);
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
      if (cleanText.includes("single")) {
        setChatState('choosing_service'); setCurrentOrder({ type: 'single', platform: 'instagram', items: [] });
        botReply(`Select Service (${globalDiscounts.single}% OFF):`, dynamicServices.map((s, i) => `${i + 1}. ${s.name}`));
      } else if (cleanText.includes("combo")) {
        setChatState('choosing_service'); setCurrentOrder({ type: 'combo', platform: 'instagram', items: [] });
        botReply(`Gift Mode On! Configure Combo (${globalDiscounts.combo}% OFF):`, [], { isComboCard: true, dynamicServices, discountPct: globalDiscounts.combo });
      } else if (cleanText.includes("bulk")) {
        setChatState('choosing_service'); setCurrentOrder({ type: 'bulk', platform: 'instagram', items: [] });
        botReply("Bulk Mode: Add links to start.", [], { isBulkLinkCard: true });
      } else {
        setChatState('choosing_order_type');
        botReply("Choose your boost style:", [`1. SINGLE ORDER (${globalDiscounts.single}% OFF)`, `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)`, `3. BULK ORDER (${globalDiscounts.bulk}% OFF)`]);
      }
      return;
    }

    if (serviceMatch) {
      setCurrentOrder(p => ({ ...p, items: [{ service: serviceMatch, quantity: 0, link: '' }] }));
      setChatState('entering_quantity');
      botReply(`📊 Quantity for ${serviceMatch.name}? (Min ${serviceMatch.minQuantity})`);
      return;
    }

    if (chatState === 'entering_quantity') {
      const qty = parseInt(text);
      const s = currentOrder.items[0]?.service;
      if (s && qty >= s.minQuantity) {
        const updated = [{ service: s, quantity: qty, link: '' }];
        setCurrentOrder(p => ({ ...p, items: updated }));
        setChatState('choosing_payment_method');
        const total = calculateTotalPrice(updated);
        botReply(`✅ Total: ₹${total.toFixed(2)}\n💳 Wallet: ₹${walletBalance.toFixed(0)}`, ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"]);
      } else if (s) botReply(`⚠️ Minimum ${s.minQuantity} needed for ${s.name}.`);
      return;
    }

    if (chatState === 'choosing_payment_method') {
      const total = calculateTotalPrice();
      if (cleanText.includes("wallet")) {
        if (walletBalance >= total) botReply(`Confirm Payment: ₹${total.toFixed(2)}`, [], { isWalletCard: true, paymentPrice: total, discountPct: globalDiscounts.single });
        else botReply("❌ Low Balance!", ["💳 ADD FUNDS", "🏠 MENU"]);
      } else if (cleanText.includes("upi")) {
        botReply(`Scan to Pay:`, [], { isPaymentCard: true, paymentPrice: total, discountPct: globalDiscounts.single });
      }
    }
  };

  if (isUserLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950"><Loader2 className="w-8 h-8 text-[#312ECB] animate-spin mb-3" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Session...</p></div>;

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative shadow-2xl bg-white dark:bg-slate-950 font-body">
      <header className="glass-header px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#312ECB] flex items-center justify-center text-white shadow-lg shadow-blue-500/20"><Zap className="fill-current" size={16} /></div>
          <h1 className="text-[16px] font-black italic tracking-tighter text-[#312ECB] dark:text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="text-slate-400 hover:text-[#312ECB] transition-colors">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
          
          <Sheet open={isNotifOpen} onOpenChange={setIsNotifOpen}>
            <SheetTrigger asChild><div className="relative cursor-pointer"><button className="text-slate-400 p-1"><Bell size={18} /></button>{notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />}</div></SheetTrigger>
            <SheetContent side="right" className="w-[320px] p-0 rounded-l-[2rem] border-none shadow-2xl">
              <SheetHeader className="p-6 bg-[#312ECB] text-white rounded-tl-[2rem]"><div className="flex items-center justify-between"><SheetTitle className="text-white font-black uppercase text-xs flex items-center gap-2"><Bell size={14} /> Notifications</SheetTitle>{notifications.length > 0 && <Button onClick={async () => { const batch = writeBatch(db!); notifications.forEach(n => batch.update(doc(db!, "users", currentUser!.uid, "notifications", n.id), { read: true })); await batch.commit(); }} variant="ghost" className="h-7 text-[8px] font-black uppercase bg-white/10 hover:bg-white/20 text-white rounded-lg px-2 gap-1"><CheckCheck size={10} /> Clear</Button>}</div></SheetHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950 h-full">{notifications.length > 0 ? notifications.map(n => <div key={n.id} onClick={() => updateDoc(doc(db!, "users", currentUser!.uid, "notifications", n.id), { read: true })} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-start gap-3 active:scale-95 transition-all"><div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 shrink-0"><Zap size={14} /></div><div className="space-y-0.5"><p className="text-[11px] font-black leading-tight">{n.title}</p><p className="text-[10px] font-bold text-slate-400 leading-relaxed">{n.message}</p></div></div>) : <div className="flex flex-col items-center justify-center py-20 opacity-20"><Bell size={40} /><p className="text-[10px] font-black uppercase mt-4">Inbox Clear</p></div>}</div>
            </SheetContent>
          </Sheet>

          <button onClick={() => navigateWithSession('/profile', false)} className="w-8 h-8 rounded-full bg-[#312ECB] text-white font-black text-[11px] shadow-md active:scale-95 transition-transform">{currentUser?.displayName?.[0] || 'U'}</button>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 px-4 py-2 flex items-center justify-between border-b dark:border-slate-800 z-40">
        <button onClick={() => navigateWithSession('/add-funds', false)} className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/50 transition-all active:scale-95"><Wallet size={12} /><span className="text-[10px] font-black">₹{walletBalance.toFixed(0)}</span><PlusCircle size={12} /></button>
        <div className="flex items-center gap-4">
          <button onClick={() => navigateWithSession('/orders', true)} className="text-[9px] font-black uppercase text-[#312ECB] flex items-center gap-1.5"><History size={12} /> ORDERS</button>
          <button onClick={() => navigateWithSession('/chat-logs', true)} className="text-[9px] font-black uppercase text-pink-500 flex items-center gap-1.5"><MessageSquareText size={12} /> CHATS</button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-bg relative pb-20">
        {messages?.map(m => <MessageBubble key={m.id} sender={m.sender} text={m.text} options={m.options} onOptionClick={handleSend} isPaymentCard={m.isPaymentCard} paymentPrice={m.paymentPrice} isSuccessCard={m.isSuccessCard} successDetails={m.successDetails} isBulkLinkCard={m.isBulkLinkCard} isComboCard={m.isComboCard} isWalletCard={m.isWalletCard} timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} dynamicServices={dynamicServices} discountPct={m.discountPct ?? 0} />)}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />

        <div className="fixed bottom-20 left-4 z-50 flex flex-col items-start gap-3">
          {showSocialMenu && <div className="flex flex-col gap-3 mb-2 animate-in slide-in-from-bottom-5 duration-300">
            {socialLinks?.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg"><Instagram size={16} /></a>}
            {socialLinks?.whatsapp && <a href={socialLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-lg"><MessageCircle size={16} /></a>}
          </div>}
          <button onClick={() => setShowSocialMenu(!showSocialMenu)} className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-90", showSocialMenu ? "bg-red-500 rotate-90" : "bg-[#312ECB]")}>{showSocialMenu ? <X size={20} /> : <Share2 size={20} />}</button>
        </div>
      </main>

      <footer className="p-3 bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-50">
        <div className="flex items-center gap-3 bg-[#F0F2F5] dark:bg-slate-800 rounded-[1.5rem] p-1 pr-2">
          <Input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Type something..." className="flex-1 bg-transparent border-none font-bold text-sm h-10 focus-visible:ring-0 shadow-none" />
          <Button onClick={() => handleSend()} size="icon" className="rounded-xl h-9 w-9 bg-[#312ECB] hover:bg-[#2825A6] shadow-md active:scale-95 transition-transform"><Send size={16} /></Button>
        </div>
      </footer>
    </div>
  );
}