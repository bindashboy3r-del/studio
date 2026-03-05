
"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  SendHorizonal, 
  Wallet,
  Copy,
  Download,
  Percent
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SMMService } from "@/app/lib/constants";

interface MessageBubbleProps {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  options?: string[];
  onOptionClick?: (option: string) => void;
  isPaymentCard?: boolean;
  paymentPrice?: number;
  rawPrice?: number;
  isWalletCard?: boolean;
  onWalletSubmit?: (link: string) => void;
  dynamicServices?: SMMService[] | null;
  discountPct?: number;
}

export function MessageBubble({ 
  sender, 
  text, 
  timestamp, 
  options, 
  onOptionClick,
  isPaymentCard,
  paymentPrice,
  rawPrice,
  isWalletCard,
  onWalletSubmit,
  discountPct = 0
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  const { toast } = useToast();
  
  const [link, setLink] = useState("");
  const [utr, setUtr] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const price = paymentPrice || 0;
  const finalRawPrice = rawPrice || 0;

  const upiId = "smmxpressbot@slc";
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=SocialBoost&am=${price.toFixed(2)}&cu=INR`)}&size=400&margin=1&format=png`;

  const handleDownloadQR = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SocialBoost_Pay_${price.toFixed(0)}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "QR Saved" });
    } catch (e) { window.open(qrUrl, '_blank'); }
    finally { setIsDownloading(false); }
  };

  if (!mounted) return null;

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[92%] px-4 py-3 relative border border-white/5", 
        isUser ? "bubble-user" : "bubble-bot"
      )}>
        
        {isPaymentCard ? (
          <div className="space-y-4 min-w-[220px]">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-none font-black text-[8px] px-2 shadow-3d-sm">
                  <Percent size={10} className="mr-1" /> {discountPct}% OFF APPLIED
                </Badge>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-500 line-through tracking-wider">Original Price: ₹{finalRawPrice.toFixed(2)}</span>
                <h3 className="text-[18px] font-black text-[#312ECB] tracking-tighter">NOW ONLY: ₹{price.toFixed(2)}</h3>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-[1.5rem] flex flex-col items-center gap-3 shadow-3d-pressed border border-white/10">
              <div className="bg-white p-2 rounded-2xl shadow-3d border border-white/20">
                <img src={qrUrl} alt="UPI QR" className="w-28 h-28" />
              </div>
              <div className="flex w-full gap-2">
                <Button onClick={() => { navigator.clipboard.writeText(upiId); toast({ title: "Copied!" }); }} variant="outline" className="flex-1 h-9 text-[8px] font-black uppercase rounded-xl border-white/10 shadow-3d active:shadow-3d-pressed">
                  <Copy size={10} /> COPY UPI
                </Button>
                <Button onClick={handleDownloadQR} disabled={isDownloading} variant="outline" className="flex-1 h-9 text-[8px] font-black uppercase rounded-xl border-white/10 shadow-3d active:shadow-3d-pressed text-[#312ECB]">
                  <Download size={10} /> SAVE QR
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 ml-1 tracking-widest">Post/Profile Link</label>
                  <Input placeholder="Enter link here" value={link} onChange={(e) => setLink(e.target.value)} className="h-10 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-bold text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-red-500 ml-1 leading-none animate-pulse">Shi utr dalo varna payment verify nhi hoga</label>
                  <Input placeholder="Enter 12-Digit UTR ID" value={utr} maxLength={12} onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))} className="h-10 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-black tracking-widest text-xs" />
                </div>
              </div>
              <Button onClick={() => onOptionClick?.(`SUBMIT_PAYMENT:${link}:${utr}`)} disabled={!link || utr.length !== 12} className="w-full h-12 bg-[#312ECB] font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10">
                SUBMIT 3D PAYMENT
              </Button>
            </div>
          </div>
        ) : isWalletCard ? (
          <div className="space-y-4 min-w-[200px]">
             <div className="flex flex-col items-center gap-2 p-4 bg-slate-950 rounded-[1.5rem] shadow-3d-pressed border border-white/10">
                <div className="w-10 h-10 bg-[#312ECB] rounded-2xl flex items-center justify-center shadow-3d border border-white/10">
                  <Wallet className="text-white" size={20} />
                </div>
                <div className="text-center">
                  <Badge className="bg-pink-500/20 text-pink-400 border-none font-black text-[7px] mb-1">WALLET PAYMENT</Badge>
                  <div className="flex flex-col items-center mt-1">
                    <span className="text-[10px] font-bold text-slate-500 line-through">Real: ₹{finalRawPrice.toFixed(2)}</span>
                    <p className="text-[20px] font-black text-[#312ECB] tracking-tighter">Pay: ₹{price.toFixed(2)}</p>
                  </div>
                </div>
             </div>
             <Button onClick={() => onOptionClick?.(`CONFIRM_WALLET:${link}`)} className="w-full h-12 bg-[#312ECB] font-black text-[10px] uppercase rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10">CONFIRM ORDER</Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[12px] font-bold whitespace-pre-wrap leading-relaxed tracking-wide">{text}</p>
          </div>
        )}

        {options && !isPaymentCard && !isWalletCard && (
          <div className="mt-4 space-y-2">
            {options.map((opt, i) => (
              <button key={i} onClick={() => onOptionClick?.(opt)} className="w-full bg-slate-900 border border-white/5 p-3 rounded-2xl flex items-center justify-between group shadow-3d active:shadow-3d-pressed transition-all">
                <span className="text-[10px] font-black uppercase text-[#312ECB] tracking-widest">{opt}</span>
                <div className="w-7 h-7 rounded-xl bg-[#312ECB]/10 flex items-center justify-center text-[#312ECB] shadow-3d-sm group-hover:scale-110 transition-transform">
                  <SendHorizonal size={12} />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className={cn("text-[7px] mt-2 font-black uppercase opacity-40 tracking-widest", isUser ? "text-right" : "text-left")}>
          {format(timestamp, 'HH:mm')}
        </div>
      </div>
    </div>
  );
}
