'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/firebase';
import { supportBot } from '@/ai/flows/support-bot-flow';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

export function SupportBot() {
  const { user } = useUser();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Hi! I am the SocialBoost Assistant. How can I help you today? 🚀' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Clear history when the bot is closed
  const toggleBot = () => {
    if (isOpen) {
      // Clear history when closing
      setMessages([{ role: 'bot', text: 'Hi! I am the SocialBoost Assistant. How can I help you today? 🚀' }]);
    }
    setIsOpen(!isOpen);
  };

  const handleSend = async () => {
    if (!input.trim() || !user || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await supportBot({
        message: userMsg,
        userId: user.uid,
        history: messages.map(m => ({ 
          role: m.role === 'user' ? 'user' : 'model', 
          content: m.text 
        }))
      });

      setMessages(prev => [...prev, { role: 'bot', text: response.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: "Aapka order detail fetch karne mein dikkat aa rahi hai. Kripya thodi der baad koshish karein ya @social_boost.bot ko Instagram par contact karein. 😔" }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[100] flex flex-col items-start">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[320px] sm:w-[380px] h-[500px] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          <header className="bg-[#312ECB] p-6 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Support Bot</h3>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Always Online</p>
              </div>
            </div>
            <button onClick={toggleBot} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </header>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] p-4 text-[13px] leading-relaxed shadow-sm",
                    m.role === 'user' 
                      ? "bg-[#DCF8C6] dark:bg-emerald-900 text-black dark:text-white rounded-[1.5rem] rounded-tr-none" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-[1.5rem] rounded-tl-none"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-[1.5rem] rounded-tl-none">
                    <Loader2 size={16} className="animate-spin text-[#312ECB]" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <footer className="p-4 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Order ID search karein..."
                className="h-12 bg-white dark:bg-slate-800 border-none rounded-2xl px-4 text-sm font-bold shadow-inner"
              />
              <Button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon" 
                className="h-12 w-12 rounded-2xl bg-[#312ECB] hover:bg-[#2825A6] shadow-lg shrink-0"
              >
                <Send size={18} />
              </Button>
            </div>
          </footer>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleBot}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl transition-all active:scale-90 hover:scale-105",
          isOpen ? "bg-red-500 rotate-90" : "bg-[#312ECB]"
        )}
      >
        {isOpen ? <X size={28} /> : <Bot size={28} />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center text-[10px] font-black">
            1
          </span>
        )}
      </button>
    </div>
  );
}
