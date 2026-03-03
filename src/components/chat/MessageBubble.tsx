
"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  SendHorizonal, 
  Rocket, 
  Home, 
  QrCode, 
  Download, 
  MessageCircle, 
  Copy, 
  CheckCircle, 
  History, 
  Wallet,
  Plus,
  Trash2,
  Layers,
  Link as LinkIcon,
  Percent,
  ChevronDown
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { SMMService } from "@/app/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  isFundPaymentCard?: boolean;
  fundPrice?: number;
  onFundSubmit?: (amount: number, utr: string) => void;
  isBulkLinkCard?: boolean;
  onBulkLinksSubmit?: (links: string[]) => void;
  isComboCard?: boolean;
  onComboSubmit?: (items: { serviceId: string, quantity: number }[], link: string) => void;
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
  onPaymentSubmit,
  isSuccessCard,
  successDetails,
  isFundPaymentCard,
  fundPrice,
  onFundSubmit,
  isBulkLinkCard,
  onBulkLinksSubmit,
  isComboCard,
  onComboSubmit,
  isWalletCard,
  onWalletSubmit,
  dynamicServices,
  discountPct = 5
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  const { toast } = useToast();
  const router = useRouter();
  
  const [link, setLink] = useState("");
  const [utr, setUtr] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [bulkLinks, setBulkLinks] = useState<string[]>([]);
  const [currentBulkLink, setCurrentBulkLink] = useState("");

  const [comboItems, setComboItems] = useState<{ serviceId: string, quantity: number }[]>([]);
  const [comboLink, setComboLink] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isComboCard && dynamicServices && dynamicServices.length > 0 && comboItems.length === 0) {
      const defaultKeywords = ['likes', 'views', 'comments'];
      const foundDefaults = dynamicServices
        .filter(s => defaultKeywords.some(kw => s.name.toLowerCase().includes(kw)))
        .map(s => ({ serviceId: s.id, quantity: s.minQuantity || 100 }))
        .slice(0, 3);
      setComboItems(foundDefaults.length > 0 ? foundDefaults : dynamicServices.slice(0, 3).map(s => ({ serviceId: s.id, quantity: s.minQuantity || 100 })));
    }
  }, [isComboCard, dynamicServices, comboItems.length]);

  const price = paymentPrice || fundPrice || 0;
  const upiId = "smmxpressbot@slc";
  const upiLink = `upi://pay?pa=${upiId}&pn=SocialBoost&am=${price.toFixed(2)}&cu=INR`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;

  const comboTotal = useMemo(() => {
    const raw = comboItems.reduce((sum, item) => {
      const s = dynamicServices?.find(sv => sv.id === item.serviceId);
      return sum + (item.quantity / 1000) * (s?.pricePer1000 || 0);
    }, 0);
    return { raw, discounted: raw * (1 - discountPct / 100) };
  }, [comboItems, dynamicServices, discountPct]);

  if (!mounted) return null;

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[90%] px-5 py-4 relative shadow-md transition-all", isUser ? "bubble-user rounded-[24px] rounded-tr-none" : "bubble-bot rounded-[24px] rounded-tl-none")}>
        {isSuccessCard && successDetails ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={24} className="text-[#25D366]" />
              <h3 className="text-[15px] font-black uppercase">Order Submitted</h3>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl text-[12px] font-bold space-y-2">
              <p className="flex justify-between"><span>ID:</span><span className="text-[#312ECB]">#{successDetails.orderId}</span></p>
              <p className="flex justify-between"><span>Amount:</span><span className="text-emerald-600">₹{successDetails.price.toFixed(2)}</span></p>
              <p className="flex justify-between"><span>Link:</span><span className="truncate max-w-[150px]">{successDetails.link}</span></p>
            </div>
            <Button onClick={() => onOptionClick?.("Main Menu")} className="w-full h-12 bg-[#312ECB] uppercase font-black">Main Menu</Button>
          </div>
        ) : isPaymentCard ? (
          <div className="space-y-4">
            <p className="text-[13px] font-bold">Pay <span className="text-[#312ECB]">₹{price.toFixed(2)}</span> via UPI:</p>
            <div className="flex flex-col items-center gap-3">
              <img src={qrUrl} className="w-40 h-40 rounded-xl" />
              <Button onClick={() => navigator.clipboard.writeText(upiId)} variant="outline" className="w-full h-10 text-[10px] uppercase font-black">Copy UPI ID</Button>
            </div>
            <Input placeholder="Instagram Link" value={link} onChange={(e) => setLink(e.target.value)} className="h-11 rounded-xl" />
            <Input placeholder="12-Digit UTR ID" value={utr} maxLength={12} onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))} className="h-11 rounded-xl" />
            <Button onClick={() => onPaymentSubmit?.(link, utr)} disabled={!link || utr.length !== 12} className="w-full h-12 bg-[#312ECB] font-black uppercase">Submit Order</Button>
          </div>
        ) : isComboCard ? (
          <div className="space-y-4 min-w-[260px]">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-black uppercase">Combo Builder</span>
              <Badge className="bg-emerald-500 text-white font-black">{discountPct}% OFF</Badge>
            </div>
            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-2">
              {comboItems.map((item, idx) => {
                const s = dynamicServices?.find(sv => sv.id === item.serviceId);
                return (
                  <div key={idx} className="bg-slate-50 p-3 rounded-2xl flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase truncate flex-1">{s?.name}</span>
                    <Input type="number" value={item.quantity} onChange={(e) => setComboItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 0 } : it))} className="h-8 w-16 text-[10px]" />
                    <button onClick={() => setComboItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 size={14}/></button>
                  </div>
                );
              })}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-10 text-[10px] font-black uppercase">Add Service</Button></DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]">{dynamicServices?.filter(s => !comboItems.find(it => it.serviceId === s.id)).map(s => <DropdownMenuItem key={s.id} onClick={() => setComboItems([...comboItems, { serviceId: s.id, quantity: s.minQuantity }])}>{s.name}</DropdownMenuItem>)}</DropdownMenuContent>
            </DropdownMenu>
            <Input placeholder="Target Link" value={comboLink} onChange={(e) => setComboLink(e.target.value)} className="h-11" />
            <div className="text-center"><p className="text-[13px] font-black text-emerald-600">Total: ₹{comboTotal.discounted.toFixed(2)}</p></div>
            <Button onClick={() => onComboSubmit?.(comboItems, comboLink)} disabled={!comboLink || comboItems.length === 0} className="w-full h-12 bg-[#312ECB] font-black uppercase">Confirm Combo</Button>
          </div>
        ) : (
          <p className="text-[14px] font-bold whitespace-pre-wrap">{text}</p>
        )}
        {options && !isPaymentCard && !isSuccessCard && !isComboCard && (
          <div className="mt-4 space-y-2">
            {options.map((opt, i) => (
              <button key={i} onClick={() => onOptionClick?.(opt)} className="w-full bg-white dark:bg-slate-900 border p-3 rounded-2xl flex items-center justify-between group">
                <span className="text-[10px] font-black uppercase text-[#312ECB]">{opt}</span>
                <SendHorizonal size={14} className="text-[#312ECB] group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
