
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { SendHorizonal, Rocket, Home, QrCode, Download, MessageCircle, Copy, CheckCircle, Loader2, History } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

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
  const { toast } = useToast();
  const router = useRouter();
  const [link, setLink] = useState("");
  const [utr, setUtr] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  
  const price = paymentPrice || 0;
  const upiId = "smmxpressbot@slc";
  
  // Construct UPI link for QR generation
  const upiLink = `upi://pay?pa=${upiId}&pn=SocialBoost&am=${price.toFixed(2)}&cu=INR`;
  
  // Using QuickChart - a very stable and CORS-friendly generator
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;

  const handleDownloadQR = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `SocialBoost_Payment_QR.png`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Success", description: "QR Code download started." });
    } catch (error) {
      console.error('Download failed:', error);
      window.open(qrUrl, '_blank');
      toast({ 
        title: "Download Help", 
        description: "QR Code opened in a new tab. Long-press the image to save it to your gallery." 
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(upiId);
    toast({ title: "Copied!", description: "UPI ID copied to clipboard." });
  };

  const handleWhatsAppSend = () => {
    if (!successDetails) return;
    const msg = `*New Order Confirmation*\n\n- *Link:* ${successDetails.link}\n- *Service:* ${successDetails.service}\n- *UTR ID:* ${successDetails.utrId}\n- *Quantity:* ${successDetails.quantity}\n- *Amount:* ₹${successDetails.price.toFixed(0)}`;
    const waUrl = `https://wa.me/919116399517?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const isFormValid = link.trim() !== "" && utr.length === 12;

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[90%] px-5 py-4 relative shadow-md transition-all duration-300",
        isUser 
          ? "bubble-user rounded-[24px] rounded-tr-none bg-[#DCF8C6] dark:bg-emerald-900" 
          : "bubble-bot rounded-[24px] rounded-tl-none bg-white dark:bg-slate-800"
      )}>
        {isSuccessCard && successDetails ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                  <CheckCircle size={24} className="text-[#25D366]" />
                </div>
                <h3 className="text-[15px] font-black text-[#111B21] dark:text-white leading-tight">
                  🎉 Success! Your order has been placed.
                </h3>
              </div>
              
              <div className="space-y-2 text-[13px] font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
                <p className="flex justify-between"><span>Order ID:</span> <span className="text-[#312ECB] dark:text-blue-400">#{successDetails.orderId}</span></p>
                <p className="flex justify-between"><span>Service:</span> <span>{successDetails.service}</span></p>
                <p className="flex justify-between"><span>Quantity:</span> <span>{successDetails.quantity}</span></p>
                <p className="flex justify-between"><span>Amount:</span> <span className="text-[#25D366]">₹{successDetails.price.toFixed(0)}</span></p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Target Link:</p>
                  <p className="break-all text-[#312ECB] dark:text-blue-400 leading-snug">{successDetails.link}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 leading-relaxed">
                  Important: Please send these details to Admin via WhatsApp to confirm your order.
                </p>
                <Button 
                  onClick={handleWhatsAppSend}
                  className="w-full h-14 bg-[#25D366] hover:bg-[#20bd5b] text-white font-black text-[12px] uppercase tracking-widest rounded-2xl shadow-xl gap-3"
                >
                  <MessageCircle size={20} /> SEND VIA WHATSAPP
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/orders')}
                  className="h-12 border-slate-200 dark:border-slate-700 text-[#312ECB] dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2"
                >
                  <History size={14} /> My History
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => onOptionClick?.("Main Menu")}
                  className="h-12 border-slate-200 dark:border-slate-700 text-[#111B21] dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2"
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
                <QrCode size={16} className="text-[#312ECB]" /> Secure Payment Gateway
              </div>
              <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                Kripya QR code scan karein ya UPI ID copy karke <span className="text-[#312ECB] font-black">₹{price.toFixed(0)}</span> ka payment karein.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl space-y-3 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">UPI ID</p>
                  <p className="text-[14px] font-black text-[#111B21] dark:text-white">{upiId}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCopyUPI} className="h-8 w-8 text-[#312ECB]">
                  <Copy size={16} />
                </Button>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">Amount to pay</span>
                <span className="text-[16px] font-black text-[#25D366]">₹{price.toFixed(0)}</span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-3 rounded-[2rem] shadow-inner border border-slate-100 flex items-center justify-center min-h-[220px] min-w-[220px]">
                <img 
                  src={qrUrl} 
                  alt="Payment QR" 
                  className="w-48 h-48 block rounded-xl" 
                  crossOrigin="anonymous"
                  loading="eager"
                  onError={(e) => {
                    console.error('QR load error');
                    toast({ variant: "destructive", title: "Error", description: "QR failed to load. Use UPI ID instead." });
                  }}
                />
              </div>

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center px-4">
                Agar download na ho to screenshot leke payment kre
              </p>
              
              <Button 
                onClick={handleDownloadQR}
                disabled={isDownloading}
                className="w-full h-12 bg-white dark:bg-slate-900 text-[#312ECB] hover:bg-slate-50 border-2 border-[#312ECB] rounded-xl text-[12px] font-black uppercase tracking-widest gap-2 shadow-sm"
              >
                {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {isDownloading ? "Downloading..." : "Download QR Code"}
              </Button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Link</label>
                <Input 
                  placeholder="Paste Instagram/YouTube link here"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">12-Digit UTR ID</label>
                <Input 
                  placeholder="Enter 12-Digit Transaction ID"
                  value={utr}
                  maxLength={12}
                  onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
                />
              </div>
              <Button 
                onClick={() => onPaymentSubmit?.(link, utr)}
                disabled={!isFormValid}
                className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[12px] uppercase tracking-widest rounded-2xl shadow-xl gap-3 disabled:opacity-50 disabled:grayscale transition-all transform active:scale-95"
              >
                🚀 Submit Order Now
              </Button>
              {!isFormValid && utr.length > 0 && utr.length < 12 && (
                <p className="text-[10px] font-bold text-red-500 text-center uppercase tracking-tighter animate-pulse">
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
                className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group shadow-sm active:scale-98"
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
