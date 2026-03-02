
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
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
  User as UserIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PLATFORMS, SERVICES, Platform, SMMService } from "@/app/lib/constants";
import { intelligentOrderParsing } from "@/ai/flows/intelligent-order-parsing";
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ChatState = 
  | 'idle' 
  | 'initial'
  | 'choosing_platform' 
  | 'choosing_service' 
  | 'entering_quantity' 
  | 'entering_link' 
  | 'confirming';

interface OrderInProgress {
  platform?: Platform;
  service?: SMMService;
  link?: string;
  quantity?: number;
}

export default function ChatPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [currentOrder, setCurrentOrder] = useState<OrderInProgress>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
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
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const addMessage = async (sender: 'user' | 'bot', text: string, options?: string[]) => {
    if (!user || !db) return;
    const path = `users/${user.uid}/chatMessages`;
    const data = {
      userId: user.uid,
      sender,
      text,
      options: options || [],
      timestamp: serverTimestamp()
    };

    addDoc(collection(db, "users", user.uid, "chatMessages"), data)
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path,
          operation: 'create',
          requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const botReply = async (text: string, options?: string[]) => {
    setIsTyping(true);
    setTimeout(async () => {
      await addMessage('bot', text, options);
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

  const handleSend = async (manualText?: string) => {
    const text = manualText || inputValue.trim();
    if (!text || !db || !user) return;
    
    if (!manualText) setInputValue("");
    await addMessage('user', text);

    if (chatState === 'initial' && text.toLowerCase() === 'hi') {
      setChatState('choosing_platform');
      botReply(
        "👋 Welcome to SocialBoost Bot!\n\nNiche di gayi list mein se koi bhi service select karein:",
        ["1. Instagram Services", "2. YouTube Services"]
      );
      return;
    } else if (chatState === 'initial') {
      botReply("Send 'Hi' to start create order");
      return;
    }

    if (chatState === 'choosing_platform' || chatState === 'idle') {
      try {
        if (text.length > 5 && !manualText) {
          const parsed = await intelligentOrderParsing({ requestText: text });
          if (parsed && parsed.platform && parsed.service && parsed.quantity && parsed.link) {
            const platformServices = SERVICES[parsed.platform as Platform];
            const service = platformServices.find(s => s.id === parsed.service);
            if (service) {
              const price = (parsed.quantity / 1000) * service.pricePer1000;
              setCurrentOrder({
                platform: parsed.platform as Platform,
                service: service,
                link: parsed.link,
                quantity: parsed.quantity
              });
              setChatState('confirming');
              botReply(
                `I've prepared your order! 🛒\n\nPlatform: ${PLATFORMS[parsed.platform as Platform]}\nService: ${service.name}\nLink: ${parsed.link}\nQuantity: ${parsed.quantity}\nTotal Price: $${price.toFixed(2)}\n\nReply "Confirm" to proceed or "Cancel" to abort.`,
                ["Confirm", "Cancel"]
              );
              return;
            }
          }
        }
      } catch (e) { }
    }

    switch (chatState) {
      case 'choosing_platform':
        if (text.includes("1") || text.toLowerCase().includes("instagram")) {
          setCurrentOrder({ platform: 'instagram' });
          setChatState('choosing_service');
          const options = SERVICES.instagram.map((s, i) => `${i + 1}. Instagram ${s.name}`);
          botReply("Perfect. Niche di gayi Instagram service select karein:", options);
        } else if (text.includes("2") || text.toLowerCase().includes("youtube")) {
          setCurrentOrder({ platform: 'youtube' });
          setChatState('choosing_service');
          const options = SERVICES.youtube.map((s, i) => `${i + 1}. YouTube ${s.name}`);
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
          setChatState('entering_link');
          botReply(`Price is $${price.toFixed(2)} ✅\n\nAb niche apne ${currentOrder.platform === 'instagram' ? 'Profile handle (@username) or Post URL' : 'Channel or Video URL'} ka link paste karein:`);
        }
        break;

      case 'entering_link':
        const finalPrice = (currentOrder.quantity! / 1000) * currentOrder.service!.pricePer1000;
        setCurrentOrder({ ...currentOrder, link: text });
        setChatState('confirming');
        botReply(
          `Order Details 📝\n\nPlatform: ${PLATFORMS[currentOrder.platform!]}\nService: ${currentOrder.service!.name}\nLink: ${text}\nQuantity: ${currentOrder.quantity}\nTotal Price: $${finalPrice.toFixed(2)}\n\nType "Confirm" to place order or "Cancel" to start over.`,
          ["Confirm", "Cancel"]
        );
        break;

      case 'confirming':
        if (text.toLowerCase() === 'confirm') {
          const orderData = {
            userId: user.uid,
            platform: PLATFORMS[currentOrder.platform!],
            service: currentOrder.service?.name,
            link: currentOrder.link,
            quantity: currentOrder.quantity,
            price: (currentOrder.quantity! / 1000) * currentOrder.service!.pricePer1000,
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
          botReply("Order placed successfully! 🎉\nWe are processing it now.");
          setTimeout(() => {
            setChatState('initial');
            addMessage('bot', "Send 'Hi' to start create order");
          }, 3000);
        } else {
          setChatState('initial');
          botReply("Order cancelled. Send 'Hi' to start create order");
        }
        break;

      default:
        botReply("I didn't understand that. Send 'Hi' to start create order");
        setChatState('initial');
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative shadow-2xl bg-white dark:bg-slate-950 font-body">
      <div className="bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#312ECB] flex items-center justify-center text-white shadow-md">
            <Rocket size={24} className="fill-current" />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter text-[#312ECB] dark:text-white">SOCIALBOOST</h1>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="w-8 h-8 rounded-full text-slate-400 hover:text-[#312ECB]">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-slate-400">
            <Bell size={18} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full bg-[#312ECB] text-white font-bold text-xs shadow-lg">
                {user?.displayName?.[0] || 'U'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800">
              <DropdownMenuLabel className="dark:text-white">Account Settings</DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-slate-800" />
              <DropdownMenuItem onClick={() => router.push('/profile')} className="dark:text-slate-300 dark:hover:bg-slate-800">
                <UserIcon size={16} className="mr-2" /> View Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="dark:bg-slate-800" />
              <DropdownMenuItem onClick={() => auth?.signOut()} className="text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-950/30">
                <LogOut size={16} className="mr-2" /> Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 px-5 py-2 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 z-30">
        <span className="text-[10px] font-black italic text-[#312ECB]/40 dark:text-white/40 tracking-widest uppercase">
          Automated Assistant
        </span>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push('/orders')}
          className="text-[10px] font-black text-[#312ECB] dark:text-white uppercase tracking-widest gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <History size={14} /> Recent Orders
        </Button>
      </div>

      <div className="bg-[#312ECB] px-5 py-4 flex items-center gap-4 z-20 shadow-md">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
          <Bot size={28} className="text-white/80" />
        </div>
        <div>
          <h2 className="text-white font-black uppercase text-sm tracking-widest">SOCIALBOOST BOT</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Active Server</span>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-bg scroll-smooth">
        {messages.map((m: any) => (
          <MessageBubble 
            key={m.id} 
            sender={m.sender} 
            text={m.text} 
            options={m.options}
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
              placeholder="Type a message"
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
