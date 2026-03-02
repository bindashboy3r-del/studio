"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp
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
  User, 
  Rocket,
  Settings,
  ShieldCheck
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
    <div className="flex flex-col h-screen whatsapp-bg max-w-lg mx-auto overflow-hidden relative shadow-2xl bg-[#EFEAE2]">
      {/* Top Banner / New Header */}
      <header className="bg-[#054640] text-white p-4 flex items-center justify-between sticky top-0 z-30 shadow-lg h-[70px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <Rocket size={22} className="text-[#25D366]" />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight leading-none">SocialBoost</h1>
            <div className="flex items-center mt-1">
              <span className="status-dot" />
              <p className="text-[10px] text-white/70 uppercase font-black tracking-widest">Active Server</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Button */}
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 bg-white/5 hover:bg-white/10 text-white border border-white/10">
            <Bell size={18} />
          </Button>

          {/* Dark Mode Button */}
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 bg-white/5 hover:bg-white/10 text-white border border-white/10">
            <Moon size={18} />
          </Button>

          {/* Profile Button with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 bg-white/5 hover:bg-white/10 text-white border border-white/10">
                <User size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200">
              <DropdownMenuLabel className="font-black text-black">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <Settings size={16} /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <ShieldCheck size={16} /> Privacy
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => auth?.signOut()}
                className="flex items-center gap-2 font-black text-red-600 cursor-pointer"
              >
                <LogOut size={16} /> Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 flex flex-col scroll-smooth">
        <div className="mx-auto bg-[#D9FDD3]/90 px-5 py-2 rounded-xl text-[11px] text-black shadow-sm mb-8 uppercase tracking-widest font-black border border-black/5">
          🔒 End-to-end encrypted
        </div>
        
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

      {/* WhatsApp Input Bar */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-3 bg-[#F0F2F5]/95 backdrop-blur-md border-t border-black/5 z-20">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white rounded-2xl flex items-center px-4 py-2 shadow-sm border border-black/10">
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message"
              className="border-none bg-transparent focus-visible:ring-0 shadow-none text-[15px] h-10 p-0 text-black font-bold placeholder:text-gray-400"
            />
          </div>
          <Button 
            onClick={handleSend}
            size="icon" 
            className="rounded-full h-12 w-12 bg-[#25D366] hover:bg-[#20bd5b] transition-all active:scale-90 shrink-0 shadow-xl border-2 border-white/20"
          >
            <Send size={24} className="text-white ml-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
