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
import { Send, LogOut, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { PLATFORMS, SERVICES, Platform, SMMService } from "@/app/lib/constants";
import { intelligentOrderParsing } from "@/ai/flows/intelligent-order-parsing";
import { useAuth, useFirestore, useUser } from "@/firebase";

type ChatState = 
  | 'idle' 
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
      collection(db, "messages", user.uid, "user_messages"),
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
    await addDoc(collection(db, "messages", user.uid, "user_messages"), {
      sender,
      text,
      timestamp: serverTimestamp()
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
    setChatState('choosing_platform');
    botReply("Welcome to ChatServe! 🚀\nHow can I help you today?\n\n1️⃣ Instagram Services\n2️⃣ YouTube Services");
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

    if (chatState === 'choosing_platform' || chatState === 'idle') {
      try {
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
            botReply(`I've detected an order! 🛒\n\nPlatform: ${PLATFORMS[parsed.platform as Platform]}\nService: ${service.name}\nLink: ${parsed.link}\nQuantity: ${parsed.quantity}\nTotal Price: $${price.toFixed(2)}\n\nReply "Confirm" to proceed or "Cancel" to abort.`);
            return;
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
          botReply(`Great! Select a service for Instagram:\n\n${svcList}`);
        } else if (text === "2" || text.toLowerCase().includes("youtube")) {
          setCurrentOrder({ platform: 'youtube' });
          setChatState('choosing_service');
          const svcList = SERVICES.youtube.map((s, i) => `${i + 1}️⃣ ${s.name}`).join('\n');
          botReply(`Great! Select a service for YouTube:\n\n${svcList}`);
        } else {
          botReply("Please choose 1 for Instagram or 2 for YouTube.");
        }
        break;

      case 'choosing_service':
        const index = parseInt(text) - 1;
        const platform = currentOrder.platform!;
        const service = SERVICES[platform][index];
        if (service) {
          setCurrentOrder({ ...currentOrder, service });
          setChatState('entering_link');
          botReply(`Please provide the ${platform === 'instagram' ? 'Profile handle (@username) or Post URL' : 'Channel or Video URL'}:`);
        } else {
          botReply("Invalid selection. Please choose from the list above.");
        }
        break;

      case 'entering_link':
        setCurrentOrder({ ...currentOrder, link: text });
        setChatState('entering_quantity');
        botReply("How many would you like to order? (e.g., 1000)");
        break;

      case 'entering_quantity':
        const qty = parseInt(text);
        if (isNaN(qty) || qty <= 0) {
          botReply("Please enter a valid positive number for quantity.");
        } else {
          const price = (qty / 1000) * currentOrder.service!.pricePer1000;
          setCurrentOrder({ ...currentOrder, quantity: qty });
          setChatState('confirming');
          botReply(`Order Summary 📝\n\nPlatform: ${PLATFORMS[currentOrder.platform!]}\nService: ${currentOrder.service!.name}\nLink: ${currentOrder.link}\nQuantity: ${qty}\nTotal Price: $${price.toFixed(2)}\n\nType "Confirm" to place order or "Cancel" to start over.`);
        }
        break;

      case 'confirming':
        if (text.toLowerCase() === 'confirm') {
          await addDoc(collection(db, "orders"), {
            uid: user?.uid,
            platform: currentOrder.platform,
            service: currentOrder.service?.id,
            link: currentOrder.link,
            quantity: currentOrder.quantity,
            price: (currentOrder.quantity! / 1000) * currentOrder.service!.pricePer1000,
            status: 'Pending',
            createdAt: serverTimestamp()
          });
          setChatState('idle');
          botReply("Order placed successfully! 🎉\nYour request is being processed. It will show as 'Pending' in your history.");
          setTimeout(() => startOrderFlow(), 3000);
        } else {
          setChatState('idle');
          botReply("Order cancelled. Let's start over.");
          setTimeout(() => startOrderFlow(), 2000);
        }
        break;

      default:
        botReply("I didn't quite catch that. Let's start over.");
        startOrderFlow();
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen dark chat-bg max-w-md mx-auto relative overflow-hidden">
      <header className="bg-card border-b p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h1 className="font-bold text-sm">ChatServe Bot</h1>
            <p className="text-[10px] text-primary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Online
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => auth?.signOut()}>
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 scrollbar-hide">
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

      <footer className="p-3 bg-background border-t">
        <div className="flex items-center gap-2 max-w-lg mx-auto bg-muted/30 rounded-full px-2 py-1 shadow-inner border">
          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="border-none bg-transparent focus-visible:ring-0 shadow-none text-sm h-10"
          />
          <Button 
            onClick={handleSend}
            size="icon" 
            className="rounded-full h-9 w-9 bg-primary hover:bg-primary/90 transition-transform active:scale-90"
          >
            <Send size={18} className="ml-0.5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
