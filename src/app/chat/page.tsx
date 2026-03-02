"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  limit
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
  Rocket,
  History,
  Bot
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type ChatState = 
  | 'idle' 
  | 'initial'
  | 'choosing_platform' 
  | 'choosing_service' 
  | 'entering_link' 
  | 'entering_quantity' 
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
  
  const [sessionStartTime] = useState(() => Date.now());
  const hasInitialGreeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "chatMessages"),
      orderBy("timestamp", "asc")
    );
  }, [db, user]);

  const { data: messagesData, isLoading: isMessagesLoading } = useCollection(messagesQuery);

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "orders"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
  }, [db, user]);

  const { data: ordersData } = useCollection(ordersQuery);
  
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

  const addMessage = async (sender: 'user' | 'bot', text: string) => {
    if (!user || !db) return;
    const path = `users/${user.uid}/chatMessages`;
    const data = {
      userId: user.uid,
      sender,
      text,
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

  const botReply = async (text: string) => {
    setIsTyping(true);
    setTimeout(async () => {
      await addMessage('bot', text);
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

  const handleSend = async () => {
    if (!inputValue.trim() || !db || !user) return;
    const text = inputValue.trim();
    setInputValue("");
    await addMessage('user', text);

    if (chatState === 'initial' && text.toLowerCase() === 'hi') {
      setChatState('choosing_platform');
      botReply(`What can I help you with today?\n\n1️⃣ Instagram Services\n2️⃣ YouTube Services`);
      return;
    } else if (chatState === 'initial') {
      botReply("Send 'Hi' to start create order");
      return;
    }

    if (chatState === 'choosing_platform' || chatState === 'idle') {
      try {
        if (text.length > 5) {
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
              botReply(`I've prepared your order! 🛒\n\nPlatform: ${PLATFORMS[parsed.platform as Platform]}\nService: ${service.name}\nLink: ${parsed.link}\nQuantity: ${parsed.quantity}\nTotal Price: $${price.toFixed(2)}\n\nReply "Confirm" to proceed or "Cancel" to abort.`);
              return;
            }
          }
        }
      } catch (e) { }
    }

    switch (chatState) {
      case 'choosing_platform':
        if (text === "1" || text.toLowerCase().includes("instagram")) {
          setCurrentOrder({ platform: 'instagram' });
          setChatState('choosing_service');
          const svcList = SERVICES.instagram.map((s, i) => `${i + 1}️⃣ ${s.name}`).join('\n');
          botReply(`Perfect. Select an Instagram service:\n\n${svcList}`);
        } else if (text === "2" || text.toLowerCase().includes("youtube")) {
          setCurrentOrder({ platform: 'youtube' });
          setChatState('choosing_service');
          const svcList = SERVICES.youtube.map((s, i) => `${i + 1}️⃣ ${s.name}`).join('\n');
          botReply(`Perfect. Select a YouTube service:\n\n${svcList}`);
        } else {
          botReply("Please enter 1 for Instagram or 2 for YouTube.");
        }
        break;

      case 'choosing_service':
        const index = parseInt(text) - 1;
        const platform = currentOrder.platform;
        if (!platform) {
          setChatState('initial');
          return;
        }
        const service = SERVICES[platform][index];
        if (service) {
          setCurrentOrder({ ...currentOrder, service });
          setChatState('entering_link');
          botReply(`Please provide the ${platform === 'instagram' ? 'Profile handle (@username) or Post URL' : 'Channel or Video URL'}:`);
        } else {
          botReply("Invalid selection. Please choose from the list.");
        }
        break;

      case 'entering_link':
        setCurrentOrder({ ...currentOrder, link: text });
        setChatState('entering_quantity');
        botReply("How many would you like? (Minimum 100)");
        break;

      case 'entering_quantity':
        const qty = parseInt(text);
        if (isNaN(qty) || qty < 100) {
          botReply("Please enter a valid number (minimum 100).");
        } else {
          const price = (qty / 1000) * currentOrder.service!.pricePer1000;
          setCurrentOrder({ ...currentOrder, quantity: qty });
          setChatState('confirming');
          botReply(`Order Details 📝\n\nPlatform: ${PLATFORMS[currentOrder.platform!]}\nService: ${currentOrder.service!.name}\nLink: ${currentOrder.link}\nQuantity: ${qty}\nTotal Price: $${price.toFixed(2)}\n\nType "Confirm" to place order or "Cancel" to start over.`);
        }
        break;

      case 'confirming':
        if (text.toLowerCase() === 'confirm') {
          const orderData = {
            userId: user.uid,
            platform: currentOrder.platform,
            service: currentOrder.service?.id,
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
    <div className="flex flex-col h-screen max-w-lg mx-auto overflow-hidden relative shadow-2xl bg-white font-body">
      {/* 1. TOP BAR (WHITE) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#312ECB] flex items-center justify-center text-white shadow-md">
            <Rocket size={24} className="fill-current" />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter text-[#312ECB]">SOCIALBOOST</h1>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-slate-400">
            <Moon size={18} />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full text-slate-400">
            <Bell size={18} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full bg-[#312ECB] text-white font-bold text-xs">
                {user?.displayName?.[0] || 'U'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => auth?.signOut()} className="text-red-600 font-bold">
                <LogOut size={16} className="mr-2" /> Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. SUB-HEADER BAR (WHITE) */}
      <div className="bg-white px-5 py-2 flex items-center justify-between border-b border-gray-100 z-30">
        <span className="text-[10px] font-black italic text-[#312ECB]/40 tracking-widest uppercase">
          Automated Assistant
        </span>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest gap-2">
              <History size={14} /> Recent Orders
            </Button>
          </SheetTrigger>
          <SheetContent className="bg-white">
            <SheetHeader>
              <SheetTitle className="text-xl font-black text-[#312ECB]">Your Recent Orders</SheetTitle>
              <SheetDescription>Track your active growth services.</SheetDescription>
            </SheetHeader>
            <div className="mt-8 space-y-4">
              {ordersData?.map((order: any) => (
                <div key={order.id} className="p-4 border border-gray-100 rounded-xl bg-slate-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-xs uppercase text-[#312ECB]">{order.platform} - {order.service}</span>
                    <Badge variant="outline" className="text-[10px] font-black uppercase">{order.status}</Badge>
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mb-1 truncate">{order.link}</div>
                  <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
                    <span>QTY: {order.quantity}</span>
                    <span>{order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, HH:mm') : ''}</span>
                  </div>
                </div>
              ))}
              {(!ordersData || ordersData.length === 0) && (
                <div className="text-center py-12 text-slate-400 font-bold text-sm">
                  No orders yet.
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* 3. BOT BANNER (DEEP BLUE) */}
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

      {/* 4. CHAT AREA */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-bg scroll-smooth">
        {messages.map((m: any) => (
          <MessageBubble 
            key={m.id} 
            sender={m.sender} 
            text={m.text} 
            timestamp={m.timestamp?.toDate ? m.timestamp.toDate() : new Date()} 
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={scrollRef} />
      </main>

      {/* INPUT BAR */}
      <footer className="p-3 bg-white border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-[#F0F2F5] rounded-full flex items-center px-5 py-1">
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message"
              className="border-none bg-transparent focus-visible:ring-0 shadow-none text-[15px] h-10 p-0 text-black font-semibold placeholder:text-gray-400"
            />
          </div>
          <Button 
            onClick={handleSend}
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
