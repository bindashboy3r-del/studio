
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  where,
  onSnapshot,
  doc,
  writeBatch,
  increment,
  Timestamp,
  deleteDoc
} from "firebase/firestore";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Send, 
  Zap,
  Wallet,
  PlusCircle,
  Bell,
  Package,
  Megaphone,
  ExternalLink
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SMMService, Platform, PLATFORMS } from "@/app/lib/constants";
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ChatState = 
  | 'idle' 
  | 'initial'
  | 'choosing_platform'
  | 'choosing_order_type'
  | 'bulk_adding_links'
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
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
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

    onSnapshot(doc(db, "globalSettings", "payment"), (snap) => { if (snap.exists()) setPaymentConfig(snap.data()); });
    onSnapshot(collection(db, "users", currentUser.uid, "notifications"), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((n: any) => !n.read));
    });
    return () => unsubBroadcast();
  }, [db, currentUser]);

  const { data: messages, isLoading: isMessagesLoading } = useCollection(useMemoFirebase(() => db && currentUser && sessionStart ? query(collection(db, "users", currentUser.uid, "chatMessages"), where("timestamp", ">=", sessionStart), orderBy("timestamp", "asc")) : null, [db, currentUser, sessionStart]));

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const clearTrailMessages = async () => {
    if (!currentUser || !db || !messages) return;
    const batch = writeBatch(db);
    // Delete all messages except those marked as permanent (like greetings and main menus)
    messages.forEach(m => {
      if (!m.isPermanent) {
        batch.delete(doc(db, "users", currentUser.uid, "chatMessages", m.id));
      }
    });
    await batch.commit();
  };

  const addMessage = async (sender: 'user' | 'bot', text: string, options?: string[], extraData?: any) => {
    if (!currentUser || !db) return;
    return addDoc(collection(db, "users", currentUser.uid, "chatMessages"), { sender, text, options: options || [], timestamp: serverTimestamp(), userId: currentUser.uid, ...extraData });
  };

  const botReply = async (text: string, options?: string[], extraData?: any) => {
    setIsTyping(true);
    setTimeout(async () => { await addMessage('bot', text, options, extraData); setIsTyping(false); }, 600);
  };

  useEffect(() => {
    if (currentUser && !isMessagesLoading && !hasInitialGreeted.current && sessionStart) {
      hasInitialGreeted.current = true;
      if (!messages?.length) { 
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
    const isMajorOption = cleanText.includes('single') || cleanText.includes('combo') || cleanText.includes('bulk');

    // If user clicks a top-level menu option, clear the trail below it
    if (isMajorOption) {
      await clearTrailMessages();
    }

    if (cleanText === 'hi' || cleanText === 'menu') {
      await addMessage('user', text);
      if (availablePlatforms.length > 1) {
        setChatState('choosing_platform');
        botReply("Select your platform to continue:", availablePlatforms.map((p, i) => `${i + 1}. ${PLATFORMS[p]}`), { isPermanent: true });
      } else {
        const p = availablePlatforms[0] || 'instagram';
        setCurrentOrder(prev => ({ ...prev, platform: p }));
        setChatState('choosing_order_type');
        botReply(`Pick for ${PLATFORMS[p]}:`, [
          `1. SINGLE ORDER (${globalDiscounts.single}% OFF)`, 
          `2. COMBO ORDER (${globalDiscounts.combo}% OFF 🎁)`, 
          `3. BULK ORDER (${globalDiscounts.bulk}% OFF)`
        ], { isPermanent: true });
      }
      return;
    }

    if (text.startsWith("SUBMIT_BULK_LINKS:")) {
      const linksArr = text.replace("SUBMIT_BULK_LINKS:", "").split('|').filter(l => l.trim());
      await addMessage('user', `Submitted ${linksArr.length} links.`);
      setCurrentOrder(p => ({ ...p, tempLinks: linksArr }));
      setChatState('choosing_service');
      const filtered = activeServices.filter(s => s.platform === currentOrder.platform);
      botReply(`✅ Links Saved! Now pick a service:`, filtered.map((s, i) => `${i + 1}. ${s.name}`));
      return;
    }

    if (text.startsWith("SUBMIT_COMBO_CONFIG###")) {
      const [, itemsStr, linksInput, total] = text.split("###");
      await addMessage('user', "Proceeding with Combo package...");
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
      botReply(`✅ COMBO READY\nTotal Amount: ₹${parseFloat(total).toFixed(2)}`, opts, { paymentPrice: parseFloat(total), serviceName: "Combo Bundle", isCombo: true, prefilledLinks: linksInput });
      return;
    }

    if (text.startsWith("SUBMIT_PAYMENT###") || text.startsWith("CONFIRM_WALLET###")) {
      const isWallet = text.startsWith("CONFIRM_WALLET###");
      const parts = text.split("###");
      const linksInput = parts[1];
      const utr = parts[2] || "";
      await addMessage('user', isWallet ? "Confirming payment via wallet..." : "Submitted payment proof", [], { isPermanent: true });
      
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

      if (isWallet && walletBalance < totalPrice) { botReply("❌ Insufficient Wallet Balance! Please refill."); return; }

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

      botReply("Order Placed Successfully! 🚀", [], { orderId, isPermanent: true, isSuccessCard: true, showWhatsAppSuccess: !isWallet, paymentPrice: totalPrice, serviceName: serviceNames, quantity: qty, prefilledLinks: linksInput });
      setChatState('idle');
      return;
    }

    if (isMajorOption) {
      if (cleanText.includes('single')) {
        await addMessage('user', "Single Order");
        setCurrentOrder(p => ({ ...p, type: 'single' }));
        setChatState('choosing_service');
        const filtered = activeServices.filter(s => s.platform === currentOrder.platform);
        botReply(`✅ SINGLE MODE\nChoose a service:`, filtered.map((s, i) => `${i + 1}. ${s.name}`));
        return;
      }
      if (cleanText.includes('combo')) {
        await addMessage('user', "Combo Order");
        setCurrentOrder(p => ({ ...p, type: 'combo' }));
        botReply(`✅ COMBO MODE\nI'll help you build a package. Use the config card below:`, [], { isComboConfigCard: true, discountPct: globalDiscounts.combo });
        return;
      }
      if (cleanText.includes('bulk')) {
        await addMessage('user', "Bulk Order");
        setCurrentOrder(p => ({ ...p, type: 'bulk' }));
        setChatState('bulk_adding_links');
        botReply(`✅ BULK MODE\nPlease add multiple Target Links first:`, [], { isBulkLinkCard: true });
        return;
      }
    }

    const filtered = activeServices.filter(s => s.platform === currentOrder.platform);
    const serviceMatch = filtered.find((s, i) => cleanText.includes(s.name.toLowerCase()) || (chatState === 'choosing_service' && cleanText === (i + 1).toString()));
    
    if (serviceMatch) {
      await addMessage('user', serviceMatch.name);
      setCurrentOrder(p => ({ ...p, items: [{ service: serviceMatch, quantity: 0, link: '' }] }));
      setChatState('entering_quantity');
      botReply(`📊 How many ${serviceMatch.name} do you want? (Min: ${serviceMatch.minQuantity})`);
      return;
    }

    await addMessage('user', text);
    
    if (chatState === 'entering_quantity') {
      const q = parseInt(text);
      if (isNaN(q) || q < currentOrder.items[0].service.minQuantity) { botReply(`⚠️ Invalid quantity. Minimum ${currentOrder.items[0].service.minQuantity} is required.`); return; }
      
      setCurrentOrder(p => ({ ...p, items: [{ ...p.items[0], quantity: q }] }));
      setChatState('choosing_payment_method');
      
      const opts: string[] = [];
      if (paymentConfig?.walletEnabled !== false) opts.push("💳 PAY FROM WALLET");
      if (paymentConfig?.upiEnabled !== false) opts.push("📲 PAY VIA UPI QR");
      
      const multiplier = currentOrder.type === 'bulk' ? (currentOrder.tempLinks?.length || 1) : 1;
      const raw = (q/1000) * currentOrder.items[0].service.pricePer1000 * multiplier;
      const disc = globalDiscounts[currentOrder.type || 'single'];
      const finalPrice = raw * (1 - disc/100);
      
      botReply(`✅ ORDER SUMMARY\nTotal Amount: ₹${finalPrice.toFixed(2)}\n\nPlease select payment method:`, opts, { paymentPrice: finalPrice, rawPrice: raw, discountPct: disc, serviceName: currentOrder.items[0].service.name, quantity: q, walletBalance, prefilledLinks: currentOrder.tempLinks?.join('\n') || "" });
      return;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-lg mx-auto whatsapp-bg font-body overflow-hidden">
      <header className="glass-header px-3 py-1 flex items-center justify-between shadow-lg h-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#312ECB] flex items-center justify-center text-white shadow-3d"><Zap size={12} /></div>
          <h1 className="text-[11px] font-black italic tracking-tighter text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsNotifOpen(true)} className="relative p-1 text-slate-400"><Bell size={14} />{notifications.length > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />}</button>
          <button onClick={() => router.push('/profile')} className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black text-[9px] shadow-3d-sm">{currentUser?.displayName?.[0] || 'U'}</button>
        </div>
      </header>

      <div className="bg-slate-900/50 px-3 py-0.5 flex items-center justify-between border-b border-white/5 h-6 shrink-0">
        <button onClick={() => router.push('/add-funds')} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
          <Wallet size={8} /><span className="text-[8px] font-black">₹{walletBalance.toFixed(0)}</span><PlusCircle size={8} />
        </button>
        <button onClick={() => setIsOrdersOpen(true)} className="text-[8px] font-black uppercase text-[#312ECB] flex items-center gap-1"><Package size={8} /> ORDERS</button>
      </div>

      <main className="flex-1 overflow-y-auto p-2 flex flex-col relative custom-scrollbar bg-slate-950/20">
        {messages?.map(m => (
          <MessageBubble 
            key={m.id} 
            sender={m.sender} 
            text={m.text} 
            options={m.options} 
            onOptionClick={handleSend} 
            isPaymentCard={m.paymentPrice && !m.isSuccessCard && !m.isWalletCard}
            paymentPrice={m.paymentPrice}
            rawPrice={m.rawPrice}
            isWalletCard={m.options?.includes("💳 PAY FROM WALLET")}
            isComboConfigCard={m.isComboConfigCard} 
            isBulkLinkCard={m.isBulkLinkCard} 
            isSuccessCard={m.isSuccessCard} 
            showWhatsAppSuccess={m.showWhatsAppSuccess} 
            orderId={m.orderId} 
            timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} 
            dynamicServices={m.dynamicServices || activeServices.filter(s => s.platform === currentOrder.platform)} 
            discountPct={m.discountPct ?? 0} 
            serviceName={m.serviceName} 
            quantity={m.quantity} 
            prefilledLinks={m.prefilledLinks} 
            walletBalance={m.walletBalance || walletBalance} 
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />
      </main>

      <footer className="p-1 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 shrink-0">
        <div className="flex items-center gap-2 bg-slate-950 rounded-xl p-1 h-8">
          <Input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Ask something..." className="flex-1 bg-transparent border-none font-bold text-[10px] h-full text-white placeholder:text-slate-600 focus-visible:ring-0" />
          <Button onClick={() => handleSend()} size="icon" className="rounded-lg h-6 w-6 bg-[#312ECB] shadow-3d"><Send size={10} /></Button>
        </div>
      </footer>

      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent className="max-w-[300px] rounded-[2rem] border-none shadow-2xl bg-[#030712] p-0 overflow-hidden">
          <header className="bg-[#312ECB] p-3 text-white text-center">
             <Megaphone size={18} className="mx-auto" />
             <DialogTitle className="font-black uppercase text-[8px] tracking-widest mt-1">Official Update</DialogTitle>
          </header>
          <div className="p-5 space-y-3 text-center">
             <p className="text-[11px] font-bold text-slate-200 leading-relaxed italic">{activeBroadcast?.text}</p>
             {activeBroadcast?.buttonUrl && (
               <Button asChild className="w-full h-9 bg-white text-slate-900 font-black uppercase text-[9px] rounded-lg gap-2 shadow-3d">
                 <a href={activeBroadcast.buttonUrl} target="_blank" rel="noopener noreferrer">{activeBroadcast.buttonText || "Open"} <ExternalLink size={10} /></a>
               </Button>
             )}
             <Button onClick={() => setIsBroadcastOpen(false)} variant="ghost" className="w-full text-slate-500 font-black uppercase text-[8px] h-8">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
