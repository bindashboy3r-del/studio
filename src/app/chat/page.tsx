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
import { Send, LogOut, MoreVertical, Search, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { PLATFORMS, SERVICES, Platform, SMMService } from "@/app/lib/constants";
import { intelligentOrderParsing } from "@/ai/flows/intelligent-order-parsing";
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

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
  
  // Track when this specific session started to "clear" old messages visually
  const [sessionStartTime] = useState(() => Date.now());
  const hasInitialGreeted = useRef(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memoize the query for chat messages
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "users", user.uid, "chatMessages"),
      orderBy("timestamp", "asc")
    );
  }, [db, user]);

  const { data: messagesData, isLoading: isMessagesLoading } = useCollection(messagesQuery);
  
  // Filter messages to only show those from this session, creating the "clear" effect
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

  // Bot initialization logic - fires once per session mount
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

    // Flow Logic
    if (chatState === 'initial' && text.toLowerCase() === 'hi') {
      setChatState('choosing_platform');
      botReply(`What can I help you with today?\n\n1️⃣ Instagram Services\n2️⃣ YouTube Services`);
      return;
    } else if (chatState === 'initial') {
      botReply("Send 'Hi' to start create order");
      return;
    }

    // AI Parsing Shortcut
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
      } catch (e) {
        // Fallback to manual flow
      }
    }

    // Manual Selection Flow
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
    <div className="flex flex-col h-screen whatsapp-bg max-w-lg mx-auto overflow-hidden relative shadow-2xl">
      {/* WhatsApp Header */}
      <header className="bg-[#054640] text-white p-3 px-4 flex items-center justify-between sticky top-0 z-20 shadow-md h-[60px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/10">
            <Rocket size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">SocialBoost</h1>
            <p className="text-[12px] text-white/80 flex items-center font-medium">
              <span className="status-dot" />
              Active Server
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Search size={20} className="text-white/80 cursor-pointer" />
          <div className="group relative">
            <MoreVertical size={20} className="text-white/80 cursor-pointer" />
            <div className="hidden group-hover:block absolute right-0 top-full mt-2 bg-white rounded-md shadow-xl border w-32 py-1 text-[#111B21] z-30">
              <button 
                onClick={() => auth?.signOut()}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2 font-semibold"
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col scroll-smooth">
        <div className="mx-auto bg-[#D9FDD3]/80 px-4 py-1.5 rounded-lg text-[12px] text-black shadow-sm mb-6 uppercase tracking-wider font-bold">
          Messages are secured
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
      <footer className="p-2 pb-4 px-3 bg-[#EFEAE2]">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white rounded-full flex items-center px-4 py-1.5 shadow-sm border border-black/5">
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message"
              className="border-none bg-transparent focus-visible:ring-0 shadow-none text-[15px] h-9 p-0 text-black font-semibold placeholder:text-gray-500"
            />
          </div>
          <Button 
            onClick={handleSend}
            size="icon" 
            className="rounded-full h-11 w-11 bg-[#25D366] hover:bg-[#20bd5b] transition-all active:scale-90 shrink-0 shadow-md"
          >
            <Send size={20} className="text-white ml-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
