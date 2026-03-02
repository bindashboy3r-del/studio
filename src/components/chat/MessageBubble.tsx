import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { SendHorizonal, Rocket, Home, QrCode, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MessageBubbleProps {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  options?: string[];
  onOptionClick?: (option: string) => void;
  isPaymentCard?: boolean;
  paymentPrice?: number;
  onPaymentSubmit?: (link: string, utr: string) => void;
}

export function MessageBubble({ 
  sender, 
  text, 
  timestamp, 
  options, 
  onOptionClick,
  isPaymentCard,
  paymentPrice,
  onPaymentSubmit
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  const [link, setLink] = useState("");
  const [utr, setUtr] = useState("");
  
  const upiLink = `upi://pay?pa=smmxpressbot@slc&pn=SocialBoost&am=${paymentPrice}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[90%] px-5 py-4 relative shadow-md",
        isUser 
          ? "bubble-user rounded-[24px] rounded-tr-none bg-[#DCF8C6] dark:bg-emerald-900" 
          : "bubble-bot rounded-[24px] rounded-tl-none bg-white dark:bg-slate-800"
      )}>
        {!isPaymentCard ? (
          <p className="text-[14px] leading-relaxed font-bold text-black dark:text-white whitespace-pre-wrap">
            {text}
          </p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-black text-[#111B21] dark:text-white uppercase tracking-tight">
                <QrCode size={16} className="text-[#312ECB]" /> Secure Payment
              </div>
              <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                Kripya niche diye gaye QR code ko scan karke ya download karke <span className="text-[#312ECB] font-black">₹{paymentPrice?.toFixed(0)}</span> ka payment karein.
              </p>
              <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">
                <p className="text-[11px] font-black text-slate-500 uppercase">UPI ID: <span className="text-[#312ECB] dark:text-blue-400">smmxpressbot@slc</span></p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-2 rounded-2xl shadow-inner border border-slate-100">
                <img src={qrUrl} alt="Payment QR" className="w-48 h-48" />
              </div>
              
              <Button 
                asChild
                className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] rounded-xl text-[12px] font-black uppercase tracking-widest gap-2 shadow-lg"
              >
                <a href={qrUrl} target="_blank" rel="noopener noreferrer">
                  <Download size={18} /> Download QR Code
                </a>
              </Button>
              
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-center">
                Payment ke baad 12-digit UTR ID niche form mein bharein:
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Input 
                placeholder="Instagram Profile/Post Link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
              />
              <Input 
                placeholder="12-Digit Payment UTR ID"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                className="h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
              />
              <Button 
                onClick={() => onPaymentSubmit?.(link, utr)}
                className="w-full h-14 bg-[#4FD1C5] hover:bg-[#38b2ac] text-white font-black text-[12px] uppercase tracking-widest rounded-2xl shadow-xl gap-3"
              >
                🚀 Submit Order Now
              </Button>
            </div>

            <div className="flex justify-center border-t border-slate-50 dark:border-slate-700 pt-4">
              <Button 
                variant="ghost" 
                onClick={() => onOptionClick?.("Main Menu")}
                className="text-[11px] font-black uppercase text-[#312ECB] dark:text-white tracking-[0.2em] gap-2 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <Home size={14} /> Main Menu
              </Button>
            </div>
          </div>
        )}

        {options && options.length > 0 && !isPaymentCard && (
          <div className="mt-4 space-y-2">
            {options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => onOptionClick?.(option)}
                className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group shadow-sm"
              >
                <span className="text-[11px] font-black uppercase tracking-widest text-[#312ECB] dark:text-blue-400">
                  {option}
                </span>
                <div className="text-[#312ECB] group-hover:translate-x-1 transition-transform">
                  <SendHorizonal size={14} />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-2 opacity-30">
          <span className="text-[9px] font-black uppercase tracking-tighter text-black dark:text-white">
            {format(timestamp, 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}
