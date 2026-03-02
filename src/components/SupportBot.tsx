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
    { role: 'bot', text: 'Namaste! Main SocialBoost AI Assistant hoon. Order status ya kisi bhi help ke liye mujhse puchein! 🚀' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const toggleBot = () => {
    if (isOpen) {
      // Re-initialize greeting when closing/re-opening if desired
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
      const chatHistory = messages.slice(-6).map(m => ({ 
        role: m.role === 'user' ? 'user' : 'model' as 'user' | 'model', 
        content: m.text 
      }));

      const response = await supportBot({
        message: userMsg,
        userId: user.uid,
        history: chatHistory
      });

      setMessages(prev => [...prev, { role: 'bot', text: response.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', text: "Aapka message samajhne mein dikkat hui. Kripya @social_boost.bot par contact karein. 😔" }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[320px] sm:w-[380px] h-[520px] bg-white dark:bg-slate-900 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          <header className="bg-[#312ECB] p-6 flex items-center justify-between text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                <Bot size={24} />
              </div>
              <div>
                <h3 className="text-[15px] font-black uppercase tracking-tight">SocialBoost AI</h3>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Active & Powerful</p>
              </div>
            </div>
            <button onClick={toggleBot} className="p-2 hover:bg-white/10 rounded-full transition-all">
              <X size={20} />
            </button>
          </header>

          <ScrollArea className="flex-1 p-5 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] p-4 text-[13px] font-bold leading-relaxed shadow-sm",
                    m.role === 'user' 
                      ? "bg-[#312ECB] text-white rounded-[1.8rem] rounded-tr-none" 
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-[1.8rem] rounded-tl-none border border-gray-100 dark:border-slate-700"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.8rem] rounded-tl-none border border-gray-100 dark:border-slate-700">
                    <Loader2 size={16} className="animate-spin text-[#312ECB]" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <footer className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-2xl p-1">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about your order..."
                className="h-12 border-none bg-transparent focus-visible:ring-0 text-sm font-bold shadow-none"
              />
              <Button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon" 
                className="h-11 w-11 rounded-xl bg-[#312ECB] hover:bg-[#2825A6] shadow-md shrink-0 transition-transform active:scale-95"
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
          "w-16 h-16 rounded-[2rem] flex items-center justify-center text-white shadow-[0_15px_30px_rgba(49,46,203,0.3)] transition-all active:scale-90 hover:scale-105",
          isOpen ? "bg-red-500 rotate-90" : "bg-[#312ECB]"
        )}
      >
        {isOpen ? <X size={28} /> : <Bot size={28} />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center text-[10px] font-black animate-bounce">
            1
          </span>
        )}
      </button>
    </div>
  );
}
