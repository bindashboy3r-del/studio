
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
  Bell, 
  Moon, 
  Sun,
  History,
  X,
  Megaphone,
  Zap,
  Wallet,
  PlusCircle,
  Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SMMService, Platform } from "@/app/lib/constants";
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [globalBonus, setGlobalBonus] = useState(0);
  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  
  const [sessionStartTime] = useState(() => Date.now());
  const hasInitialGreeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamic Services Listener
  const servicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db]);
  const { data: rawDynamicServices, isLoading: isServicesLoading } = useCollection<SMMService>(servicesQuery);

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
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  useEffect(() => {
    if (!db) return;
    onSnapshot(query(collection(db, "globalAnnouncements"), where("active", "==", true), limit(1)), (snap) => {
      if (!snap.empty) setActiveBroadcast(snap.docs[0].data());
      else setActiveBroadcast(null);
    });
    
    onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setGlobalBonus(snap.data().bonusPercentage || 0);
    });

    onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setGlobalDiscounts({
          single: d.single || 0,
          combo: d.combo || 0,
          bulk: d.bulk || 0
        });
      }
    });
  }, [db]);

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
    if (!isUserLoading && !user) router.push("/");
  }, [user, isUserLoading, router]);

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
      botReply("Send 'Hi' to start Instagram growth! 🚀");
    }
  }, [user, isMessagesLoading]);

  const calculateTotalPrice = (itemsOverride?: OrderItem[]) => {
    const items = itemsOverride || currentOrder.items;
    let total = items.reduce((total, item) => {
      const multiplier = (currentOrder.type === 'bulk' && currentOrder.bulkLinks) ? currentOrder.bulkLinks.length : 1;
      return total + (item.quantity / 1000) * (item.service?.pricePer1000 || 0) * multiplier;
    }, 0);

    const discPct = currentOrder.type === 'combo' ? globalDiscounts.combo : 
                    currentOrder.type === 'bulk' ? globalDiscounts.bulk : 
                    globalDiscounts.single;

    if (discPct > 0) {
      total = total * (1 - discPct / 100);
    }

    return total;
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
    botReply(`✅ Order submitted! Verification in progress.`, [], {
      isSuccessCard: true,
      successDetails: {
        orderId: orderResults[0].orderId, platform: 'Instagram', service: currentOrder.type === 'combo' ? 'Combo Order' : currentOrder.items[0]?.service?.name,
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
      botReply(`✅ Order placed from Wallet!`, [], {
        isSuccessCard: true,
        successDetails: { orderId: orderResults[0].orderId, platform: 'Instagram', service: 'Dynamic Order', quantity: 0, price: totalPrice, link: targets[0], utrId: 'WALLET' }
      });
    });
  };

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !user) return;
    if (!manualText) setInputValue("");
    await addMessage('user', text);
    const cleanText = text.toLowerCase();

    const serviceMatch = dynamicServices.find((s, i) => cleanText === (i + 1).toString() || cleanText.includes(s.name.toLowerCase()));

    if (serviceMatch) {
      setCurrentOrder(prev => ({ ...prev, items: [{ service: serviceMatch, quantity: 0, link: '' }] }));
      setChatState('entering_quantity');
      botReply(`📊 Quantity for ${serviceMatch.name}? (Min ${serviceMatch.minQuantity})`);
      return;
    }

    if (cleanText === 'hi' || cleanText.includes("menu")) {
      setChatState('choosing_order_type');
      const comboLabel = globalDiscounts.combo > 0 ? `2. COMBO ORDER (${globalDiscounts.combo}% OFF! 🎁)` : "2. COMBO ORDER";
      const bulkLabel = globalDiscounts.bulk > 0 ? `3. BULK ORDER (${globalDiscounts.bulk}% OFF!)` : "3. BULK ORDER";
      botReply("👋 Welcome! Choose your ordering method:", ["1. SINGLE ORDER", comboLabel, bulkLabel]);
      return;
    }

    switch (chatState) {
      case 'choosing_order_type':
        if (cleanText.includes("single")) {
          setChatState('choosing_service');
          botReply("Select Instagram service:", dynamicServices.map((s, i) => `${i + 1}. ${s.name}`));
        } else if (cleanText.includes("combo")) {
          setChatState('choosing_combo_services');
          botReply(`🎁 Configure Combo (${globalDiscounts.combo}% OFF):`, [], { isComboCard: true, dynamicServices, discountPct: globalDiscounts.combo });
        } else if (cleanText.includes("bulk")) {
          setChatState('entering_bulk_links');
          botReply("🔗 Add target links for Bulk Order:", [], { isBulkLinkCard: true });
        }
        break;
      case 'entering_quantity':
        const qty = parseInt(text);
        const s = currentOrder.items[0]?.service;
        if (s && qty >= s.minQuantity) {
          setCurrentOrder(prev => ({ ...prev, items: prev.items.map(i => ({ ...i, quantity: qty })) }));
          setChatState('choosing_payment_method');
          const total = calculateTotalPrice();
          botReply(`✅ Total: ₹${total.toFixed(2)}\n💳 Wallet: ₹${walletBalance.toFixed(2)}`, ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"]);
        } else if (s) {
          botReply(`⚠️ Minimum quantity for ${s.name} is ${s.minQuantity}. Kripya fir se enter karein.`);
        }
        break;
      case 'choosing_payment_method':
        if (cleanText.includes("wallet")) {
          const total = calculateTotalPrice();
          if (walletBalance >= total) botReply("💳 Confirm Wallet Payment:", [], { isWalletCard: true, paymentPrice: total });
          else botReply("❌ Insufficient balance!", ["💳 ADD FUNDS"]);
        } else if (cleanText.includes("upi")) {
          botReply(`📸 Pay ₹${calculateTotalPrice().toFixed(2)} via UPI:`, [], { isPaymentCard: true, paymentPrice: calculateTotalPrice() });
        }
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative shadow-2xl bg-white dark:bg-slate-950 font-body">
      <header className="bg-white dark:bg-slate-900 px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-[#312ECB] flex items-center justify-center text-white shadow-lg"><Zap className="fill-current" size={20} /></div>
          <h1 className="text-[20px] font-black italic tracking-tighter text-[#312ECB] dark:text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="text-slate-400">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
          <button onClick={() => router.push('/profile')} className="w-10 h-10 rounded-full bg-[#312ECB] text-white font-black">{user?.displayName?.[0] || 'U'}</button>
        </div>
      </header>

      <div className="bg-white px-6 py-3 flex items-center justify-between border-b z-40">
        <button onClick={() => router.push('/add-funds')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100">
          <Wallet size={14} /> <span className="text-[11px] font-black">₹{walletBalance.toFixed(2)}</span> <PlusCircle size={14} />
        </button>
        <button onClick={() => router.push('/orders')} className="text-[11px] font-black uppercase text-[#312ECB] flex items-center gap-2"><History size={16} /> HISTORY</button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-bg relative">
        {activeBroadcast && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] p-6 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[350px] bg-white rounded-[3rem] p-8 items-center text-center space-y-4">
              <Megaphone size={32} className="text-[#312ECB] mx-auto" />
              <p className="text-[15px] font-black text-slate-800">{activeBroadcast.text}</p>
              <Button onClick={() => setActiveBroadcast(null)} className="rounded-full bg-[#312ECB] w-full uppercase font-black">Close</Button>
            </div>
          </div>
        )}

        {messages.map((m: any) => (
          <MessageBubble key={m.id} sender={m.sender} text={m.text} options={m.options} onOptionClick={handleSend}
            isPaymentCard={m.isPaymentCard} paymentPrice={m.paymentPrice} onPaymentSubmit={(link, utr) => handleBundlePaymentSubmit(utr, link)}
            isSuccessCard={m.isSuccessCard} successDetails={m.successDetails} isBulkLinkCard={m.isBulkLinkCard} onBulkLinksSubmit={(l) => { setCurrentOrder(p => ({ ...p, type: 'bulk', bulkLinks: l })); setChatState('choosing_service'); botReply("Select Service:", dynamicServices.map((s, i) => `${i + 1}. ${s.name}`)); }}
            isComboCard={m.isComboCard} onComboSubmit={(items, link) => { setCurrentOrder(p => ({ ...p, type: 'combo', items: items.map(it => ({ service: dynamicServices.find(s => s.id === it.serviceId)!, quantity: it.quantity, link })) })); setChatState('choosing_payment_method'); botReply(`🎁 Combo Total: ₹${calculateTotalPrice().toFixed(2)}`, ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"]); }}
            isWalletCard={m.isWalletCard} onWalletSubmit={handleBundleWalletSubmit} timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} dynamicServices={dynamicServices} discountPct={globalDiscounts.combo}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />
      </main>

      <footer className="p-3 bg-white border-t z-50">
        <div className="flex items-center gap-3">
          <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type 'Hi' for Menu..." className="flex-1 bg-[#F0F2F5] rounded-full h-11" />
          <Button onClick={() => handleSend()} size="icon" className="rounded-full h-12 w-12 bg-[#25D366]"><Send size={22} /></Button>
        </div>
      </footer>
    </div>
  );
}
