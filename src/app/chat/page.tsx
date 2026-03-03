
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
  
  const [sessionStartTime] = useState(() => Date.now());
  const hasInitialGreeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamic Services Listener - Safe initialization
  const servicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db]);
  const { data: rawDynamicServices, isLoading: isServicesLoading } = useCollection<SMMService>(servicesQuery);

  // Filtering for active services
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
    const broadcastQuery = query(
      collection(db, "globalAnnouncements"),
      where("active", "==", true),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(broadcastQuery, (snapshot) => {
      if (!snapshot.empty) {
        setActiveBroadcast(snapshot.docs[0].data());
      } else {
        setActiveBroadcast(null);
      }
    }, () => {}); 
    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) {
        setGlobalBonus(snap.data().bonusPercentage || 0);
      }
    }, () => {});
    return () => unsub();
  }, [db]);

  const notificationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "notifications"),
      limit(20)
    );
  }, [db, user]);

  const { data: rawNotifications } = useCollection(notificationsQuery);
  
  const notificationsData = useMemo(() => {
    if (!rawNotifications) return [];
    return [...rawNotifications].sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [rawNotifications]);

  const unreadCount = useMemo(() => 
    notificationsData?.filter(n => !n.read).length || 0
  , [notificationsData]);

  const markAllAsRead = async () => {
    if (!db || !user || !notificationsData) return;
    const unread = notificationsData.filter(n => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      const ref = doc(db, "users", user.uid, "notifications", n.id);
      batch.update(ref, { read: true });
    });
    await batch.commit().catch(() => {});
  };

  const clearAllNotifications = async () => {
    if (!db || !user || !notificationsData || notificationsData.length === 0) return;
    
    const batch = writeBatch(db);
    notificationsData.forEach(n => {
      const ref = doc(db, "users", user.uid, "notifications", n.id);
      batch.delete(ref);
    });
    
    await batch.commit().catch(() => {});
  };

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "chatMessages"),
      orderBy("timestamp", "asc")
    );
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
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, activeBroadcast]);

  const addMessage = async (sender: 'user' | 'bot', text: string, options?: string[], extraData?: any) => {
    if (!user || !db) return;
    const data = {
      userId: user.uid,
      sender,
      text,
      options: options || [],
      timestamp: serverTimestamp(),
      ...extraData
    };

    addDoc(collection(db, "users", user.uid, "chatMessages"), data);
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

    if (currentOrder.type === 'combo') {
      total = total * 0.95;
    }

    return total;
  };

  const handleBundlePaymentSubmit = async (utr: string, linkOverride?: string) => {
    if (!db || !user || currentOrder.items.length === 0) return;
    const totalPrice = calculateTotalPrice();
    
    const batch = writeBatch(db);
    const orderResults: any[] = [];
    const targets = (currentOrder.type === 'bulk' && currentOrder.bulkLinks) ? currentOrder.bulkLinks : [linkOverride || currentOrder.items[0].link];

    if (!targets[0] || targets[0].trim() === "") {
        toast({ variant: "destructive", title: "Missing Link", description: "Please provide Instagram link." });
        return;
    }

    let successServiceName = "";
    if (currentOrder.type === 'combo') {
      successServiceName = `Combo: ${currentOrder.items.map(i => `${i.service?.name}(${i.quantity})`).join(", ")}`;
    } else if (currentOrder.type === 'bulk') {
      successServiceName = `Bulk: ${currentOrder.items[0]?.service?.name}`;
    } else {
      successServiceName = currentOrder.items[0]?.service?.name || "Service";
    }

    for (const link of targets) {
      for (const item of currentOrder.items) {
        const orderId = `SB-B-${Math.floor(100000 + Math.random() * 900000)}`;
        const orderRef = doc(collection(db, "users", user.uid, "orders"));
        
        let itemPrice = (item.quantity / 1000) * (item.service?.pricePer1000 || 0);
        if (currentOrder.type === 'combo') itemPrice *= 0.95;

        const orderData = {
          userId: user.uid,
          orderId,
          platform: 'Instagram',
          service: item.service?.name || "Service",
          link: link,
          quantity: item.quantity,
          price: itemPrice,
          utrId: utr,
          status: 'Pending',
          paymentMethod: 'UPI',
          createdAt: serverTimestamp()
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
        orderId: orderResults[0].orderId,
        platform: 'Instagram',
        service: successServiceName,
        quantity: currentOrder.items.reduce((a, b) => a + b.quantity, 0) * (currentOrder.bulkLinks?.length || 1),
        price: totalPrice,
        link: targets[0] + (targets.length > 1 ? ` (+${targets.length - 1} more)` : ''),
        utrId: utr
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
    
    if (!targets[0] || targets[0].trim() === "") {
        toast({ variant: "destructive", title: "Missing Link", description: "Please provide Instagram link." });
        return;
    }

    let successServiceName = "";
    if (currentOrder.type === 'combo') {
      successServiceName = `Combo: ${currentOrder.items.map(i => `${i.service?.name}(${i.quantity})`).join(", ")}`;
    } else if (currentOrder.type === 'bulk') {
      successServiceName = `Bulk: ${currentOrder.items[0]?.service?.name}`;
    } else {
      successServiceName = currentOrder.items[0]?.service?.name || "Service";
    }

    const orderResults: any[] = [];

    for (const link of targets) {
      for (const item of currentOrder.items) {
        const orderId = `SB-W-${Math.floor(100000 + Math.random() * 900000)}`;
        const orderRef = doc(collection(db, "users", user.uid, "orders"));
        
        let finalStatus = 'Pending';
        let apiOrderId = null;
        let providerId = null;

        if (apiData) {
          const mapping = apiData.mappings?.[item.service?.id || ""];
          providerId = mapping?.providerId;
          const remoteServiceId = mapping?.remoteServiceId;
          const provider = apiData.providers?.find((p: any) => p.id === providerId);

          if (provider && provider.url && provider.key && remoteServiceId) {
            const apiResult = await placeApiOrder({
              apiUrl: provider.url,
              apiKey: provider.key,
              serviceId: remoteServiceId,
              link: link,
              quantity: item.quantity
            });

            if (apiResult.success) {
              apiOrderId = apiResult.order;
              finalStatus = 'Processing';
            }
          }
        }

        let itemPrice = (item.quantity / 1000) * (item.service?.pricePer1000 || 0);
        if (currentOrder.type === 'combo') itemPrice *= 0.95;

        const orderData = {
          userId: user.uid,
          orderId,
          platform: 'Instagram',
          service: item.service?.name || "Service",
          link: link,
          quantity: item.quantity,
          price: itemPrice,
          status: finalStatus,
          paymentMethod: 'Wallet',
          apiOrderId,
          providerId,
          createdAt: serverTimestamp()
        };
        
        batch.set(orderRef, orderData);
        orderResults.push(orderData);
      }
    }

    batch.update(doc(db, "users", user.uid), {
      balance: increment(-totalPrice)
    });

    await batch.commit().then(() => {
      setChatState('idle');
      botReply(`✅ Order placed from Wallet!`, [], {
        isSuccessCard: true,
        successDetails: {
          orderId: orderResults[0].orderId,
          platform: 'Instagram',
          service: successServiceName,
          quantity: currentOrder.items.reduce((a, b) => a + b.quantity, 0) * (currentOrder.bulkLinks?.length || 1),
          price: totalPrice,
          link: targets[0] + (targets.length > 1 ? ` (+${targets.length - 1} more)` : ''),
          utrId: 'WALLET-PAYMENT'
        }
      });
    });
  };

  const handleBulkLinksFromCard = async (links: string[]) => {
    if (links.length === 0) return;
    await addMessage('user', `Added ${links.length} links for bulk order.`);
    setCurrentOrder(prev => ({ ...prev, bulkLinks: links }));
    setChatState('choosing_service');
    const numberedOptions = dynamicServices.map((s, i) => `${i + 1}. ${s.name}`);
    botReply(`📊 Select Instagram service for these ${links.length} links:`, numberedOptions);
  };

  const handleComboFromCard = async (items: { serviceId: string, quantity: number }[], link: string) => {
    if (items.length === 0 || !link || !dynamicServices) return;
    
    const formattedItems = items.map(item => ({
      service: dynamicServices.find(s => s.id === item.serviceId)!,
      quantity: item.quantity,
      link: link
    }));

    await addMessage('user', `Placed combo order.`);
    const updatedOrder = { ...currentOrder, type: 'combo' as const, items: formattedItems };
    setCurrentOrder(updatedOrder);
    
    const total = calculateTotalPrice(formattedItems);
    
    setChatState('choosing_payment_method');
    botReply(
      `🎁 Combo Discount: 5% OFF!\n✅ Final Total: ₹${total.toFixed(2)}\n💳 Wallet: ₹${walletBalance.toFixed(2)}`, 
      ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"]
    );
  };

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !user) return;
    
    if (isServicesLoading && !manualText) {
      toast({ title: "Please wait", description: "Loading services..." });
      return;
    }

    if (!manualText) setInputValue("");
    await addMessage('user', text);
    const cleanText = text.toLowerCase();

    if (cleanText === 'hi' || cleanText.includes("main menu") || cleanText.includes("start")) {
      setChatState('choosing_order_type');
      setCurrentOrder({ type: 'single', platform: 'instagram', items: [] });
      botReply(
        "👋 Welcome! Choose your ordering method:",
        ["1. SINGLE ORDER", "2. COMBO ORDER (5% OFF! 🎁)", "3. BULK ORDER"]
      );
      return;
    }

    if (cleanText.includes("single order")) {
      setCurrentOrder({ type: 'single', platform: 'instagram', items: [] });
      setChatState('choosing_service');
      const numberedOptions = dynamicServices.map((s, i) => `${i + 1}. ${s.name}`);
      botReply("Select Instagram service:", numberedOptions);
      return;
    } else if (cleanText.includes("combo order")) {
      setCurrentOrder({ type: 'combo', platform: 'instagram', items: [] });
      setChatState('choosing_combo_services');
      botReply("🎁 Configure your Combo (5% OFF):", [], { isComboCard: true, dynamicServices });
      return;
    } else if (cleanText.includes("bulk order")) {
      setCurrentOrder({ type: 'bulk', platform: 'instagram', items: [] });
      setChatState('entering_bulk_links');
      botReply("🔗 Add target links for Bulk Order:", [], { isBulkLinkCard: true });
      return;
    }

    if (cleanText.includes("add funds")) {
      router.push("/add-funds");
      return;
    }

    if (cleanText.includes("history")) {
      router.push("/orders");
      return;
    }

    switch (chatState) {
      case 'choosing_service':
        const match = dynamicServices.find((s, i) => 
          cleanText.includes((i + 1).toString()) || 
          cleanText.includes(s.name.toLowerCase())
        );
        if (match) {
          const updatedItems = [{ service: match, quantity: 0, link: '' }];
          setCurrentOrder(prev => ({ ...prev, items: updatedItems }));
          setChatState('entering_quantity');
          botReply(`📊 Quantity for ${match.name}? (Min ${match.minQuantity})`);
        }
        break;

      case 'entering_quantity':
        const qty = parseInt(text);
        const activeService = currentOrder.items[0]?.service;
        if (!activeService || isNaN(qty) || qty < activeService.minQuantity) {
          botReply(`Invalid quantity (Min ${activeService?.minQuantity || 10} for ${activeService?.name || 'this service'}).`);
        } else {
          setCurrentOrder(prev => ({
            ...prev,
            items: prev.items.map(item => ({ ...item, quantity: qty }))
          }));
          setChatState('choosing_payment_method');
          
          let total = (qty / 1000) * activeService.pricePer1000;
          if (currentOrder.type === 'bulk' && currentOrder.bulkLinks) {
            total *= currentOrder.bulkLinks.length;
          }

          botReply(
            `✅ Selected: Instagram ${activeService.name}\n` +
            `📊 Qty: ${qty}\n` +
            `💰 Total: ₹${total.toFixed(2)}\n\n` +
            `💳 Wallet: ₹${walletBalance.toFixed(2)}`, 
            ["💳 PAY FROM WALLET", "📲 PAY VIA UPI QR"]
          );
        }
        break;

      case 'choosing_payment_method':
        if (cleanText.includes("wallet")) {
          const total = calculateTotalPrice();
          if (walletBalance < total) {
            botReply("❌ Insufficient balance!", ["💳 ADD FUNDS", "🏠 MAIN MENU"]);
            return;
          }
          if (currentOrder.type === 'single') {
            botReply("💳 Confirm Wallet Payment:", [], {
              isWalletCard: true,
              paymentPrice: total
            });
          } else {
            handleBundleWalletSubmit();
          }
        } else if (cleanText.includes("upi")) {
          botReply(`📸 Pay ₹${calculateTotalPrice().toFixed(2)} via UPI:`, [], {
            isPaymentCard: true,
            paymentPrice: calculateTotalPrice(),
          });
        }
        break;

      default:
        botReply("Type 'Hi' for Menu.");
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative shadow-2xl bg-white dark:bg-slate-950 font-body">
      <header className="bg-white dark:bg-slate-900 px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-[#312ECB] flex items-center justify-center text-white shadow-lg">
            <Zap className="fill-current" size={20} />
          </div>
          <h1 className="text-[20px] font-black italic tracking-tighter text-[#312ECB] dark:text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="text-slate-400 hover:text-[#312ECB] transition-colors">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          <DropdownMenu onOpenChange={(open) => open && markAllAsRead()}>
            <DropdownMenuTrigger asChild>
              <button className="relative text-slate-400 hover:text-[#312ECB] flex items-center justify-center transition-colors">
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[280px] rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-slate-50 flex items-center justify-between border-b">
                <span className="text-[10px] font-black uppercase">Notifications</span>
                <button onClick={clearAllNotifications} className="text-[9px] font-black text-red-500 uppercase">CLEAR</button>
              </div>
              <ScrollArea className="h-[250px]">
                {notificationsData.length > 0 ? (
                  notificationsData.map((notif) => (
                    <div key={notif.id} className={cn("p-4 border-b", notif.read ? 'opacity-50' : 'bg-blue-50/20')}>
                      <h4 className="text-[11px] font-black uppercase text-[#312ECB]">{notif.title}</h4>
                      <p className="text-[12px] font-semibold text-slate-600 leading-tight">{notif.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-slate-400 uppercase text-[10px]">No Alerts</div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <button onClick={() => router.push('/profile')} className="w-10 h-10 rounded-full bg-[#312ECB] text-white font-black text-sm flex items-center justify-center">
            {user?.displayName?.[0] || 'U'}
          </button>
        </div>
      </header>

      <div className="bg-white px-6 py-3 flex items-center justify-between border-b z-40">
        <button onClick={() => router.push('/add-funds')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100">
          <Wallet size={14} />
          <span className="text-[11px] font-black">₹{walletBalance.toFixed(2)}</span>
          <PlusCircle size={14} className="ml-1" />
        </button>
        <button onClick={() => router.push('/orders')} className="text-[11px] font-black uppercase text-[#312ECB] flex items-center gap-2">
          <History size={16} /> RECENT ORDERS
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-bg relative">
        {activeBroadcast && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] p-6 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-[350px] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col p-8 items-center text-center space-y-4">
              <Megaphone size={32} className="text-[#312ECB]" />
              <p className="text-[15px] font-black text-[#111B21] leading-relaxed">{activeBroadcast.text}</p>
              <Button onClick={() => setActiveBroadcast(null)} className="rounded-full bg-[#312ECB] text-white w-full uppercase font-black text-[10px]">Close</Button>
            </div>
          </div>
        )}

        {messages.map((m: any) => (
          <MessageBubble 
            key={m.id} 
            sender={m.sender} 
            text={m.text} 
            options={m.options}
            isPaymentCard={m.isPaymentCard}
            paymentPrice={m.paymentPrice}
            onPaymentSubmit={(link, utr) => handleBundlePaymentSubmit(utr, link)}
            isSuccessCard={m.isSuccessCard}
            successDetails={m.successDetails}
            isBulkLinkCard={m.isBulkLinkCard}
            onBulkLinksSubmit={(links) => handleBulkLinksFromCard(links)}
            isComboCard={m.isComboCard}
            onComboSubmit={(items, link) => handleComboFromCard(items, link)}
            isWalletCard={m.isWalletCard}
            onWalletSubmit={(link) => handleBundleWalletSubmit(link)}
            onOptionClick={(option) => handleSend(option)}
            timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} 
            dynamicServices={dynamicServices}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />
      </main>

      <footer className="p-3 bg-white border-t z-50">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-[#F0F2F5] rounded-full px-5 py-1">
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type 'Hi' for Menu..."
              className="border-none bg-transparent focus-visible:ring-0 shadow-none h-11 text-black font-bold"
            />
          </div>
          <Button onClick={() => handleSend()} size="icon" className="rounded-full h-12 w-12 bg-[#25D366] hover:bg-[#20bd5b] shadow-lg">
            <Send size={22} className="text-white ml-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
