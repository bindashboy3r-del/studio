
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
  ChevronDown,
  AlertCircle
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
  rawPrice?: number;
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
  rawPrice,
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
  const [isDownloading, setIsDownloading] = useState(false);
  
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
  const finalRawPrice = rawPrice || (discountPct > 0 ? price / (1 - (Number(discountPct) || 0) / 100) : price);

  const upiId = "smmxpressbot@slc";
  const upiLink = `upi://pay?pa=${upiId}&pn=SocialBoost&am=${price.toFixed(2)}&cu=INR`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=400&margin=1&format=png`;

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
      window.URL.revokeObjectURL(blob ? url : "");
      document.body.removeChild(a);
      toast({ title: "QR Saved" });
    } catch (e) {
      window.open(qrUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const comboTotal = useMemo(() => {
    const raw = comboItems.reduce((sum, item) => {
      const s = dynamicServices?.find(sv => sv.id === item.serviceId);
      return sum + (item.quantity / 1000) * (s?.pricePer1000 || 0);
    }, 0);
    return { raw, discounted: raw * (1 - (Number(discountPct) || 0) / 100) };
  }, [comboItems, dynamicServices, discountPct]);

  const [displayTime, setDisplayTime] = useState("");
  useEffect(() => {
    if (mounted) setDisplayTime(format(timestamp, 'HH:mm'));
  }, [mounted, timestamp]);

  if (!mounted) return null;

  return (
    <div className={cn("flex w-full mb-2", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[94%] px-3 py-2 relative shadow-sm", isUser ? "bubble-user rounded-[16px] rounded-tr-none" : "bubble-bot rounded-[16px] rounded-tl-none")}>
        {isSuccessCard && successDetails ? (
          <div className="space-y-2 min-w-[180px]">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-[#25D366]" />
              <h3 className="text-[10px] font-black uppercase text-slate-800 dark:text-white">Success</h3>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-[9px] font-bold space-y-1 text-slate-800 dark:text-slate-100 border dark:border-slate-700">
              <p className="flex justify-between gap-4"><span>ID:</span><span className="text-[#312ECB] font-black">#{successDetails.orderId}</span></p>
              <p className="flex justify-between gap-4"><span>Total:</span><span className="text-emerald-600 font-black">₹{successDetails.price.toFixed(2)}</span></p>
            </div>
            <Button onClick={() => onOptionClick?.("Main Menu")} className="w-full h-8 bg-[#312ECB] text-[8px] uppercase font-black rounded-lg">Back to Menu</Button>
          </div>
        ) : isPaymentCard ? (
          <div className="space-y-2.5 min-w-[200px]">
            <div className="text-center">
              <p className="text-[7px] font-black text-[#312ECB] uppercase tracking-widest">Scan or Save QR Code</p>
              <div className="flex items-center justify-center gap-2 mt-0.5">
                {discountPct > 0 && (
                  <span className="text-[9px] font-bold text-slate-400 line-through">₹{finalRawPrice.toFixed(0)}</span>
                )}
                <h3 className="text-[14px] font-black text-slate-800 dark:text-white">Pay ₹{price.toFixed(2)}</h3>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg flex flex-col items-center gap-2 border border-slate-100 dark:border-slate-800">
              <div className="bg-white p-1 rounded-lg shadow-sm">
                <img src={qrUrl} alt="UPI QR" className="w-24 h-24" />
              </div>
              <div className="flex w-full gap-1.5">
                <Button 
                  onClick={() => { navigator.clipboard.writeText(upiId); toast({ title: "Copied!" }); }} 
                  variant="outline" 
                  className="flex-1 h-7 text-[7px] uppercase font-black rounded-md px-0"
                >
                  <Copy size={8} /> Copy UPI
                </Button>
                <Button 
                  onClick={handleDownloadQR} 
                  disabled={isDownloading}
                  variant="outline" 
                  className="flex-1 h-7 text-[7px] uppercase font-black text-[#312ECB] rounded-md px-0"
                >
                  <Download size={8} /> Save QR
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1.5">
                <div className="space-y-0.5">
                  <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Instagram Link</label>
                  <Input 
                    placeholder="Profile/Post Link" 
                    value={link} 
                    onChange={(e) => setLink(e.target.value)} 
                    className="h-8 rounded-md bg-slate-50 dark:bg-slate-800 text-[10px] border-none shadow-inner font-bold" 
                  />
                </div>
                
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black uppercase text-red-500 ml-1 tracking-tight leading-none">
                    Shi utr dalo varna payment verify nhi hoga
                  </label>
                  <Input 
                    placeholder="Enter 12-Digit UTR" 
                    value={utr} 
                    maxLength={12} 
                    onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))} 
                    className="h-8 rounded-md bg-slate-50 dark:bg-slate-800 text-[10px] border-none shadow-inner font-black tracking-widest" 
                  />
                </div>
              </div>

              <Button 
                onClick={() => onPaymentSubmit?.(link, utr)} 
                disabled={!link || utr.length !== 12} 
                className="w-full h-9 bg-[#312ECB] font-black text-[8px] uppercase tracking-widest rounded-md shadow-md"
              >
                Submit Payment Info
              </Button>
            </div>
          </div>
        ) : isComboCard ? (
          <div className="space-y-2 min-w-[210px]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase text-slate-800 dark:text-white tracking-widest">Combo Hub</span>
              {discountPct > 0 && <Badge className="bg-emerald-500 text-white font-black text-[6px] h-3.5 px-1">{discountPct}% OFF</Badge>}
            </div>
            <div className="max-h-[120px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {comboItems.map((item, idx) => {
                const s = dynamicServices?.find(sv => sv.id === item.serviceId);
                return (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg flex flex-col gap-1 border dark:border-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[7px] font-black uppercase truncate flex-1">{s?.name || '...'}</span>
                      <button onClick={() => setComboItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 p-0.5"><Trash2 size={8}/></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={item.quantity} onChange={(e) => setComboItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 0 } : it))} className="h-6 w-full text-[8px] bg-white dark:bg-slate-900 border-none px-1.5" />
                      <span className="text-[6px] font-bold text-slate-400 whitespace-nowrap">Min: {s?.minQuantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-7 text-[7px] font-black uppercase border-slate-200 text-[#312ECB] rounded-lg"><Plus size={8} /> Add Service</Button></DropdownMenuTrigger>
              <DropdownMenuContent className="w-[140px] max-h-[120px] overflow-y-auto rounded-lg p-1">
                {dynamicServices?.filter(s => !comboItems.find(it => it.serviceId === s.id)).map(s => <DropdownMenuItem key={s.id} onClick={() => setComboItems([...comboItems, { serviceId: s.id, quantity: s.minQuantity }])} className="text-[7px] font-black uppercase p-1.5">{s.name}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="space-y-0.5">
              <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Target Link</label>
              <Input placeholder="Profile/Post Link" value={comboLink} onChange={(e) => setComboLink(e.target.value)} className="h-8 bg-slate-50 dark:bg-slate-800 text-[10px] rounded-md border-none shadow-inner" />
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950 p-1.5 rounded-lg text-center">
              {Number(discountPct) > 0 && <span className="text-[7px] font-bold text-slate-400 line-through block">Real: ₹{comboTotal.raw.toFixed(0)}</span>}
              <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">Total: ₹{comboTotal.discounted.toFixed(2)}</p>
            </div>
            <Button onClick={() => onComboSubmit?.(comboItems, comboLink)} disabled={!comboLink || comboItems.length === 0} className="w-full h-9 bg-[#312ECB] font-black text-[8px] uppercase rounded-md">Confirm Bundle</Button>
          </div>
        ) : isBulkLinkCard ? (
          <div className="space-y-2 min-w-[200px]">
            <span className="text-[9px] font-black uppercase tracking-widest">Bulk Link Manager</span>
            <div className="space-y-1">
              <div className="flex gap-1.5">
                <Input placeholder="Add Link..." value={currentBulkLink} onChange={(e) => setCurrentBulkLink(e.target.value)} className="h-8 bg-slate-50 dark:bg-slate-800 rounded-md border-none flex-1 text-[10px]" />
                <Button onClick={() => { if(currentBulkLink) { setBulkLinks([...bulkLinks, currentBulkLink]); setCurrentBulkLink(""); } }} className="h-8 w-8 bg-[#312ECB] rounded-md"><Plus size={14}/></Button>
              </div>
              <div className="max-h-[80px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {bulkLinks.map((l, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-1 rounded-lg text-[7px] font-bold">
                    <span className="truncate max-w-[120px]">{l}</span>
                    <button onClick={() => setBulkLinks(bulkLinks.filter((_, idx) => idx !== i))} className="text-red-400"><Trash2 size={8}/></button>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={() => onBulkLinksSubmit?.(bulkLinks)} disabled={bulkLinks.length === 0} className="w-full h-9 bg-[#312ECB] text-[8px] font-black uppercase rounded-md">Continue ({bulkLinks.length})</Button>
          </div>
        ) : isWalletCard ? (
          <div className="space-y-2.5 min-w-[180px]">
             <div className="flex flex-col items-center gap-1.5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shadow-sm">
                  <Wallet className="text-[#312ECB]" size={16} />
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase">Wallet Payment</p>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    {discountPct > 0 && (
                      <span className="text-[9px] font-bold text-slate-400 line-through">₹{finalRawPrice.toFixed(0)}</span>
                    )}
                    <p className="text-[16px] font-black text-[#312ECB]">₹{price.toFixed(2)}</p>
                  </div>
                </div>
             </div>
             <Button onClick={() => onWalletSubmit?.(link)} className="w-full h-9 bg-[#312ECB] font-black text-[8px] uppercase rounded-md shadow-md">Confirm Payment</Button>
          </div>
        ) : (
          <p className="text-[11px] font-bold whitespace-pre-wrap text-slate-800 dark:text-slate-100 leading-relaxed">{text}</p>
        )}
        {options && !isPaymentCard && !isSuccessCard && !isComboCard && !isBulkLinkCard && !isWalletCard && (
          <div className="mt-3 space-y-1">
            {options.map((opt, i) => (
              <button key={i} onClick={() => onOptionClick?.(opt)} className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg flex items-center justify-between group shadow-sm active:scale-[0.98]">
                <span className="text-[7px] font-black uppercase text-[#312ECB] dark:text-blue-400 tracking-widest">{opt}</span>
                <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-400/10 flex items-center justify-center text-[#312ECB] dark:text-blue-400">
                  <SendHorizonal size={8} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={cn("text-[6px] mt-0.5 text-slate-400 font-black px-1 uppercase tracking-tighter", isUser ? "text-right" : "text-left")}>
        {displayTime}
      </div>
    </div>
  );
}
