
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
  X,
  Zap,
  Wallet,
  PlusCircle,
  Share2,
  Instagram,
  MessageCircle,
  Bell,
  Package,
  Megaphone,
  Gift,
  ExternalLink
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
    setSessionStart(Timestamp.fromDate(new Date()));
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

  const availablePlatforms = useMemo(() => {
    const platforms = new Set<Platform>();
    activeServices.forEach(s => { if (s.platform) platforms.add(s.platform); });
    return Array.from(platforms);
  }, [activeServices]);

  const { data: userData } = useDoc(useMemoFirebase(() => currentUser && db ? doc(db, "users", currentUser.uid) : null, [db, currentUser]));
  const walletBalance = userData?.balance || 0;

  useEffect(() => {
    if (!db || !currentUser) return; 
    
    const unsubBroadcast = onSnapshot(query(collection(db, "globalAnnouncements"), where("active", "==", true)), (snap) => {
      if (!snap.empty) {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        docs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        setActiveBroadcast(docs[0]);
        if (!hasBroadcastShown.current) { setIsBroadcastOpen(true); hasBroadcastShown.current = true; }
      }
    });

    onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) setGlobalDiscounts({ single: snap.data().single || 0, combo: snap.data().combo || 0, bulk: snap.data().bulk || 0 });
    });

    onSnapshot(doc(db, "globalSettings", "finance"), (snap) => { if (snap.exists()) setBonusPercentage(snap.data().bonusPercentage || 0); });
    onSnapshot(doc(db, "globalSettings", "social"), (snap) => { if (snap.exists()) setSocialLinks(snap.data()); });
    onSnapshot(doc(db, "globalSettings", "payment"), (snap) => { if (snap.exists()) setPaymentConfig(snap.data()); });
    onSnapshot(collection(db, "users", currentUser.uid, "notifications"), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((n: any) => !n.read));
    });
  }, [db, currentUser]);

  const { data: rawOrders } = useCollection(useMemoFirebase(() => isOrdersOpen && currentUser && db ? collection(db, "users", currentUser.uid, "orders") : null, [db, currentUser, isOrdersOpen]));
  const userOrders = useMemo(() => (rawOrders || []).map(o => ({ ...o, createdAt: o.createdAt?.toDate ? o.createdAt.toDate() : new Date() })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), [rawOrders]);

  const { data: messages, isLoading: isMessagesLoading } = useCollection(useMemoFirebase(() => db && currentUser && sessionStart ? query(collection(db, "users", currentUser.uid, "chatMessages"), where("timestamp", ">=", sessionStart), orderBy("timestamp", "asc")) : null, [db, currentUser, sessionStart]));

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const addMessage = async (sender: 'user' | 'bot', text: string, options?: string[], extraData?: any) => {
    if (!currentUser || !db) return;
    return addDoc(collection(db, "users", currentUser.uid, "chatMessages"), { sender, text, options: options || [], timestamp: serverTimestamp(), userId: currentUser.uid, ...extraData });
  };

  const botReply = async (text: string, options?: string[], extraData?: any) => {
    setIsTyping(true);
    setTimeout(async () => { await addMessage('bot', text, options, extraData); setIsTyping(false); }, 800);
  };

  useEffect(() => {
    if (currentUser && !isMessagesLoading && !hasInitialGreeted.current && sessionStart) {
      hasInitialGreeted.current = true;
      if (!messages?.length) { setChatState('initial'); botReply("Send 'Hi' to grow your social media! 🚀", [], { isInitialGreeting: true, isPermanent: true }); }
    }
  }, [currentUser, isMessagesLoading, messages, sessionStart]);

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !currentUser) return;
    if (!manualText) setInputValue("");

    // --- STEP 1: TECHNICAL COMMAND PRIORITY ---
    // This prevents technical data (like combo items) from being misidentified as "YouTube" or "Instagram" platform jumps.
    if (text.startsWith("SUBMIT_BULK_LINKS:")) {
      const linksArr = text.replace("SUBMIT_BULK_LINKS:", "").split('|').filter(l => l.trim());
      await addMessage('user', `Submitted ${linksArr.length} links for bulk order.`);
      setCurrentOrder(p => ({ ...p, tempLinks: linksArr }));
      setChatState('choosing_service');
      const filtered = activeServices.filter(s => s.platform === currentOrder.platform);
      botReply(`✅ ${linksArr.length} links saved! Now pick a service:`, filtered.map((s, i) => `${i + 1}. ${s.name}`));
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
      const opts: string[] = [];
      if (paymentConfig?.walletEnabled !== false) opts.push("💳 PAY FROM WALLET");
      if (paymentConfig?.upiEnabled !== false) opts.push("📲 PAY VIA UPI QR");
      botReply(`✅ COMBO READY\nPrice: ₹${parseFloat(total).toFixed(2)}`, opts, { 
        paymentPrice: parseFloat(total), 
        rawPrice: items.reduce((acc, it) => acc + (it.quantity/1000)*(it.service.pricePer1000||0), 0), 
        discountPct: globalDiscounts.combo, 
        serviceName: "Combo Bundle", 
        quantity: items[0].quantity, 
        isCombo: true,
        prefilledLinks: linksInput
      });
      return;
    }

    if (text.startsWith("SUBMIT_PAYMENT###") || text.startsWith("CONFIRM_WALLET###")) {
      const isWallet = text.startsWith("CONFIRM_WALLET###");
      const parts = text.split("###");
      const linksInput = parts[1];
      const utr = parts[2] || "";
      await addMessage('user', isWallet ? "Confirming Wallet Payment..." : `Payment Submitted (UTR: ${utr})`, [], { isPermanent: true });
      
      const type = currentOrder.type || 'single';
      const disc = globalDiscounts[type] || 0;
      const linksArr = linksInput.split('\n').filter(l => l.trim());
      let totalPrice = 0; let serviceNames = ""; let qty = 0;

      if (type === 'combo') {
        const base = currentOrder.items.reduce((acc, item) => acc + (item.quantity / 1000) * (item.service.pricePer1000 || 0), 0);
        totalPrice = base * (1 - disc / 100); serviceNames = "Combo Bundle"; qty = currentOrder.items[0].quantity;
      } else {
        const s = currentOrder.items[0].service; qty = currentOrder.items[0].quantity;
        totalPrice = (qty / 1000) * (s.pricePer1000 || 0) * (1 - disc / 100) * linksArr.length; serviceNames = s.name;
      }

      if (isWallet && walletBalance < totalPrice) { botReply("❌ Low Balance!"); return; }

      const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
      const batch = writeBatch(db);
      if (isWallet) batch.update(doc(db, "users", currentUser.uid), { balance: increment(-totalPrice) });
      
      batch.set(doc(collection(db, "users", currentUser.uid, "orders")), {
        orderId, service: serviceNames, quantity: qty, price: totalPrice,
        status: isWallet ? 'Processing' : 'Pending', type: isWallet ? 'API' : 'Manual',
        links: linksArr, utrId: utr, platform: currentOrder.platform, createdAt: serverTimestamp(),
        autoCompleteAt: Timestamp.fromDate(new Date(Date.now() + 45 * 60 * 1000))
      });
      await batch.commit();

      botReply("Order Placed Successfully!", [], { orderId, isPermanent: true, isSuccessCard: true, showWhatsAppSuccess: !isWallet, paymentPrice: totalPrice, serviceName: serviceNames, quantity: qty, prefilledLinks: linksInput });
      setChatState('idle');
      return;
    }

    // --- STEP 2: DYNAMIC INTENT MATCHING (Path Jumping) ---
    const cleanText = text.toLowerCase();
    
    // Check if user mentioned a platform name to switch paths
    const platformMatch = availablePlatforms.find((p, i) => 
      cleanText.includes(PLATFORMS[p].toLowerCase()) || 
      (chatState === 'choosing_platform' && cleanText === (i + 1).toString())
    );

    if (platformMatch) {
      // CLEANUP logic: If user was in the middle of something, restart
      if (chatState !== 'choosing_platform' && chatState !== 'idle') {
        const q = query(collection(db, "users", currentUser.uid, "chatMessages"), where("isPermanent", "!=", true));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      setCurrentOrder(p => ({ ...p, platform: platformMatch, items: [] }));
      setChatState('choosing_order_type');
      botReply(`Choose boost style for ${PLATFORMS[platformMatch]}:`, [
        `1. SINGLE ORDER (${globalDiscounts.single}% OFF)`, 
        `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)`, 
        `3. BULK ORDER (${globalDiscounts.bulk}% OFF)`
      ], { isPermanent: true });
      return;
    }

    if (cleanText === 'hi' || cleanText === 'menu') {
      await addMessage('user', text, [], { isPermanent: true });
      if (availablePlatforms.length > 1) {
        setChatState('choosing_platform');
        botReply("Choose your platform:", availablePlatforms.map((p, i) => `${i + 1}. ${PLATFORMS[p]}`), { isPermanent: true });
      } else {
        const p = availablePlatforms[0] || 'instagram';
        setCurrentOrder(prev => ({ ...prev, platform: p }));
        setChatState('choosing_order_type');
        botReply(`Choose boost style for ${PLATFORMS[p]}:`, [
          `1. SINGLE ORDER (${globalDiscounts.single}% OFF)`, 
          `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)`, 
          `3. BULK ORDER (${globalDiscounts.bulk}% OFF)`
        ], { isPermanent: true });
      }
      return;
    }

    if (cleanText.includes("single order") || cleanText.includes("combo order") || cleanText.includes("bulk order")) {
      const filtered = activeServices.filter(s => s.platform === currentOrder.platform);
      if (cleanText.includes("single")) { setChatState('choosing_service'); botReply(`Pick a Service:`, filtered.map((s, i) => `${i + 1}. ${s.name}`)); }
      else if (cleanText.includes("combo")) { setChatState('configuring_combo'); botReply("Configure combo:", [], { isComboConfigCard: true, discountPct: globalDiscounts.combo, dynamicServices: filtered }); }
      else { setChatState('bulk_adding_links'); botReply(`BULK MODE: Add links and click SUBMIT.`, [], { isBulkLinkCard: true }); }
      return;
    }

    const filtered = activeServices.filter(s => s.platform === currentOrder.platform);
    const serviceMatch = filtered.find((s, i) => cleanText.includes(s.name.toLowerCase()) || (chatState === 'choosing_service' && cleanText === (i + 1).toString()));
    
    if (serviceMatch) {
      setCurrentOrder(p => ({ ...p, items: [{ service: serviceMatch, quantity: 0, link: '' }] }));
      setChatState('entering_quantity');
      botReply(`📊 Enter Quantity for ${serviceMatch.name}? (Min: ${serviceMatch.minQuantity})`);
      return;
    }

    // --- STEP 3: FALLBACK CONVERSATION ---
    await addMessage('user', text);
    
    if (chatState === 'entering_quantity') {
      const q = parseInt(text);
      if (isNaN(q) || q < currentOrder.items[0].service.minQuantity) { botReply(`⚠️ Min ${currentOrder.items[0].service.minQuantity} required.`); return; }
      setCurrentOrder(p => ({ ...p, items: [{ ...p.items[0], quantity: q }] }));
      setChatState('choosing_payment_method');
      const opts: string[] = [];
      if (paymentConfig?.walletEnabled !== false) opts.push("💳 PAY FROM WALLET");
      if (paymentConfig?.upiEnabled !== false) opts.push("📲 PAY VIA UPI QR");
      const raw = (q/1000) * currentOrder.items[0].service.pricePer1000 * (currentOrder.type === 'bulk' ? (currentOrder.tempLinks?.length || 1) : 1);
      const disc = globalDiscounts[currentOrder.type || 'single'];
      botReply(`✅ SUMMARY\nPrice: ₹${(raw * (1 - disc/100)).toFixed(2)}`, opts, { rawPrice: raw, paymentPrice: raw * (1-disc/100), discountPct: disc, serviceName: currentOrder.items[0].service.name, quantity: q, walletBalance });
      return;
    }

    if (chatState === 'choosing_payment_method') {
      const isWallet = cleanText.includes("wallet");
      const isUpi = cleanText.includes("upi");
      if (isWallet || isUpi) {
        const type = currentOrder.type || 'single';
        const disc = globalDiscounts[type];
        const qty = currentOrder.items[0].quantity;
        const num = type === 'bulk' ? (currentOrder.tempLinks?.length || 1) : 1;
        const raw = (qty/1000) * currentOrder.items[0].service.pricePer1000 * num;
        const final = raw * (1 - disc/100);
        botReply(isWallet ? "Confirm Order?" : "Scan QR:", [], { 
          isWalletCard: isWallet, 
          isPaymentCard: isUpi, 
          paymentPrice: final, 
          rawPrice: raw, 
          discountPct: disc, 
          serviceName: currentOrder.items[0].service.name, 
          quantity: qty, 
          prefilledLinks: currentOrder.tempLinks?.join('\n') || '', 
          walletBalance 
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto whatsapp-bg font-body overflow-hidden">
      <header className="glass-header px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#312ECB] flex items-center justify-center text-white"><Zap size={18} /></div>
          <h1 className="text-[18px] font-black italic tracking-tighter text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsNotifOpen(true)} className="relative p-2 text-slate-400"><Bell size={20} />{notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900" />}</button>
          <button onClick={() => router.push('/profile')} className="w-9 h-9 rounded-2xl bg-slate-800 text-white font-black text-sm">{currentUser?.displayName?.[0] || 'U'}</button>
        </div>
      </header>

      <div className="bg-slate-900/50 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <button onClick={() => router.push('/add-funds')} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20">
          <Wallet size={14} /><span className="text-[11px] font-black">₹{walletBalance.toFixed(0)}</span><PlusCircle size={14} />
        </button>
        <button onClick={() => setIsOrdersOpen(true)} className="text-[10px] font-black uppercase text-[#312ECB] flex items-center gap-1.5 px-3 py-1.5"><Package size={14} /> ORDERS</button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col relative custom-scrollbar">
        {messages?.map(m => (
          <MessageBubble key={m.id} sender={m.sender} text={m.text} options={m.options} onOptionClick={handleSend} isPaymentCard={m.isPaymentCard} paymentPrice={m.paymentPrice} rawPrice={m.rawPrice} isWalletCard={m.isWalletCard} isComboConfigCard={m.isComboConfigCard} isBulkLinkCard={m.isBulkLinkCard} isSuccessCard={m.isSuccessCard} showWhatsAppSuccess={m.showWhatsAppSuccess} orderId={m.orderId} timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} dynamicServices={m.dynamicServices || activeServices.filter(s => s.platform === currentOrder.platform)} discountPct={m.discountPct ?? 0} serviceName={m.serviceName} quantity={m.quantity} prefilledLinks={m.prefilledLinks} walletBalance={m.walletBalance || walletBalance} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />
      </main>

      <footer className="p-4 bg-slate-900/80 backdrop-blur-xl border-t border-white/5">
        <div className="flex items-center gap-3 bg-slate-950 rounded-[1.8rem] p-1.5">
          <Input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Type your Request..." className="flex-1 bg-transparent border-none font-bold text-sm h-11 text-white placeholder:text-slate-600 focus-visible:ring-0" />
          <Button onClick={() => handleSend()} size="icon" className="rounded-2xl h-10 w-10 bg-[#312ECB]"><Send size={18} /></Button>
        </div>
      </footer>

      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-2xl bg-[#030712] p-0 overflow-hidden">
          <header className="bg-gradient-to-r from-[#312ECB] to-purple-600 p-6 text-white text-center">
             <Megaphone size={24} className="mx-auto" />
             <DialogTitle className="font-black uppercase text-[10px] tracking-widest mt-2">Special Update</DialogTitle>
          </header>
          <div className="p-8 space-y-6 text-center">
             <p className="text-[13px] font-bold text-slate-200 leading-relaxed italic">"{activeBroadcast?.text}"</p>
             {activeBroadcast?.buttonUrl && (
               <Button asChild className="w-full h-12 bg-white text-slate-900 font-black uppercase tracking-widest rounded-2xl gap-2">
                 <a href={activeBroadcast.buttonUrl} target="_blank" rel="noopener noreferrer">{activeBroadcast.buttonText || "Open Link"} <ExternalLink size={14} /></a>
               </Button>
             )}
             <Button onClick={() => setIsBroadcastOpen(false)} variant="ghost" className="w-full text-slate-500 font-black uppercase text-[10px]">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOrdersOpen} onOpenChange={setIsOrdersOpen}>
        <DialogContent className="max-w-[360px] rounded-[2.5rem] bg-[#030712] p-0 overflow-hidden">
          <header className="bg-slate-900 p-4 border-b border-white/5">
            <DialogTitle className="text-[10px] font-black text-white uppercase tracking-widest">Order History</DialogTitle>
          </header>
          <ScrollArea className="h-[500px] p-4">
            <div className="space-y-3">
              {userOrders.length > 0 ? userOrders.map((o: any) => (
                <div key={o.id} className="bg-slate-900 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start">
                    <h3 className="text-[11px] font-black text-[#312ECB] uppercase tracking-tight max-w-[70%]">{o.service}</h3>
                    <Badge className={cn(
                      "text-[7px] font-black px-2 h-4 border-none",
                      o.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                    )}>{o.status}</Badge>
                  </div>
                  <div className="flex gap-3 mt-2 text-[9px] font-bold text-slate-400">
                    <span>Qty: {o.quantity}</span>
                    <span className="text-emerald-600">₹{o.price?.toFixed(2)}</span>
                  </div>
                </div>
              )) : <p className="text-center py-20 text-[10px] text-slate-600 uppercase font-black tracking-widest">No Orders Yet</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
