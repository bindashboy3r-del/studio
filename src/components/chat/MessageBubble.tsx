
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
  isBulkLinkCard,
  onBulkLinksSubmit,
  isComboCard,
  onComboSubmit,
  isWalletCard,
  onWalletSubmit,
  dynamicServices,
  discountPct = 0
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  const { toast } = useToast();
  const router = useRouter();
  
  const [link, setLink] = useState("");
  const [utr, setUtr] = useState("");
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

  const price = paymentPrice || 0;
  const upiId = "smmxpressbot@slc";
  const upiLink = `upi://pay?pa=${upiId}&pn=SocialBoost&am=${price.toFixed(2)}&cu=INR`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;

  const comboTotal = useMemo(() => {
    const raw = comboItems.reduce((sum, item) => {
      const s = dynamicServices?.find(sv => sv.id === item.serviceId);
      return sum + (item.quantity / 1000) * (s?.pricePer1000 || 0);
    }, 0);
    return { raw, discounted: raw * (1 - (discountPct || 0) / 100) };
  }, [comboItems, dynamicServices, discountPct]);

  if (!mounted) return null;

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[90%] px-5 py-4 relative shadow-md transition-all", isUser ? "bubble-user rounded-[24px] rounded-tr-none" : "bubble-bot rounded-[24px] rounded-tl-none")}>
        {isSuccessCard && successDetails ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={24} className="text-[#25D366]" />
              <h3 className="text-[15px] font-black uppercase text-slate-800">Order Submitted</h3>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl text-[12px] font-bold space-y-2 text-slate-800 dark:text-slate-100">
              <p className="flex justify-between"><span>ID:</span><span className="text-[#312ECB]">#{successDetails.orderId}</span></p>
              <p className="flex justify-between"><span>Amount:</span><span className="text-emerald-600">₹{successDetails.price.toFixed(2)}</span></p>
              <p className="flex justify-between"><span>Link:</span><span className="truncate max-w-[150px]">{successDetails.link}</span></p>
            </div>
            <Button onClick={() => onOptionClick?.("Main Menu")} className="w-full h-12 bg-[#312ECB] uppercase font-black">Main Menu</Button>
          </div>
        ) : isPaymentCard ? (
          <div className="space-y-4">
            <p className="text-[13px] font-bold text-slate-800">Pay <span className="text-[#312ECB]">₹{price.toFixed(2)}</span> via UPI:</p>
            <div className="flex flex-col items-center gap-3">
              <img src={qrUrl} alt="UPI QR" className="w-40 h-40 rounded-xl" />
              <Button onClick={() => { navigator.clipboard.writeText(upiId); toast({ title: "Copied!" }); }} variant="outline" className="w-full h-10 text-[10px] uppercase font-black border-slate-200 text-slate-600">Copy UPI ID</Button>
            </div>
            <Input placeholder="Instagram Link" value={link} onChange={(e) => setLink(e.target.value)} className="h-11 rounded-xl text-slate-800" />
            <Input placeholder="12-Digit UTR ID" value={utr} maxLength={12} onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))} className="h-11 rounded-xl text-slate-800" />
            <Button onClick={() => onPaymentSubmit?.(link, utr)} disabled={!link || utr.length !== 12} className="w-full h-12 bg-[#312ECB] font-black uppercase">Submit Order</Button>
          </div>
        ) : isComboCard ? (
          <div className="space-y-4 min-w-[260px]">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-black uppercase text-slate-800">Combo Builder</span>
              {discountPct > 0 && <Badge className="bg-emerald-500 text-white font-black">{discountPct}% OFF</Badge>}
            </div>
            <div className="max-h-[180px] overflow-y-auto space-y-2 pr-2">
              {comboItems.map((item, idx) => {
                const s = dynamicServices?.find(sv => sv.id === item.serviceId);
                return (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl flex items-center justify-between gap-2 border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-black uppercase truncate flex-1 text-slate-800 dark:text-slate-100">{s?.name || 'Loading...'}</span>
                    <Input type="number" value={item.quantity} onChange={(e) => setComboItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 0 } : it))} className="h-8 w-16 text-[10px] bg-white text-slate-800" />
                    <button onClick={() => setComboItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 p-1 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                  </div>
                );
              })}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-10 text-[10px] font-black uppercase border-slate-200 text-[#312ECB]"><Plus size={14} className="mr-1" /> Add Service</Button></DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] max-h-[200px] overflow-y-auto">
                {dynamicServices?.filter(s => !comboItems.find(it => it.serviceId === s.id)).map(s => <DropdownMenuItem key={s.id} onClick={() => setComboItems([...comboItems, { serviceId: s.id, quantity: s.minQuantity }])} className="text-[10px] font-black uppercase">{s.name}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Instagram Target Link</label>
              <Input placeholder="Paste Post/Profile Link" value={comboLink} onChange={(e) => setComboLink(e.target.value)} className="h-11 text-slate-800" />
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 text-center">
              <p className="text-[13px] font-black text-emerald-600 uppercase">Combo Price: ₹{comboTotal.discounted.toFixed(2)}</p>
            </div>
            <Button onClick={() => onComboSubmit?.(comboItems, comboLink)} disabled={!comboLink || comboItems.length === 0} className="w-full h-14 bg-[#312ECB] font-black uppercase tracking-widest shadow-lg">Confirm Combo Order</Button>
          </div>
        ) : isBulkLinkCard ? (
          <div className="space-y-4 min-w-[260px]">
            <span className="text-[12px] font-black uppercase text-slate-800">Bulk Link Add</span>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Enter Link" value={currentBulkLink} onChange={(e) => setCurrentBulkLink(e.target.value)} className="h-11 text-slate-800" />
                <Button onClick={() => { if(currentBulkLink) { setBulkLinks([...bulkLinks, currentBulkLink]); setCurrentBulkLink(""); } }} className="h-11 bg-blue-600"><Plus size={18}/></Button>
              </div>
              <div className="max-h-[120px] overflow-y-auto space-y-1">
                {bulkLinks.map((l, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl text-[10px] text-slate-600">
                    <span className="truncate max-w-[180px]">{l}</span>
                    <button onClick={() => setBulkLinks(bulkLinks.filter((_, idx) => idx !== i))} className="text-red-400"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={() => onBulkLinksSubmit?.(bulkLinks)} disabled={bulkLinks.length === 0} className="w-full h-12 bg-[#312ECB] font-black uppercase">Next: Pick Service</Button>
          </div>
        ) : isWalletCard ? (
          <div className="space-y-4 min-w-[240px]">
             <div className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-3xl border border-blue-100">
                <Wallet className="text-[#312ECB]" size={32} />
                <p className="text-[14px] font-black text-slate-800 uppercase">Wallet Payment</p>
                <p className="text-[20px] font-black text-[#312ECB]">₹{paymentPrice?.toFixed(2)}</p>
             </div>
             <Button onClick={() => onWalletSubmit?.(link)} className="w-full h-12 bg-[#312ECB] font-black uppercase">Confirm Payment</Button>
          </div>
        ) : (
          <p className="text-[14px] font-bold whitespace-pre-wrap text-slate-800 dark:text-slate-100">{text}</p>
        )}
        {options && !isPaymentCard && !isSuccessCard && !isComboCard && !isBulkLinkCard && !isWalletCard && (
          <div className="mt-4 space-y-2">
            {options.map((opt, i) => (
              <button key={i} onClick={() => onOptionClick?.(opt)} className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl flex items-center justify-between group hover:border-[#312ECB]/30 transition-all shadow-sm">
                <span className="text-[10px] font-black uppercase text-[#312ECB] dark:text-blue-400">{opt}</span>
                <SendHorizonal size={14} className="text-[#312ECB] dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
