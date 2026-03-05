
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
  getDoc
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
  Youtube,
  Facebook,
  MessageCircle,
  Loader2,
  Bell
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SMMService, Platform } from "@/app/lib/constants";
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { placeApiOrder } from "@/app/actions/smm-api";

type ChatState = 
  | 'idle' 
  | 'initial'
  | 'choosing_order_type'
  | 'choosing_service' 
  | 'choosing_combo_services'
  | 'entering_quantity' 
  | 'entering_bulk_links'
  | 'entering_combo_quantities'
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
  paymentMethod?: 'wallet' | 'upi';
  bulkLinks?: string[];
}

export default function ChatPage() {
  const { user, isUserLoading } = useUser();
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
  
  const [sessionStartTime] = useState(() => Date.now());
  const hasInitialGreeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/");
    }
  }, [user, isUserLoading, router]);

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
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
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
    if (!db || !user) return; 
    
    const unsubBroadcast = onSnapshot(query(collection(db, "globalAnnouncements"), where("active", "==", true), limit(1)), (snap) => {
      if (!snap.empty) setActiveBroadcast(snap.docs[0].data());
      else setActiveBroadcast(null);
    });
    
    const unsubDiscounts = onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setGlobalDiscounts({
          single: Number(d.single) || 0,
          combo: Number(d.combo) || 0,
          bulk: Number(d.bulk) || 0
        });
      }
    });

    const unsubSocial = onSnapshot(doc(db, "globalSettings", "social"), (snap) => {
      if (snap.exists()) setSocialLinks(snap.data());
    });

    const unsubNotifs = onSnapshot(query(collection(db, "users", user.uid, "notifications"), where("read", "==", false), limit(10)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubBroadcast();
      unsubDiscounts();
      unsubSocial();
      unsubNotifs();
    };
  }, [db, user]);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "users", user.uid, "chatMessages"), orderBy("timestamp", "asc"));
  }, [db, user]);

  const { data: messagesData, isLoading: isMessagesLoading } = useCollection(messagesQuery);

  const messages = useMemo(() => {
    if (!messagesData) return [];
    return messagesData.filter((m: any) => {
      if (!m.timestamp) return true;
      const msgTime = m.timestamp.toDate ? m.timestamp.toDate().getTime() : new Date(m.timestamp).getTime();
      return msgTime >= sessionStartTime;
    });
  }, [messagesData, sessionStartTime]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, activeBroadcast]);

  const addMessage = async (sender: 'user' | 'bot', text: string, options?: string[], extraData?: any) => {
    if (!user || !db) return;
    addDoc(collection(db, "users", user.uid, "chatMessages"), {
      userId: user.uid,
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
    if (user && !isMessagesLoading && !hasInitialGreeted.current) {
      hasInitialGreeted.current = true;
      setChatState('initial');
      botReply("👋 Welcome to SocialBoost! Send 'Hi' to see our Instagram growth menu. 🚀");
    }
  }, [user, isMessagesLoading]);

  const calculateRawPrice = (itemsOverride?: OrderItem[], typeOverride?: string) => {
    const items = itemsOverride || currentOrder.items;
    const type = typeOverride || currentOrder.type;
    if (!items || items.length === 0) return 0;

    return items.reduce((sum, item) => {
      if (!item.service || !item.quantity) return sum;
      const multiplier = (type === 'bulk' && currentOrder.bulkLinks) ? currentOrder.bulkLinks.length : 1;
      const itemCost = (item.quantity / 1000) * (item.service.pricePer1000 || 0);
      return sum + (itemCost * multiplier);
    }, 0);
  };

  const calculateTotalPrice = (itemsOverride?: OrderItem[], typeOverride?: string) => {
    const rawTotal = calculateRawPrice(itemsOverride, typeOverride);
    const type = typeOverride || currentOrder.type;

    const discPct = type === 'combo' ? globalDiscounts.combo : 
                    type === 'bulk' ? globalDiscounts.bulk : 
                    globalDiscounts.single;

    if (discPct > 0) {
      return rawTotal * (1 - discPct / 100);
    }

    return rawTotal;
  };

  const handleBundlePaymentSubmit = async (utr: string, linkOverride?: string) => {
    if (!db || !user || currentOrder.items.length === 0) return;
    const totalPrice = calculateTotalPrice();
    const targets = (currentOrder.type === 'bulk' && currentOrder.bulkLinks) ? currentOrder.bulkLinks : [linkOverride || currentOrder.items[0].link];

    if (!targets[0] || targets[0].trim() === "") {
        toast({ variant: "destructive", title: "Missing Link", description: "Please provide Instagram link." });
        return;
    }

    const batch = writeBatch(db);
    const orderResults: any[] = [];
    const discPct = currentOrder.type === 'combo' ? globalDiscounts.combo : 
                    currentOrder.type === 'bulk' ? globalDiscounts.bulk : 
                    globalDiscounts.single;

    for (const link of targets) {
      for (const item of currentOrder.items) {
        const orderId = `SB-B-${Math.floor(100000 + Math.random() * 900000)}`;
        const orderRef = doc(collection(db, "users", user.uid, "orders"));
        let itemPrice = (item.quantity / 1000) * (item.service?.pricePer1000 || 0);
        if (discPct > 0) itemPrice *= (1 - discPct / 100);

        const orderData = {
          userId: user.uid, orderId, platform: 'Instagram', service: item.service?.name || "Service", link,
          quantity: item.quantity, price: itemPrice, utrId: utr, status: 'Pending', paymentMethod: 'UPI', createdAt: serverTimestamp()
        };
        batch.set(orderRef, orderData);
        orderResults.push(orderData);
      }
    }

    await batch.commit();
    setChatState('idle');
    const successServiceName = currentOrder.type === 'combo' 
      ? `Combo: ${currentOrder.items.map(it => `${it.service.name}`).join(', ')}`
      : currentOrder.items[0]?.service?.name;

    botReply(`✅ Order submitted! Verification in progress.`, [], {
      isSuccessCard: true,
      successDetails: {
        orderId: orderResults[0].orderId, platform: 'Instagram', service: successServiceName,
        quantity: currentOrder.items.reduce((a, b) => a + b.quantity, 0) * (currentOrder.bulkLinks?.length || 1),
        price: totalPrice, link: targets[0], utrId: utr
      }
    });
  };

  const handleBundleWalletSubmit = async (linkOverride?: string) => {
    if (!db || !user || currentOrder.items.length === 0) return;
    const totalPrice = calculateTotalPrice();
    if (walletBalance < totalPrice) {
      botReply("❌ Insufficient balance!", ["💳 ADD FUNDS", "🏠 MAIN MENU"]);
      return;
    }

    const apiSnap = await getDoc(doc(db, "globalSettings", "api"));
    const apiData = apiSnap.exists() ? apiSnap.data() : null;
    const batch = writeBatch(db);
    const targets = (currentOrder.type === 'bulk' && currentOrder.bulkLinks) ? currentOrder.bulkLinks : [linkOverride || currentOrder.items[0].link];
    const discPct = currentOrder.type === 'combo' ? globalDiscounts.combo : currentOrder.type === 'bulk' ? globalDiscounts.bulk : globalDiscounts.single;

    if (!targets[0] || targets[0].trim() === "") {
        toast({ variant: "destructive", title: "Missing Link" });
        return;
    }

    const orderResults: any[] = [];
    for (const link of targets) {
      for (const item of currentOrder.items) {
        const orderId = `SB-W-${Math.floor(100000 + Math.random() * 900000)}`;
        let finalStatus = 'Pending'; let apiOrderId = null; let providerId = null;

        if (apiData) {
          const mapping = apiData.mappings?.[item.service?.id || ""];
          providerId = mapping?.providerId;
          const remoteServiceId = mapping?.remoteServiceId;
          const provider = apiData.providers?.find((p: any) => p.id === providerId);
          if (provider && provider.url && provider.key && remoteServiceId) {
            const apiResult = await placeApiOrder({ apiUrl: provider.url, apiKey: provider.key, serviceId: remoteServiceId, link, quantity: item.quantity });
            if (apiResult.success) { apiOrderId = apiResult.order; finalStatus = 'Processing'; }
          }
        }

        let itemPrice = (item.quantity / 1000) * (item.service?.pricePer1000 || 0);
        if (discPct > 0) itemPrice *= (1 - discPct / 100);

        const orderData = {
          userId: user.uid, orderId, platform: 'Instagram', service: item.service?.name, link,
          quantity: item.quantity, price: itemPrice, status: finalStatus, paymentMethod: 'Wallet', apiOrderId, providerId, createdAt: serverTimestamp()
        };
        batch.set(doc(collection(db, "users", user.uid, "orders")), orderData);
        orderResults.push(orderData);
      }
    }

    batch.update(doc(db, "users", user.uid), { balance: increment(-totalPrice) });
    await batch.commit().then(() => {
      setChatState('idle');
      const successServiceName = currentOrder.type === 'combo' 
        ? `Combo: ${currentOrder.items.map(it => `${it.service.name}`).join(', ')}`
        : currentOrder.items[0]?.service?.name;

      botReply(`✅ Order placed from Wallet!`, [], {
        isSuccessCard: true,
        successDetails: { orderId: orderResults[0].orderId, platform: 'Instagram', service: successServiceName, quantity: 0, price: totalPrice, link: targets[0], utrId: 'WALLET' }
      });
    });
  };

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !user) return;
    if (!manualText) setInputValue("");
    await addMessage('user', text);
    const cleanText = text.toLowerCase();

    const isMajorSwitch = cleanText.includes("single order") || cleanText.includes("combo order") || cleanText.includes("bulk order") || cleanText === 'hi' || cleanText === 'menu';
    const serviceMatch = dynamicServices.find((s, i) => cleanText === (i + 1).toString() || cleanText.includes(s.name.toLowerCase()));

    if (isMajorSwitch) {
      if (cleanText.includes("single order")) {
        setChatState('choosing_service');
        setCurrentOrder({ type: 'single', platform: 'instagram', items: [] });
        botReply(`Select Instagram service (${globalDiscounts.single}% OFF):`, dynamicServices.map((s, i) => `${i + 1}. ${s.name}`));
        return;
      } else if (cleanText.includes("combo order")) {
        setChatState('choosing_combo_services');
        setCurrentOrder({ type: 'combo', platform: 'instagram', items: [] });
        botReply(`🎁 Configure Combo (${globalDiscounts.combo}% OFF):`, [], { isComboCard: true, dynamicServices, discountPct: globalDiscounts.combo });
        return;
      } else if (cleanText.includes("bulk order")) {
        setChatState('entering_bulk_links');
        setCurrentOrder({ type: 'bulk', platform: 'instagram', items: [] });
        botReply("🔗 Add target links for Bulk Order:", [], { isBulkLinkCard: true });
        return;
      } else {
        setChatState('choosing_order_type');
        const singleLabel = globalDiscounts.single > 0 ? `1. SINGLE ORDER (${globalDiscounts.single}% OFF)` : "1. SINGLE ORDER";
        const comboLabel = globalDiscounts.combo > 0 ? `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)` : "2. COMBO ORDER";
        const bulkLabel = globalDiscounts.bulk > 0 ? `3. BULK ORDER (${globalDiscounts.bulk}% OFF)` : "3. BULK ORDER";
        botReply("👋 Welcome! Choose your ordering method:", [singleLabel, comboLabel, bulkLabel]);
        return;
      }
    }

    if (serviceMatch) {
      setCurrentOrder(prev => ({ 
        type: prev.type === 'bulk' ? 'bulk' : 'single', 
        platform: 'instagram', 
        items: [{ service: serviceMatch, quantity: 0, link: '' }],
        bulkLinks: prev.bulkLinks
      }));
      setChatState('entering_quantity');
      botReply(`📊 Quantity for ${serviceMatch.name}? (Min ${serviceMatch.minQuantity})`);
      return;
    }

    switch (chatState) {
      case 'entering_quantity':
        const qty = parseInt(text);
        const s = currentOrder.items[0]?.service;
        if (s && qty >= s.minQuantity) {
          const updatedItems: OrderItem[] = [{ service: s, quantity: qty, link: '' }];
          setCurrentOrder(prev => ({ ...prev, items: updatedItems }));
          setChatState('choosing_payment_method');
          
          const rawTotal = calculateRawPrice(updatedItems, currentOrder.type);
          const discountedTotal = calculateTotalPrice(updatedItems, currentOrder.type);
          const currentDisc = currentOrder.type === 'bulk' ? globalDiscounts.bulk : globalDiscounts.single;
          
          const priceMsg = currentDisc > 0 
            ? `✅ Real Price: ₹${rawTotal.toFixed(2)}\n🔥 Discounted Total: ₹${discountedTotal.toFixed(2)} (${currentDisc}% OFF)`
            : `✅ Total: ₹${discountedTotal.toFixed(2)}`;

          botReply(`${priceMsg}\n💳 Wallet: ₹${walletBalance.toFixed(2)}`, ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"]);
        } else if (s) {
          botReply(`⚠️ Minimum quantity for ${s.name} is ${s.minQuantity}. Kripya sahi quantity enter karein.`);
        }
        break;
      case 'choosing_payment_method':
        if (cleanText.includes("wallet")) {
          const raw = calculateRawPrice();
          const total = calculateTotalPrice();
          const currentDisc = currentOrder.type === 'combo' ? globalDiscounts.combo : currentOrder.type === 'bulk' ? globalDiscounts.bulk : globalDiscounts.single;
          if (walletBalance >= total) botReply(`💳 Confirm Wallet Payment:`, [], { isWalletCard: true, paymentPrice: total, rawPrice: raw, discountPct: currentDisc });
          else botReply("❌ Insufficient balance!", ["💳 ADD FUNDS", "🏠 MAIN MENU"]);
        } else if (cleanText.includes("upi")) {
          const raw = calculateRawPrice();
          const total = calculateTotalPrice();
          const currentDisc = currentOrder.type === 'combo' ? globalDiscounts.combo : currentOrder.type === 'bulk' ? globalDiscounts.bulk : globalDiscounts.single;
          botReply(`📸 Scan & Pay via UPI QR:`, [], { isPaymentCard: true, paymentPrice: total, rawPrice: raw, discountPct: currentDisc });
        }
        break;
    }
  };

  if (isUserLoading || (!user && !isUserLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-[#312ECB] animate-spin mb-3" />
        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">Loading Session...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative shadow-2xl bg-white dark:bg-slate-950 font-body">
      <header className="bg-white dark:bg-slate-900 px-3 py-2 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#312ECB] flex items-center justify-center text-white shadow-lg"><Zap className="fill-current" size={14} /></div>
          <h1 className="text-[14px] font-black italic tracking-tighter text-[#312ECB] dark:text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="text-slate-400 p-1">{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
          <div className="relative">
            <button className="text-slate-400 p-1"><Bell size={16} /></button>
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
            )}
          </div>
          <button onClick={() => router.push('/profile')} className="w-7 h-7 rounded-full bg-[#312ECB] text-white font-black text-[10px]">{user?.displayName?.[0] || 'U'}</button>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-800 px-3 py-1.5 flex items-center justify-between border-b dark:border-slate-700 z-40">
        <button onClick={() => router.push('/add-funds')} className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
          <Wallet size={10} /> <span className="text-[9px] font-black">₹{walletBalance.toFixed(0)}</span> <PlusCircle size={10} />
        </button>
        <button onClick={() => router.push('/orders')} className="text-[9px] font-black uppercase text-[#312ECB] dark:text-blue-400 flex items-center gap-1"><History size={12} /> HISTORY</button>
      </div>

      <main className="flex-1 overflow-y-auto p-2.5 flex flex-col whatsapp-bg relative pb-16">
        {activeBroadcast && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] p-6 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[280px] bg-white dark:bg-slate-900 rounded-[1.5rem] p-5 items-center text-center space-y-3 shadow-2xl">
              <Megaphone size={24} className="text-[#312ECB] mx-auto" />
              <p className="text-[11px] font-black text-slate-800 dark:text-white leading-relaxed">{activeBroadcast.text}</p>
              <Button onClick={() => setActiveBroadcast(null)} className="rounded-lg h-9 bg-[#312ECB] w-full uppercase font-black text-[9px]">Okay</Button>
            </div>
          </div>
        )}

        {messages.map((m: any) => (
          <MessageBubble key={m.id} sender={m.sender} text={m.text} options={m.options} onOptionClick={handleSend}
            isPaymentCard={m.isPaymentCard} paymentPrice={m.paymentPrice} rawPrice={m.rawPrice} onPaymentSubmit={(link, utr) => handleBundlePaymentSubmit(utr, link)}
            isSuccessCard={m.isSuccessCard} successDetails={m.successDetails} isBulkLinkCard={m.isBulkLinkCard} 
            onBulkLinksSubmit={(l) => { setCurrentOrder(p => ({ ...p, type: 'bulk', bulkLinks: l })); setChatState('choosing_service'); botReply(`Select Service (${globalDiscounts.bulk}% OFF):`, dynamicServices.map((s, i) => `${i + 1}. ${s.name}`)); }}
            isComboCard={m.isComboCard} onComboSubmit={(items, link) => { 
              const invalid = items.find(it => {
                const s = dynamicServices.find(ds => ds.id === it.serviceId);
                return it.quantity < (s?.minQuantity || 0);
              });
              if (invalid) {
                const s = dynamicServices.find(ds => ds.id === invalid.serviceId);
                toast({ variant: "destructive", title: "Qty Error", description: `${s?.name} min ${s?.minQuantity}.` });
                return;
              }
              const comboItems = items.map(it => ({ service: dynamicServices.find(s => s.id === it.serviceId)!, quantity: it.quantity, link }));
              setCurrentOrder(p => ({ ...p, type: 'combo', items: comboItems })); 
              setChatState('choosing_payment_method'); 
              const rawTotal = calculateRawPrice(comboItems, 'combo');
              const total = calculateTotalPrice(comboItems, 'combo');
              botReply(`🎁 Real: ₹${rawTotal.toFixed(2)}\n🔥 Combo: ₹${total.toFixed(2)} (${globalDiscounts.combo}% OFF)`, ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"]); 
            }}
            isWalletCard={m.isWalletCard} onWalletSubmit={handleBundleWalletSubmit} timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} dynamicServices={dynamicServices} 
            discountPct={m.discountPct ?? 0}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />

        <div className="fixed bottom-16 right-3 z-50 flex flex-col items-end gap-2">
          {showSocialMenu && (
            <div className="flex flex-col gap-2 mb-1 animate-in slide-in-from-bottom-5 duration-300">
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg"><Instagram size={16} /></a>
              )}
              {socialLinks?.whatsapp && (
                <a href={socialLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-lg"><MessageCircle size={16} /></a>
              )}
            </div>
          )}
          <button 
            onClick={() => setShowSocialMenu(!showSocialMenu)}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-90",
              showSocialMenu ? "bg-red-500 rotate-90" : "bg-[#312ECB]"
            )}
          >
            {showSocialMenu ? <X size={18} /> : <Share2 size={18} />}
          </button>
        </div>
      </main>

      <footer className="p-2 bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-50">
        <div className="flex items-center gap-2">
          <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type 'Hi'..." className="flex-1 bg-[#F0F2F5] dark:bg-slate-800 rounded-full h-9 border-none font-bold text-xs px-4" />
          <Button onClick={() => handleSend()} size="icon" className="rounded-full h-9 w-9 bg-[#25D366] hover:bg-[#20bd5b] shadow-md"><Send size={16} /></Button>
        </div>
      </footer>
    </div>
  );
}
