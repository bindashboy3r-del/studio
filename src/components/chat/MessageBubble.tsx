
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
  // Calculate original price if discount exists
  const originalPrice = discountPct > 0 ? price / (1 - (Number(discountPct) || 0) / 100) : price;

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
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "QR Saved", description: "Payment QR code downloaded." });
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
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[90%] px-5 py-4 relative shadow-md transition-all", isUser ? "bubble-user rounded-[24px] rounded-tr-none" : "bubble-bot rounded-[24px] rounded-tl-none")}>
        {isSuccessCard && successDetails ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={24} className="text-[#25D366]" />
              <h3 className="text-[15px] font-black uppercase text-slate-800 dark:text-white">Order Submitted</h3>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl text-[12px] font-bold space-y-2 text-slate-800 dark:text-slate-100 border dark:border-slate-700">
              <p className="flex justify-between gap-4"><span>Order ID:</span><span className="text-[#312ECB] font-black">#{successDetails.orderId}</span></p>
              <p className="flex justify-between gap-4"><span>Service:</span><span className="text-right truncate max-w-[140px]">{successDetails.service}</span></p>
              <p className="flex justify-between gap-4"><span>Amount:</span><span className="text-emerald-600 font-black">₹{successDetails.price.toFixed(2)}</span></p>
              <p className="flex justify-between gap-4"><span>Target:</span><span className="truncate max-w-[140px] opacity-60">{successDetails.link}</span></p>
              <p className="flex justify-between gap-4"><span>UTR:</span><span className="opacity-60">{successDetails.utrId}</span></p>
            </div>
            <Button onClick={() => onOptionClick?.("Main Menu")} className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] uppercase font-black tracking-widest rounded-2xl">Return to Menu</Button>
          </div>
        ) : isPaymentCard ? (
          <div className="space-y-4 min-w-[260px]">
            <div className="text-center space-y-1">
              <p className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">Step 1: Scan & Pay</p>
              <div className="flex flex-col items-center justify-center">
                {discountPct > 0 && (
                  <span className="text-[12px] font-bold text-slate-400 line-through">Real Price: ₹{originalPrice.toFixed(2)}</span>
                )}
                <h3 className="text-[22px] font-black text-slate-800 dark:text-white leading-tight">Pay ₹{price.toFixed(2)}</h3>
                {discountPct > 0 && (
                  <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase mt-1">{discountPct}% Discount Applied</Badge>
                )}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] flex flex-col items-center gap-4 border border-slate-100 dark:border-slate-800 shadow-inner">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Scan or Save QR Code</p>
              <div className="bg-white p-3 rounded-3xl shadow-xl border">
                <img src={qrUrl} alt="UPI QR" className="w-44 h-44" />
              </div>
              <div className="flex w-full gap-2">
                <Button 
                  onClick={() => { navigator.clipboard.writeText(upiId); toast({ title: "Copied!" }); }} 
                  variant="outline" 
                  className="flex-1 h-12 text-[10px] uppercase font-black border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl gap-2"
                >
                  <Copy size={14} /> Copy UPI
                </Button>
                <Button 
                  onClick={handleDownloadQR} 
                  disabled={isDownloading}
                  variant="outline" 
                  className="flex-1 h-12 text-[10px] uppercase font-black border-slate-200 dark:border-slate-700 text-[#312ECB] rounded-2xl gap-2"
                >
                  <Download size={14} /> Download
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Step 2: Profile/Post Link</label>
                  <Input 
                    placeholder="Paste Instagram Link Here" 
                    value={link} 
                    onChange={(e) => setLink(e.target.value)} 
                    className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border-none shadow-inner font-bold" 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-red-500 ml-1 tracking-widest leading-tight">
                    Shi utr dalo agar utr se payment verify nhi hoga
                  </label>
                  <Input 
                    placeholder="Enter 12-Digit UTR ID" 
                    value={utr} 
                    maxLength={12} 
                    onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))} 
                    className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border-none shadow-inner font-black tracking-widest" 
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-800/30 flex items-start gap-3">
                <AlertCircle size={14} className="text-[#312ECB] mt-0.5" />
                <p className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase leading-relaxed">
                  Verification usually takes 5-30 mins. Do not refresh after clicking submit.
                </p>
              </div>

              <Button 
                onClick={() => onPaymentSubmit?.(link, utr)} 
                disabled={!link || utr.length !== 12} 
                className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95"
              >
                Submit Payment info
              </Button>
            </div>
          </div>
        ) : isComboCard ? (
          <div className="space-y-4 min-w-[280px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-black uppercase text-slate-800 dark:text-white tracking-widest">Combo Builder</span>
              {discountPct > 0 && <Badge className="bg-emerald-500 text-white font-black">{discountPct}% OFF</Badge>}
            </div>
            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {comboItems.map((item, idx) => {
                const s = dynamicServices?.find(sv => sv.id === item.serviceId);
                return (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl flex flex-col gap-2 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase truncate flex-1 text-slate-800 dark:text-slate-100">{s?.name || 'Loading...'}</span>
                      <button onClick={() => setComboItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14}/></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input type="number" value={item.quantity} onChange={(e) => setComboItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 0 } : it))} className="h-9 w-full text-[10px] bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-none shadow-inner" placeholder={`Min ${s?.minQuantity}`} />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">Min: {s?.minQuantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="w-full h-11 text-[10px] font-black uppercase border-slate-200 dark:border-slate-800 text-[#312ECB] rounded-2xl"><Plus size={14} className="mr-1" /> Add Service</Button></DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] max-h-[200px] overflow-y-auto rounded-2xl p-2 shadow-2xl bg-white dark:bg-slate-900">
                {dynamicServices?.filter(s => !comboItems.find(it => it.serviceId === s.id)).map(s => <DropdownMenuItem key={s.id} onClick={() => setComboItems([...comboItems, { serviceId: s.id, quantity: s.minQuantity }])} className="text-[10px] font-black uppercase p-3 rounded-xl cursor-pointer">{s.name}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Instagram Link</label>
              <Input placeholder="Post or Profile Link" value={comboLink} onChange={(e) => setComboLink(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-slate-800 dark:text-white shadow-inner font-bold" />
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900 text-center">
              <div className="flex flex-col items-center">
                {Number(discountPct) > 0 && (
                  <span className="text-[10px] font-bold text-slate-400 line-through uppercase">Real Price: ₹{comboTotal.raw.toFixed(2)}</span>
                )}
                <p className="text-[14px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Combo Total: ₹{comboTotal.discounted.toFixed(2)}</p>
              </div>
            </div>
            <Button onClick={() => onComboSubmit?.(comboItems, comboLink)} disabled={!comboLink || comboItems.length === 0} className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] font-black uppercase tracking-widest rounded-2xl shadow-xl">Confirm Bundle Order</Button>
          </div>
        ) : isBulkLinkCard ? (
          <div className="space-y-4 min-w-[280px]">
            <span className="text-[12px] font-black uppercase text-slate-800 dark:text-white tracking-widest">Bulk Link Manager</span>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Add Instagram Link..." value={currentBulkLink} onChange={(e) => setCurrentBulkLink(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-slate-800 dark:text-white shadow-inner flex-1 font-bold" />
                <Button onClick={() => { if(currentBulkLink) { setBulkLinks([...bulkLinks, currentBulkLink]); setCurrentBulkLink(""); } }} className="h-12 w-12 bg-[#312ECB] rounded-2xl shadow-lg"><Plus size={20}/></Button>
              </div>
              <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                {bulkLinks.map((l, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                    <span className="truncate max-w-[180px]">{l}</span>
                    <button onClick={() => setBulkLinks(bulkLinks.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={() => onBulkLinksSubmit?.(bulkLinks)} disabled={bulkLinks.length === 0} className="w-full h-14 bg-[#312ECB] font-black uppercase tracking-widest rounded-2xl shadow-xl">Select Service ({bulkLinks.length} Links)</Button>
          </div>
        ) : isWalletCard ? (
          <div className="space-y-4 min-w-[240px]">
             <div className="flex flex-col items-center gap-3 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[2.5rem] border border-blue-100 dark:border-blue-900">
                <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
                  <Wallet className="text-[#312ECB]" size={28} />
                </div>
                <div className="text-center">
                  <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Wallet Payment</p>
                  <div className="flex flex-col items-center">
                    {discountPct > 0 && (
                      <span className="text-[12px] font-bold text-slate-400 line-through mt-1">Real Price: ₹{originalPrice.toFixed(2)}</span>
                    )}
                    <p className="text-[26px] font-black text-[#312ECB] leading-none">₹{price.toFixed(2)}</p>
                    {discountPct > 0 && (
                      <Badge className="bg-emerald-500 text-white font-black mt-2 text-[9px] uppercase">{discountPct}% Discount Applied</Badge>
                    )}
                  </div>
                </div>
             </div>
             <Button onClick={() => onWalletSubmit?.(link)} className="w-full h-14 bg-[#312ECB] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">Confirm & Deduct</Button>
          </div>
        ) : (
          <p className="text-[14px] font-bold whitespace-pre-wrap text-slate-800 dark:text-slate-100 leading-relaxed">{text}</p>
        )}
        {options && !isPaymentCard && !isSuccessCard && !isComboCard && !isBulkLinkCard && !isWalletCard && (
          <div className="mt-5 space-y-2.5">
            {options.map((opt, i) => (
              <button key={i} onClick={() => onOptionClick?.(opt)} className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-[#312ECB]/30 transition-all shadow-sm active:scale-95">
                <span className="text-[10px] font-black uppercase text-[#312ECB] dark:text-blue-400 tracking-widest">{opt}</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-400/10 flex items-center justify-center text-[#312ECB] dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                  <SendHorizonal size={14} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={cn("text-[9px] mt-1.5 text-slate-400 font-black px-2 uppercase tracking-tighter", isUser ? "text-right" : "text-left")}>
        {displayTime}
      </div>
    </div>
  );
}
