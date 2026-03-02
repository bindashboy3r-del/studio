
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
  writeBatch
} from "firebase/firestore";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Send, 
  LogOut, 
  Bell, 
  Moon, 
  Sun,
  Rocket,
  History,
  Bot,
  User as UserIcon,
  X,
  Megaphone,
  Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PLATFORMS, SERVICES, Platform, SMMService } from "@/app/lib/constants";
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isValid } from "date-fns";

type ChatState = 
  | 'idle' 
  | 'initial'
  | 'choosing_platform' 
  | 'choosing_service' 
  | 'entering_quantity' 
  | 'confirming_price'
  | 'awaiting_payment'
  | 'confirming';

interface OrderInProgress {
  platform?: Platform;
  service?: SMMService;
  link?: string;
  quantity?: number;
  utrId?: string;
}

export default function ChatPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [currentOrder, setCurrentOrder] = useState<OrderInProgress>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  
  const [sessionStartTime] = useState(() => Date.now());
  const hasInitialGreeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Global Broadcast Listener - Finds the first active slot
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
    });
    return () => unsubscribe();
  }, [db]);

  // Real-time Notifications Listener
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
    await batch.commit().catch(e => console.error("Failed to mark read", e));
  };

  const clearAllNotifications = async () => {
    if (!db || !user || !notificationsData || notificationsData.length === 0) return;
    
    const batch = writeBatch(db);
    notificationsData.forEach(n => {
      const ref = doc(db, "users", user.uid, "notifications", n.id);
      batch.delete(ref);
    });
    
    await batch.commit().then(() => {
      toast({ title: "Notifications Cleared" });
    }).catch(e => {
      console.error("Failed to clear", e);
      toast({ variant: "destructive", title: "Clear Failed", description: "Could not remove notifications." });
    });
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
      const msgTime = m.timestamp.toDate ? m.timestamp.toDate().getTime() : m.timestamp;
      return msgTime >= sessionStartTime;
    });
  }, [messagesData, sessionStartTime]);

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/");
  }, [user, isUserLoading, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, activeBroadcast]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

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

    addDoc(collection(db, "users", user.uid, "chatMessages"), data)
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: `users/${user.uid}/chatMessages`,
          operation: 'create',
          requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
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
      botReply("Send 'Hi' to start create order");
    }
  }, [user, isMessagesLoading]);

  const handlePaymentSubmit = async (link: string, utr: string) => {
    if (!link || !utr || !db || !user) return;
    
    const finalPrice = (currentOrder.quantity! / 1000) * currentOrder.service!.pricePer1000;
    const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
    
    const orderData = {
      userId: user.uid,
      orderId: orderId,
      platform: PLATFORMS[currentOrder.platform!],
      service: currentOrder.service?.name,
      link: link,
      quantity: currentOrder.quantity,
      price: finalPrice,
      utrId: utr,
      status: 'Pending',
      createdAt: serverTimestamp()
    };

    addDoc(collection(db, "users", user.uid, "orders"), orderData)
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: `users/${user.uid}/orders`,
          operation: 'create',
          requestResourceData: orderData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });

    setChatState('idle');
    botReply("Order submitted successfully!", [], {
      isSuccessCard: true,
      successDetails: {
        orderId,
        platform: PLATFORMS[currentOrder.platform!],
        service: currentOrder.service?.name,
        quantity: currentOrder.quantity,
        price: finalPrice,
        link: link,
        utrId: utr
      }
    });
  };

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !user) return;
    
    if (!manualText) setInputValue("");
    await addMessage('user', text);

    const cleanText = text.toLowerCase();

    if (cleanText === 'hi' || cleanText.includes("main menu")) {
      setChatState('choosing_platform');
      setCurrentOrder({});
      botReply(
        "👋 Welcome to SocialBoost Bot!\n\nNiche di gayi list mein se koi bhi platform select karein:",
        ["1. INSTAGRAM SERVICES", "2. YOUTUBE SERVICES"]
      );
      return;
    }

    switch (chatState) {
      case 'choosing_platform':
        if (cleanText.includes("1") || cleanText.includes("instagram")) {
          setCurrentOrder({ platform: 'instagram' });
          setChatState('choosing_service');
          const options = SERVICES.instagram.map((s, i) => `${i + 1}. INSTAGRAM ${s.name.toUpperCase()}`);
          botReply("Perfect. Niche di gayi Instagram service select karein:", options);
        } else if (cleanText.includes("2") || cleanText.includes("youtube")) {
          setCurrentOrder({ platform: 'youtube' });
          setChatState('choosing_service');
          const options = SERVICES.youtube.map((s, i) => `${i + 1}. YOUTUBE ${s.name.toUpperCase()}`);
          botReply("Perfect. Niche di gayi YouTube service select karein:", options);
        } else {
          botReply("Please select from the options provided.");
        }
        break;

      case 'choosing_service':
        const sIndex = parseInt(text) - 1;
        const sPlatform = currentOrder.platform;
        if (!sPlatform) {
          setChatState('initial');
          botReply("Something went wrong. Send 'Hi' to start again.");
          return;
        }
        const sService = SERVICES[sPlatform][sIndex];
        if (sService) {
          setCurrentOrder({ ...currentOrder, service: sService });
          setChatState('entering_quantity');
          botReply(`📊 Aapne ${PLATFORMS[sPlatform]} ${sService.name} select kiya hai.\n\nKitni quantity chahiye? (Minimum 100)`);
        } else {
          botReply("Invalid selection. Please choose from the list.");
        }
        break;

      case 'entering_quantity':
        const qty = parseInt(text);
        if (isNaN(qty) || qty < 100) {
          botReply("Please enter a valid number (minimum 100).");
        } else {
          const price = (qty / 1000) * currentOrder.service!.pricePer1000;
          setCurrentOrder({ ...currentOrder, quantity: qty });
          setChatState('confirming_price');
          botReply(
            `✅ Aapne ${qty} ${PLATFORMS[currentOrder.platform!]} ${currentOrder.service!.name} select kiye hain.\n💰 Total price: ₹${price.toFixed(0)}\n\nKya aap aage badhna chahte hain?`,
            ["✅ YES, PROCEED", "🏠 MAIN MENU"]
          );
        }
        break;

      case 'confirming_price':
        if (cleanText.includes("yes") || cleanText.includes("proceed")) {
          setChatState('awaiting_payment');
          const finalPrice = (currentOrder.quantity! / 1000) * currentOrder.service!.pricePer1000;
          botReply(`📸 Payment instructions for ₹${finalPrice.toFixed(0)}`, [], {
            isPaymentCard: true,
            paymentPrice: finalPrice
          });
        } else {
          setChatState('initial');
          setCurrentOrder({});
          botReply("Order cancelled. Send 'Hi' to start create order");
        }
        break;

      default:
        botReply("Send 'Hi' to start create order");
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative shadow-2xl bg-white dark:bg-slate-950 font-body">
      {/* Header matching screenshot */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#312ECB] flex items-center justify-center text-white shadow-md">
            <Rocket size={24} className="fill-current" />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter text-[#312ECB] dark:text-white">SOCIALBOOST</h1>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="w-8 h-8 rounded-full text-slate-400 hover:text-[#312ECB]">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
          
          <DropdownMenu onOpenChange={(open) => open && markAllAsRead()}>
            <DropdownMenuTrigger asChild>
              <button className="relative w-8 h-8 rounded-full text-slate-400 hover:text-[#312ECB] flex items-center justify-center transition-colors">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[300px] bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 p-0 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#111B21] dark:text-white">Notifications</span>
              </div>
              <ScrollArea className="h-[300px]">
                {notificationsData && notificationsData.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {notificationsData.map((notif) => (
                      <div key={notif.id} className={`p-4 transition-colors ${notif.read ? 'opacity-60' : 'bg-blue-50/30 dark:bg-blue-900/10'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-[11px] font-black uppercase text-[#312ECB]">{notif.title}</h4>
                        </div>
                        <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 leading-snug">
                          {notif.message}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                    <p className="text-[10px] font-black uppercase tracking-widest">No Alerts</p>
                  </div>
                )}
              </ScrollArea>
              {notificationsData && notificationsData.length > 0 && (
                <div className="p-2 border-t border-gray-100 dark:border-slate-800 text-center">
                  <button onClick={clearAllNotifications} className="text-[9px] font-black uppercase tracking-widest text-[#312ECB] hover:underline">
                    Clear All
                  </button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={() => router.push('/profile')} className="w-10 h-10 rounded-full bg-[#312ECB] text-white font-bold text-xs shadow-lg">
            {user?.displayName?.[0] || 'U'}
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-bg scroll-smooth relative">
        {/* Stylish Broadcast Card - Centered Glassmorphism */}
        {activeBroadcast && (
          <div className="sticky top-4 self-center w-full max-w-[90%] z-50 mb-8 animate-in zoom-in-95 duration-500">
            <div className="backdrop-blur-xl bg-white/20 dark:bg-[#312ECB]/20 border border-white/30 dark:border-white/10 rounded-[2.5rem] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col items-center text-center space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#312ECB]/20 blur-3xl rounded-full -mr-10 -mt-10" />
              
              <div className="w-12 h-12 rounded-2xl bg-[#312ECB] flex items-center justify-center text-white shadow-lg">
                <Megaphone size={24} className="fill-current" />
              </div>
              
              <div>
                <span className="text-[10px] font-black text-[#312ECB] dark:text-white/40 uppercase tracking-[0.3em] mb-1 block">Important Announcement</span>
                <p className="text-[15px] font-black text-[#111B21] dark:text-white leading-relaxed whitespace-pre-wrap">
                  {activeBroadcast.text}
                </p>
              </div>

              <button 
                onClick={() => setActiveBroadcast(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-[#312ECB] transition-colors"
              >
                <X size={20} />
              </button>
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
            onPaymentSubmit={handlePaymentSubmit}
            isSuccessCard={m.isSuccessCard}
            successDetails={m.successDetails}
            onOptionClick={(option) => handleSend(option)}
            timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} 
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />
      </main>

      <footer className="p-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-[#F0F2F5] dark:bg-slate-800 rounded-full flex items-center px-5 py-1">
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message (Hi)"
              className="border-none bg-transparent focus-visible:ring-0 shadow-none text-[15px] h-10 p-0 text-black dark:text-white font-bold placeholder:text-gray-400"
            />
          </div>
          <Button 
            onClick={() => handleSend()}
            size="icon" 
            className="rounded-full h-12 w-12 bg-[#25D366] hover:bg-[#20bd5b] shadow-lg shrink-0"
          >
            <Send size={22} className="text-white ml-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
