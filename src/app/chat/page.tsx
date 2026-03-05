
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
  deleteDoc,
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
  Megaphone,
  Gift
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SMMService, Platform, PLATFORMS } from "@/app/lib/constants";
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
  | 'choosing_platform'
  | 'choosing_order_type'
  | 'bulk_adding_links'
  | 'choosing_service' 
  | 'entering_quantity' 
  | 'configuring_combo'
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
  tempLinks?: string[];
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
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  const [bonusPercentage, setBonusPercentage] = useState(0);
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
    const now = new Date();
    setSessionStart(Timestamp.fromDate(now));
  }, []);

  useEffect(() => {
    if (!isUserLoading && !currentUser) router.push("/");
  }, [currentUser, isUserLoading, router]);

  const servicesQuery = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db, currentUser]);
  const { data: rawDynamicServices } = useCollection<SMMService>(servicesQuery);

  const activeServices = useMemo(() => {
    if (!rawDynamicServices) return [];
    return [...rawDynamicServices].filter(s => s.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawDynamicServices]);

  // Unique Platforms derived from active services
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<Platform>();
    activeServices.forEach(s => {
      if (s.platform) platforms.add(s.platform);
    });
    return Array.from(platforms);
  }, [activeServices]);

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

    const unsubFinance = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setBonusPercentage(snap.data().bonusPercentage || 0);
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

    return () => { unsubBroadcast(); unsubDiscounts(); unsubFinance(); unsubSocial(); unsubPayment(); unsubNotifs(); };
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
    return addDoc(collection(db, "users", currentUser.uid, "chatMessages"), { 
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

  const cleanupIntermediateChats = async () => {
    if (!db || !currentUser) return;
    const q = query(collection(db, "users", currentUser.uid, "chatMessages"));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    
    snap.docs.forEach(d => {
      const data = d.data();
      const isPersistent = data.orderId || data.isInitialGreeting || data.isPermanent;
      if (!isPersistent) {
        batch.delete(d.ref);
      }
    });
    await batch.commit();
  };

  useEffect(() => {
    if (currentUser && !isMessagesLoading && !hasInitialGreeted.current && sessionStart) {
      hasInitialGreeted.current = true;
      if (!messages || messages.length === 0) {
        setChatState('initial');
        botReply("Send 'Hi' to grow your social media! 🚀", [], { isInitialGreeting: true, isPermanent: true });
      }
    }
  }, [currentUser, isMessagesLoading, messages, sessionStart]);

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !currentUser) return;
    if (!manualText) setInputValue("");

    const cleanText = text.toLowerCase();

    // --- 1. CRITICAL: Technical/Internal Command Handlers (Priority) ---
    if (cleanText === 'open_orders' || cleanText === 'OPEN_ORDERS') {
      setIsOrdersOpen(true);
      return;
    }

    if (text.startsWith("SUBMIT_BULK_LINKS:")) {
      const linksStr = text.replace("SUBMIT_BULK_LINKS:", "");
      const linksArr = linksStr.split('|').filter(l => l.trim());
      await addMessage('user', `Submitted ${linksArr.length} links for bulk order.`);
      setCurrentOrder(p => ({ ...p, tempLinks: linksArr }));
      setChatState('choosing_service');
      const filteredServices = activeServices.filter(s => s.platform === currentOrder.platform);
      botReply(`✅ ${linksArr.length} links saved! Now pick a service for these links:`, filteredServices.map((s, i) => `${i + 1}. ${s.name}`));
      return;
    }

    if (text.startsWith("SUBMIT_COMBO_CONFIG###")) {
      const [, itemsStr, linksInput, total] = text.split("###");
      await addMessage('user', "Proceeding with Combo Bundle...");
      const items = itemsStr.split('|').map(s => {
        const [id, q] = s.split(',');
        const service = activeServices.find(ds => ds.id === id)!;
        return { service, quantity: parseInt(q), link: linksInput };
      });
      setCurrentOrder(p => ({ ...p, type: 'combo', items }));
      setChatState('choosing_payment_method');
      const paymentOptions: string[] = [];
      if (paymentConfig?.walletEnabled !== false) paymentOptions.push("💳 PAY FROM WALLET");
      if (paymentConfig?.upiEnabled !== false) paymentOptions.push("📲 PAY VIA UPI QR");
      
      botReply(`✅ COMBO BUNDLE READY\n───────────────\nFinal Price: ₹${parseFloat(total).toFixed(2)}\n───────────────\nChoose Payment:`, paymentOptions, {
        paymentPrice: parseFloat(total),
        rawPrice: items.reduce((acc, it) => acc + (it.quantity/1000) * (it.service.pricePer1000 || 0), 0),
        discountPct: globalDiscounts.combo,
        serviceName: "Combo Bundle",
        quantity: items[0].quantity,
        isCombo: true
      });
      return;
    }

    if (text.startsWith("SUBMIT_PAYMENT###")) {
      const [, linksInput, utr] = text.split("###");
      await addMessage('user', `Payment Submitted (UTR: ${utr})`, [], { isPermanent: true });
      
      const type = currentOrder.type || 'single';
      const disc = globalDiscounts[type] || 0;
      const linksArr = linksInput.split('\n').filter(l => l.trim());
      const numLinks = linksArr.length;

      let totalPrice = 0;
      let serviceNames = "";

      if (type === 'combo') {
        const basePrice = currentOrder.items.reduce((acc, item) => acc + (item.quantity / 1000) * (item.service.pricePer1000 || 0), 0);
        totalPrice = basePrice * (1 - disc / 100);
        serviceNames = "Combo Bundle";
      } else {
        const s = currentOrder.items[0]?.service;
        const qty = currentOrder.items[0]?.quantity;
        totalPrice = (qty / 1000) * (s.pricePer1000 || 0) * (1 - disc / 100) * numLinks;
        serviceNames = s?.name || "Service";
      }

      const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
      const autoCompleteAt = new Date(Date.now() + 45 * 60 * 1000);

      await addDoc(collection(db, "users", currentUser.uid, "orders"), {
        orderId, service: serviceNames, quantity: currentOrder.items[0]?.quantity || 0, price: totalPrice,
        status: 'Pending', type: 'Manual', links: linksArr, utrId: utr, platform: currentOrder.platform, 
        createdAt: serverTimestamp(),
        autoCompleteAt: Timestamp.fromDate(autoCompleteAt)
      });

      botReply("Order Placed Successfully!", [], { 
        orderId, 
        isPermanent: true, 
        isSuccessCard: true, 
        showWhatsAppSuccess: true,
        paymentPrice: totalPrice,
        serviceName: serviceNames,
        quantity: currentOrder.items[0]?.quantity || 0,
        prefilledLinks: linksInput,
        utrId: utr
      });
      setChatState('idle');
      return;
    }

    if (text.startsWith("CONFIRM_WALLET###")) {
      const [, linksInput] = text.split("###");
      await addMessage('user', "Confirming Wallet Payment...", [], { isPermanent: true });
      const type = currentOrder.type || 'single';
      const disc = globalDiscounts[type] || 0;
      const linksArr = linksInput.split('\n').filter(l => l.trim());
      const numLinks = linksArr.length;

      let totalPrice = 0;
      let serviceNames = "";
      if (type === 'combo') {
        const basePrice = currentOrder.items.reduce((acc, item) => acc + (item.quantity / 1000) * (item.service.pricePer1000 || 0), 0);
        totalPrice = basePrice * (1 - disc / 100);
        serviceNames = "Combo Bundle";
      } else {
        const s = currentOrder.items[0].service;
        const qty = currentOrder.items[0].quantity;
        totalPrice = (qty / 1000) * (s.pricePer1000 || 0) * (1 - disc / 100) * numLinks;
        serviceNames = s.name;
      }
      
      if (walletBalance >= totalPrice) {
        setIsTyping(true);
        try {
          const apiSnap = await getDoc(doc(db, "globalSettings", "api"));
          const apiData = apiSnap.data();
          const batch = writeBatch(db);
          const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
          const autoCompleteAt = new Date(Date.now() + 45 * 60 * 1000);

          if (type === 'combo') {
            for (const item of currentOrder.items) {
              const mapping = apiData?.mappings?.[item.service.id];
              const provider = apiData?.providers?.find((p: any) => p.id === mapping?.providerId);
              if (provider && mapping?.remoteServiceId) {
                await placeApiOrder({ apiUrl: provider.url, apiKey: provider.key, serviceId: mapping.remoteServiceId, link: linksArr[0], quantity: item.quantity });
              }
            }
          } else {
            const s = currentOrder.items[0].service;
            const qty = currentOrder.items[0].quantity;
            for (const l of linksArr) {
              const mapping = apiData?.mappings?.[s.id];
              const provider = apiData?.providers?.find((p: any) => p.id === mapping?.providerId);
              if (provider && mapping?.remoteServiceId) {
                await placeApiOrder({ apiUrl: provider.url, apiKey: provider.key, serviceId: mapping.remoteServiceId, link: l, quantity: qty });
              }
            }
          }

          const userOrderRef = doc(collection(db, "users", currentUser.uid, "orders"));
          batch.update(userDocRef!, { balance: increment(-totalPrice) });
          batch.set(userOrderRef, {
            orderId, service: serviceNames,
            quantity: currentOrder.items[0].quantity, price: totalPrice, status: 'Processing', type: 'API',
            links: linksArr, platform: currentOrder.platform, createdAt: serverTimestamp(),
            autoCompleteAt: Timestamp.fromDate(autoCompleteAt)
          });
          await batch.commit();
          
          botReply("Order Placed Successfully!", [], { 
            orderId, 
            isPermanent: true, 
            isSuccessCard: true, 
            showWhatsAppSuccess: false,
            paymentPrice: totalPrice,
            serviceName: serviceNames,
            quantity: currentOrder.items[0].quantity,
            prefilledLinks: linksInput
          });
          setChatState('idle');
        } catch (e) { botReply("❌ Kuch technical issue hua."); } finally { setIsTyping(false); }
      } else { botReply("❌ Low Balance!"); }
      return;
    }

    // --- 2. Basic Triggers ---
    if (cleanText === 'hi' || cleanText === 'menu') {
      await cleanupIntermediateChats();
      await addMessage('user', text, [], { isPermanent: true });
      
      if (availablePlatforms.length > 1) {
        setChatState('choosing_platform');
        botReply("Choose your platform:", availablePlatforms.map((p, i) => `${i + 1}. ${PLATFORMS[p]}`), { isPermanent: true });
      } else {
        const platform = availablePlatforms[0] || 'instagram';
        setCurrentOrder(p => ({ ...p, platform }));
        setChatState('choosing_order_type');
        botReply(`Choose your boost style for ${PLATFORMS[platform]}:`, [
          `1. SINGLE ORDER (${globalDiscounts.single}% OFF)`, 
          `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)`, 
          `3. BULK ORDER (${globalDiscounts.bulk}% OFF)`
        ], { isPermanent: true });
      }
      return;
    }

    // --- 3. Intent Detection (Order Type, Platform, Service) ---
    
    // Order Type Selection
    if (cleanText.includes("single order") || cleanText.includes("combo order") || cleanText.includes("bulk order")) {
      await cleanupIntermediateChats(); 
      await addMessage('user', text, [], { isPermanent: true }); 
      
      const filteredServices = activeServices.filter(s => s.platform === currentOrder.platform);

      if (cleanText.includes("single order")) {
        setChatState('choosing_service'); 
        setCurrentOrder(p => ({ ...p, type: 'single', items: [] }));
        botReply(`Pick a Service. You get ${globalDiscounts.single}% OFF!`, filteredServices.map((s, i) => `${i + 1}. ${s.name}`));
      } else if (cleanText.includes("combo order")) {
        setChatState('configuring_combo'); 
        setCurrentOrder(p => ({ ...p, type: 'combo', items: [] }));
        botReply("Configure your custom combo bundle:", [], { 
          isComboConfigCard: true, 
          discountPct: globalDiscounts.combo,
          dynamicServices: filteredServices
        });
      } else if (cleanText.includes("bulk order")) {
        setChatState('bulk_adding_links'); 
        setCurrentOrder(p => ({ ...p, type: 'bulk', items: [], tempLinks: [] }));
        botReply(`🚀 BULK MODE: Add links one by one. Click SUBMIT when finished!`, [], { isBulkLinkCard: true });
      }
      return;
    }

    // Global Platform Intent Detection
    const platformMatchByName = availablePlatforms.find(p => cleanText.includes(PLATFORMS[p].toLowerCase()));
    const platformMatchByIndex = (chatState === 'choosing_platform' || chatState === 'initial') 
      ? availablePlatforms.find((p, i) => cleanText === (i + 1).toString()) 
      : null;
    const platformMatch = platformMatchByName || platformMatchByIndex;

    if (platformMatch) {
      if (chatState !== 'choosing_platform' && chatState !== 'initial') {
        await cleanupIntermediateChats();
      }
      await addMessage('user', PLATFORMS[platformMatch]);
      setCurrentOrder(p => ({ ...p, platform: platformMatch }));
      setChatState('choosing_order_type');
      botReply(`Great! Choose your boost style for ${PLATFORMS[platformMatch]}:`, [
        `1. SINGLE ORDER (${globalDiscounts.single}% OFF)`, 
        `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)`, 
        `3. BULK ORDER (${globalDiscounts.bulk}% OFF)`
      ], { isPermanent: true });
      return;
    }

    // Global Service Intent Detection
    const filteredServices = activeServices.filter(s => s.platform === currentOrder.platform);
    const serviceMatchByName = filteredServices.find(s => cleanText.includes(s.name.toLowerCase()));
    const serviceMatchByIndex = (chatState === 'choosing_service') 
      ? filteredServices.find((s, i) => cleanText === (i + 1).toString()) 
      : null;
    const serviceMatch = serviceMatchByName || serviceMatchByIndex;

    if (serviceMatch) {
      if (chatState === 'entering_quantity' || chatState === 'choosing_payment_method') {
        await cleanupIntermediateChats();
      }
      setCurrentOrder(p => ({ ...p, items: [{ service: serviceMatch, quantity: 0, link: '' }] }));
      setChatState('entering_quantity');
      botReply(`📊 Enter Quantity for ${serviceMatch.name}?\n(Minimum: ${serviceMatch.minQuantity})`);
      return;
    }

    // --- 4. State-Based Fallbacks ---
    await addMessage('user', text);

    if (chatState === 'entering_quantity') {
      const qty = parseInt(text);
      if (isNaN(qty)) return;
      const type = currentOrder.type || 'single';
      const minNeeded = currentOrder.items[0]?.service.minQuantity;
      if (qty >= minNeeded) {
        const updatedItems = currentOrder.items.map(item => ({ ...item, quantity: qty }));
        setCurrentOrder(p => ({ ...p, items: updatedItems }));
        setChatState('choosing_payment_method');
        const numLinks = type === 'bulk' ? (currentOrder.tempLinks?.length || 1) : 1;
        const rawPrice = (qty / 1000) * (currentOrder.items[0].service.pricePer1000 || 0) * numLinks;
        const disc = globalDiscounts[type] || 0;
        const discounted = rawPrice * (1 - disc / 100);
        const paymentOptions: string[] = [];
        if (paymentConfig?.walletEnabled !== false) paymentOptions.push("💳 PAY FROM WALLET");
        if (paymentConfig?.upiEnabled !== false) paymentOptions.push("📲 PAY VIA UPI QR");
        botReply(`✅ ${type.toUpperCase()} SUMMARY\nPrice: ₹${discounted.toFixed(2)}`, paymentOptions, { 
          rawPrice, paymentPrice: discounted, discountPct: disc, isBulk: type === 'bulk',
          prefilledLinks: type === 'bulk' ? currentOrder.tempLinks?.join('\n') : '',
          serviceName: currentOrder.items[0].service.name,
          quantity: qty,
          walletBalance: walletBalance
        });
      } else { botReply(`⚠️ Error: Minimum ${minNeeded} required.`); }
      return;
    }

    if (chatState === 'choosing_payment_method') {
      const type = currentOrder.type || 'single';
      const disc = globalDiscounts[type] || 0;
      let rawPrice = 0; let serviceName = ""; let qty = 0;
      const numLinks = type === 'bulk' ? (currentOrder.tempLinks?.length || 1) : 1;
      if (type === 'combo') {
        rawPrice = currentOrder.items.reduce((acc, item) => acc + (item.quantity / 1000) * (item.service.pricePer1000 || 0), 0);
        serviceName = "Combo Bundle";
        qty = currentOrder.items[0].quantity;
      } else {
        qty = currentOrder.items[0]?.quantity;
        rawPrice = (qty / 1000) * (currentOrder.items[0].service.pricePer1000 || 0) * numLinks;
        serviceName = currentOrder.items[0].service.name;
      }
      const discounted = rawPrice * (1 - disc / 100);
      if (cleanText.includes("wallet")) {
        if (walletBalance >= discounted) {
          botReply(type === 'bulk' ? `Confirm Bulk Order?` : `Enter Link & Confirm?`, [], { 
            isWalletCard: true, paymentPrice: discounted, rawPrice, discountPct: disc,
            serviceName, quantity: qty, isBulk: type === 'bulk',
            prefilledLinks: type === 'combo' ? currentOrder.items[0]?.link : (type === 'bulk' ? currentOrder.tempLinks?.join('\n') : ''),
            walletBalance: walletBalance,
            isCombo: type === 'combo'
          });
        } else { botReply("❌ Low Balance!", ["💳 ADD FUNDS", "🏠 MENU"]); }
      } else if (cleanText.includes("upi")) {
        botReply(`Scan QR:`, [], { 
          isPaymentCard: true, paymentPrice: discounted, rawPrice, discountPct: disc,
          serviceName, quantity: qty, isBulk: type === 'bulk',
          prefilledLinks: type === 'combo' ? currentOrder.items[0]?.link : (type === 'bulk' ? currentOrder.tempLinks?.join('\n') : ''),
          walletBalance: walletBalance,
          isCombo: type === 'combo'
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
        <div className="flex flex-col gap-1">
          <button onClick={() => router.push('/add-funds')} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 shadow-3d-sm active:shadow-3d-pressed">
            <Wallet size={14} /><span className="text-[11px] font-black text-emerald-400">₹{walletBalance.toFixed(0)}</span><PlusCircle size={14} />
          </button>
          {bonusPercentage > 0 && (
            <div className="flex items-center gap-1.5 px-2 animate-pulse">
              <Gift size={10} className="text-pink-500" />
              <span className="text-[8px] font-black text-pink-400 uppercase tracking-widest">Refill & Get {bonusPercentage}% Extra! 🎁</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsOrdersOpen(true)} className="text-[10px] font-black uppercase text-[#312ECB] flex items-center gap-1.5 shadow-3d-sm rounded-xl px-3 py-1.5 active:shadow-3d-pressed">
            <Package size={14} /> ORDERS
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col relative pb-24 custom-scrollbar">
        {messages?.map(m => (
          <MessageBubble 
            key={m.id} sender={m.sender} text={m.text} options={m.options} onOptionClick={handleSend} 
            isPaymentCard={m.isPaymentCard} paymentPrice={m.paymentPrice} rawPrice={m.rawPrice}
            isWalletCard={m.isWalletCard} isComboConfigCard={m.isComboConfigCard} isBulkLinkCard={m.isBulkLinkCard}
            isSuccessCard={m.isSuccessCard} showWhatsAppSuccess={m.showWhatsAppSuccess} utrId={m.utrId} orderId={m.orderId}
            timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} 
            dynamicServices={m.dynamicServices || activeServices.filter(s => s.platform === currentOrder.platform)} 
            discountPct={m.discountPct ?? 0} serviceName={m.serviceName} quantity={m.quantity}
            isBulk={m.isBulk} prefilledLinks={m.prefilledLinks} walletBalance={m.walletBalance || walletBalance}
            isCombo={m.isCombo}
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
            value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} 
            placeholder="Type your Request..." className="flex-1 bg-transparent border-none font-bold text-sm h-11 focus-visible:ring-0 text-white placeholder:text-slate-600" 
          />
          <Button onClick={() => handleSend()} size="icon" className="rounded-2xl h-10 w-10 bg-[#312ECB] hover:bg-[#2825A6] shadow-3d active:shadow-3d-pressed">
            <Send size={18} />
          </Button>
        </div>
      </footer>

      {/* Dialogs */}
      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-3d bg-[#030712] p-0 overflow-hidden">
          <header className="bg-gradient-to-r from-[#312ECB] to-purple-600 p-6 text-white relative text-center">
             <Megaphone size={24} className="mx-auto animate-pulse" />
             <DialogTitle className="text-white font-black uppercase text-[10px] tracking-[0.3em] mt-2">Special Update</DialogTitle>
          </header>
          <div className="p-8 space-y-6 text-center">
             <p className="text-[13px] font-bold text-slate-200 leading-relaxed italic">"{activeBroadcast?.text}"</p>
             <Button onClick={() => setIsBroadcastOpen(false)} className="w-full h-12 bg-[#312ECB] text-white font-black uppercase tracking-widest rounded-2xl">Got it!</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNotifOpen} onOpenChange={setIsNotifOpen}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-3d bg-[#030712] p-0 overflow-hidden">
          <header className="bg-[#312ECB] p-6 text-white flex items-center justify-between">
             <DialogTitle className="text-white font-black uppercase text-xs">Notifications</DialogTitle>
             <Button onClick={handleClearNotifs} variant="ghost" className="h-7 text-[8px] uppercase bg-white/10 rounded-lg">Clear All</Button>
          </header>
          <ScrollArea className="h-[400px] p-4">
             <div className="space-y-3">
                {notifications.length > 0 ? notifications.map(n => (
                  <div key={n.id} onClick={handleClearNotifs} className="bg-slate-900 p-4 rounded-2xl border border-white/5 flex items-start gap-3">
                    <Zap size={14} className="text-[#312ECB] shrink-0" />
                    <div className="space-y-0.5"><p className="text-[11px] font-black text-white">{n.title}</p><p className="text-[10px] text-slate-400">{n.message}</p></div>
                  </div>
                )) : <p className="text-center py-20 text-slate-600 uppercase text-[10px] font-black">Inbox Clear</p>}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
        <DialogContent className="max-w-[360px] rounded-[2.5rem] border-none shadow-3d bg-[#030712] p-0 overflow-hidden">
          <header className="bg-slate-900 px-6 py-4 border-b border-white/5">
             <DialogTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Order History</DialogTitle>
          </header>
          <ScrollArea className="h-[500px] p-4">
             <div className="space-y-3">
                {userOrders.length > 0 ? userOrders.map((order: any) => (
                  <div key={order.id} className="bg-slate-900 p-4 rounded-[1.2rem] border border-white/5">
                     <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black uppercase text-[#312ECB]">{order.service}</h3>
                        <Badge className="text-[8px] uppercase bg-white/5 border-white/10 text-slate-400">{order.platform}</Badge>
                     </div>
                     <div className="flex items-center gap-2.5 mt-1 text-[9px] font-bold text-slate-400">
                        <span>Qty: {order.quantity}</span>
                        <span className="text-emerald-600">₹{order.price?.toFixed(2)}</span>
                        <Badge className="ml-auto bg-blue-500/10 text-blue-500">{order.status}</Badge>
                     </div>
                  </div>
                )) : <p className="text-center py-20 text-slate-600 uppercase text-[10px] font-black">No Orders</p>}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
