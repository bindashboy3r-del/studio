"use client";

import { useState, useEffect, useRef } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp
} from "firebase/firestore";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, LogOut, MoreVertical, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { PLATFORMS, SERVICES, Platform, SMMService } from "@/app/lib/constants";
import { intelligentOrderParsing } from "@/ai/flows/intelligent-order-parsing";
import { useAuth, useFirestore, useUser } from "@/firebase";
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
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [currentOrder, setCurrentOrder] = useState<OrderInProgress>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) router.push("/");
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!user || !db) return;

    const q = query(
      collection(db, "users", user.uid, "chatMessages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    }, (error) => {
      const contextualError = new FirestorePermissionError({
        path: `users/${user.uid}/chatMessages`,
        operation: 'list'
      });
      errorEmitter.emit('permission-error', contextualError);
    });

    return () => unsubscribe();
  }, [user, db]);

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
    }, 1000);
  };

  const startOrderFlow = async () => {
    setChatState('initial');
    botReply(`Welcome to SocialBoost! 🚀\nI'm your assistant. Send 'Hi' to start creating your order.`);
  };

  useEffect(() => {
    if (messages.length === 0 && user && !isTyping && chatState === 'idle') {
      startOrderFlow();
    }
  }, [messages, user, chatState]);

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
      botReply("Send 'Hi' to start creating your order.");
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
      } catch (e) {
        // Fallback
      }
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
          startOrderFlow();
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
          setTimeout(() => startOrderFlow(), 3000);
        } else {
          setChatState('idle');
          botReply("Order cancelled.");
          setTimeout(() => startOrderFlow(), 2000);
        }
        break;

      default:
        botReply("I didn't understand that. Send 'Hi' to start.");
        setChatState('initial');
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen whatsapp-bg max-w-lg mx-auto overflow-hidden relative shadow-2xl">
      {/* WhatsApp Header */}
      <header className="bg-[#0F5C53] text-white p-3 px-4 flex items-center justify-between sticky top-0 z-20 shadow-md h-[60px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/10">
            <Rocket size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">SocialBoost</h1>
            <p className="text-[12px] text-white/80 flex items-center">
              <span className="status-dot" />
              Active Server
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Search size={20} className="text-white/80 cursor-pointer" />
          <div className="group relative">
            <MoreVertical size={20} className="text-white/80 cursor-pointer" />
            <div className="hidden group-hover:block absolute right-0 top-full mt-2 bg-white rounded-md shadow-xl border w-32 py-1 text-[#2E2E2E] z-30">
              <button 
                onClick={() => auth?.signOut()}
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col scroll-smooth">
        <div className="mx-auto bg-[#D9FDD3]/80 px-4 py-1.5 rounded-lg text-[12px] text-[#2E2E2E]/80 shadow-sm mb-6 uppercase tracking-wider font-semibold">
          Messages are secured
        </div>
        
        {messages.map((m) => (
          <MessageBubble 
            key={m.id} 
            sender={m.sender} 
            text={m.text} 
            timestamp={m.timestamp} 
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
              className="border-none bg-transparent focus-visible:ring-0 shadow-none text-[15px] h-9 p-0 text-[#2E2E2E]"
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
