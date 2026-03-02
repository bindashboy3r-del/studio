import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { SendHorizonal, Rocket, Home, QrCode, Download, MessageCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SuccessDetails {
  orderId: string;
  platform: string;
  service: string;
  quantity: number;
  price: number;
  link: string;
  utrId: string;
}

interface MessageBubbleProps {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  options?: string[];
  onOptionClick?: (option: string) => void;
  isPaymentCard?: boolean;
  paymentPrice?: number;
  onPaymentSubmit?: (link: string, utr: string) => void;
  isSuccessCard?: boolean;
  successDetails?: SuccessDetails;
}

export function MessageBubble({ 
  sender, 
  text, 
  timestamp, 
  options, 
  onOptionClick,
  isPaymentCard,
  paymentPrice,
  onPaymentSubmit,
  isSuccessCard,
  successDetails
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  const [link, setLink] = useState("");
  const [utr, setUtr] = useState("");
  
  const price = paymentPrice || 0;
  const upiLink = `upi://pay?pa=smmxpressbot@slc&pn=SocialBoost&am=${price}&cu=INR`;
  const qrUrl = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(upiLink)}&choe=UTF-8`;

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `SocialBoost_QR_₹${price}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      window.open(qrUrl, '_blank');
    }
  };

  const handleWhatsAppSend = () => {
    if (!successDetails) return;
    const msg = `Order Details:\n- Link: ${successDetails.link}\n- Service: ${successDetails.service}\n- UTR ID: ${successDetails.utrId}\n- Quantity: ${successDetails.quantity}`;
    const waUrl = `https://wa.me/919116399517?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const isFormValid = link.trim() !== "" && utr.length === 12;

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[90%] px-5 py-4 relative shadow-md",
        isUser 
          ? "bubble-user rounded-[24px] rounded-tr-none bg-[#DCF8C6] dark:bg-emerald-900" 
          : "bubble-bot rounded-[24px] rounded-tl-none bg-white dark:bg-slate-800"
      )}>
        {isSuccessCard && successDetails ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[15px] font-black text-[#111B21] dark:text-white leading-tight">
                🎉 Woohoo! Your InstaFlow order successfully created!
              </h3>
              
              <div className="space-y-2 text-[13px] font-bold text-slate-700 dark:text-slate-300">
                <p>- Order ID: <span className="text-[#312ECB] dark:text-blue-400">{successDetails.orderId}</span></p>
                <p>- Service: {successDetails.service}</p>
                <p>- Quantity: {successDetails.quantity}</p>
                <p>- Amount: ₹{successDetails.price.toFixed(0)}</p>
                <p>- Start Time: 0-30 minutes</p>
                <div className="pt-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Target Link:</p>
                  <p className="break-all text-[#312ECB] dark:text-blue-400">{successDetails.link}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Send Order Details to Admin and conform your order
                </p>
                <Button 
                  onClick={handleWhatsAppSend}
                  className="w-full h-14 bg-[#25D366] hover:bg-[#20bd5b] text-white font-black text-[12px] uppercase tracking-widest rounded-2xl shadow-xl gap-3"
                >
                  <MessageCircle size={20} /> SEND VIA WHATSAPP
                </Button>
              </div>

              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  onClick={() => onOptionClick?.("Main Menu")}
                  className="text-[11px] font-black uppercase text-[#312ECB] dark:text-white tracking-[0.2em] gap-2"
                >
                  <Home size={14} /> Main Menu
                </Button>
              </div>
            </div>
          </div>
        ) : isPaymentCard ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-black text-[#111B21] dark:text-white uppercase tracking-tight">
                <QrCode size={16} className="text-[#312ECB]" /> Secure Payment
              </div>
              <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                Kripya niche diye gaye QR code ko scan karke ya download karke <span className="text-[#312ECB] font-black">₹{price.toFixed(0)}</span> ka payment karein.
              </p>
              <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase">Kripya manual amount (₹{price.toFixed(0)}) enter karein.</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-2 rounded-2xl shadow-inner border border-slate-100 flex items-center justify-center min-h-[200px] min-w-[200px]">
                <img 
                  src={qrUrl} 
                  alt="Payment QR" 
                  className="w-48 h-48 block" 
                  crossOrigin="anonymous"
                  loading="eager"
                />
              </div>
              
              <Button 
                onClick={handleDownloadQR}
                className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] rounded-xl text-[12px] font-black uppercase tracking-widest gap-2 shadow-lg"
              >
                <Download size={18} /> Download QR Code
              </Button>
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
                maxLength={12}
                onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
              />
              <Button 
                onClick={() => onPaymentSubmit?.(link, utr)}
                disabled={!isFormValid}
                className="w-full h-14 bg-[#4FD1C5] hover:bg-[#38b2ac] text-white font-black text-[12px] uppercase tracking-widest rounded-2xl shadow-xl gap-3 disabled:opacity-50 disabled:grayscale cursor-pointer"
              >
                🚀 Submit Order Now
              </Button>
              {!isFormValid && utr.length > 0 && utr.length < 12 && (
                <p className="text-[10px] font-bold text-red-500 text-center uppercase tracking-tighter">
                  UTR ID must be exactly 12 digits
                </p>
              )}
            </div>

            <div className="flex justify-center border-t border-slate-50 dark:border-slate-700 pt-4">
              <Button 
                variant="ghost" 
                onClick={() => onOptionClick?.("Main Menu")}
                className="text-[11px] font-black uppercase text-[#312ECB] dark:text-white tracking-[0.2em] gap-2"
              >
                <Home size={14} /> Main Menu
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed font-bold text-black dark:text-white whitespace-pre-wrap">
            {text}
          </p>
        )}

        {options && options.length > 0 && !isPaymentCard && !isSuccessCard && (
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
