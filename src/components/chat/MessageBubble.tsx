
"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  SendHorizonal, 
  Wallet,
  Copy,
  Download,
  Percent,
  MessageCircle,
  Link as LinkIcon,
  Layers,
  Trash2,
  Plus,
  Rocket,
  PlusCircle,
  CheckCircle2
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SMMService } from "@/app/lib/constants";
import { useUser } from "@/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  isComboConfigCard?: boolean;
  isBulkLinkCard?: boolean;
  discountPct?: number;
  serviceName?: string;
  quantity?: number;
  isBulk?: boolean;
  dynamicServices?: SMMService[] | null;
  prefilledLinks?: string;
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
  isComboConfigCard,
  isBulkLinkCard,
  discountPct = 0,
  serviceName,
  quantity,
  isBulk,
  dynamicServices,
  prefilledLinks = ""
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  const { toast } = useToast();
  
  const [links, setLinks] = useState(prefilledLinks);
  const [utr, setUtr] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Bulk Link State
  const [bulkLinks, setBulkLinks] = useState<string[]>([]);
  const [currentBulkLink, setCurrentBulkLink] = useState("");

  // Combo Config State
  const [comboItems, setComboItems] = useState<{service: SMMService, qty: string}[]>([]);

  useEffect(() => { setMounted(true); }, []);

  // Initialize Combo Items with Likes, Views, Comments if they exist
  useEffect(() => {
    if (isComboConfigCard && dynamicServices && comboItems.length === 0) {
      const likes = dynamicServices.find(s => s.name.toLowerCase().includes('like'));
      const views = dynamicServices.find(s => s.name.toLowerCase().includes('view'));
      const comments = dynamicServices.find(s => s.name.toLowerCase().includes('comment'));
      
      const initial = [];
      if (likes) initial.push({ service: likes, qty: "" });
      if (views) initial.push({ service: views, qty: "" });
      if (comments) initial.push({ service: comments, qty: "" });
      
      if (initial.length === 0) {
        setComboItems(dynamicServices.slice(0, 3).map(s => ({ service: s, qty: "" })));
      } else {
        setComboItems(initial);
      }
    }
  }, [isComboConfigCard, dynamicServices]);

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

  const handleWhatsAppConfirmation = () => {
    const adminNumber = "919116399517";
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const displayId = `ORD-${randomId}`;
    
    const message = `🚀 *NEW ORDER PLACED!*\n\n🆔 *Order ID:* #${displayId}\n📊 *Service:* ${serviceName || "Instagram Service"}\n🔢 *Quantity:* ${quantity || "N/A"}\n💰 *Price:* ₹${price.toFixed(2)}\n🔗 *Links:* ${links || "N/A"}\n💳 *Payment:* UPI (${utr || "N/A"})\n\nPlease process my order ASAP!`;
    
    window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const addBulkLink = () => {
    if (!currentBulkLink.trim()) return;
    setBulkLinks([...bulkLinks, currentBulkLink.trim()]);
    setCurrentBulkLink("");
  };

  const removeBulkLink = (index: number) => {
    setBulkLinks(bulkLinks.filter((_, i) => i !== index));
  };

  // Combo Logic
  const comboSubtotal = useMemo(() => {
    return comboItems.reduce((acc, item) => {
      const q = parseInt(item.qty) || 0;
      return acc + (q / 1000) * (item.service.pricePer1000 || 0);
    }, 0);
  }, [comboItems]);

  const comboTotal = comboSubtotal * (1 - (discountPct / 100));

  const addServiceToCombo = (s: SMMService) => {
    if (comboItems.find(i => i.service.id === s.id)) return;
    setComboItems([...comboItems, { service: s, qty: "" }]);
  };

  const removeServiceFromCombo = (id: string) => {
    setComboItems(comboItems.filter(i => i.service.id !== id));
  };

  const updateComboQty = (id: string, val: string) => {
    setComboItems(comboItems.map(i => i.service.id === id ? { ...i, qty: val.replace(/[^0-9]/g, '') } : i));
  };

  if (!mounted) return null;

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[92%] px-4 py-3 relative border border-white/5", 
        isUser ? "bubble-user" : "bubble-bot"
      )}>
        
        {isBulkLinkCard ? (
          <div className="space-y-5 min-w-[280px] py-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB]">
                <Layers size={16} />
              </div>
              <div>
                <h3 className="text-[13px] font-black uppercase tracking-tight">Bulk Mode</h3>
                <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Add Multiple Links</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Paste Instagram link here"
                  value={currentBulkLink}
                  onChange={(e) => setCurrentBulkLink(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBulkLink()}
                  className="h-11 bg-slate-950 border-none rounded-xl text-xs font-bold text-white shadow-3d-pressed flex-1"
                />
                <Button onClick={addBulkLink} size="icon" className="h-11 w-11 rounded-xl bg-[#312ECB] shadow-3d active:shadow-3d-pressed shrink-0">
                  <Plus size={20} />
                </Button>
              </div>

              {bulkLinks.length > 0 && (
                <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                  {bulkLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-white/5 group">
                      <span className="text-[9px] font-bold text-slate-400 truncate max-w-[180px]">{link}</span>
                      <button onClick={() => removeBulkLink(idx)} className="text-red-500/50 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button 
              onClick={() => {
                if (bulkLinks.length === 0) {
                  toast({ variant: "destructive", title: "Error", description: "Pehle kam se kam ek link add karein." });
                  return;
                }
                onOptionClick?.(`SUBMIT_BULK_LINKS:${bulkLinks.join('|')}`);
              }}
              disabled={bulkLinks.length === 0}
              className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} /> SUBMIT {bulkLinks.length} LINKS
            </Button>
          </div>
        ) : isComboConfigCard ? (
          <div className="space-y-5 min-w-[280px] py-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB]">
                <Rocket size={16} />
              </div>
              <div>
                <h3 className="text-[13px] font-black uppercase tracking-tight">Configure Combo</h3>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black text-[7px] px-2 mt-0.5">
                  % {discountPct}% DISCOUNT ACTIVE
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {comboItems.map((item) => (
                <div key={item.service.id} className="bg-slate-950 p-4 rounded-[1.2rem] border border-white/5 shadow-3d-pressed relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase text-[#312ECB] tracking-widest">{item.service.name}</span>
                    <button onClick={() => removeServiceFromCombo(item.service.id)} className="text-red-500/50 hover:text-red-500 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <Input 
                    placeholder={`Qty (Min ${item.service.minQuantity})`}
                    value={item.qty}
                    onChange={(e) => updateComboQty(item.service.id, e.target.value)}
                    className="h-9 bg-slate-900 border-none rounded-xl text-xs font-bold text-white shadow-inner"
                  />
                </div>
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-10 border-dashed border-white/10 bg-transparent text-slate-500 font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-white/5">
                    <Plus size={14} className="mr-2" /> Add Service
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-white/10 rounded-xl max-h-[200px] overflow-y-auto custom-scrollbar">
                  {dynamicServices?.filter(s => !comboItems.find(i => i.service.id === s.id)).map(s => (
                    <DropdownMenuItem key={s.id} onClick={() => addServiceToCombo(s)} className="text-[9px] font-black uppercase text-slate-300 focus:bg-[#312ECB] focus:text-white">
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-500 ml-1 tracking-widest">Target Link</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                  <Input 
                    placeholder="Instagram link for combo" 
                    value={links}
                    onChange={(e) => setLinks(e.target.value)}
                    className="h-10 bg-slate-950 border-none rounded-xl pl-9 text-xs font-bold text-white shadow-3d-pressed"
                  />
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-2xl space-y-1.5 border border-white/5 shadow-inner">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                  <span>Subtotal:</span>
                  <span>₹{comboSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[12px] font-black text-emerald-400 uppercase">
                  <span>Combo Total ({discountPct}% OFF):</span>
                  <span>₹{comboTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button 
                onClick={() => {
                  const valid = comboItems.every(i => parseInt(i.qty) >= i.service.minQuantity);
                  if (!valid || !links) {
                    toast({ variant: "destructive", title: "Wait!", description: "Link aur sahi quantity dalna jaruri hai." });
                    return;
                  }
                  const itemsStr = comboItems.map(i => `${i.service.id},${i.qty}`).join('|');
                  onOptionClick?.(`SUBMIT_COMBO_CONFIG:${itemsStr}:${links}:${comboTotal}`);
                }}
                className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed"
              >
                Proceed to Payment
              </Button>
            </div>
          </div>
        ) : isPaymentCard ? (
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
                  <label className="text-[8px] font-black uppercase text-slate-500 ml-1 tracking-widest">{isBulk ? "All Links Saved" : "Post/Profile Link"}</label>
                  {isBulk ? (
                    <Textarea 
                      placeholder="https://link1.com&#10;https://link2.com" 
                      value={links} 
                      readOnly
                      className="min-h-[80px] rounded-xl bg-slate-900 border-none shadow-3d-pressed font-bold text-[10px] text-slate-400 opacity-70" 
                    />
                  ) : (
                    <Input placeholder="Enter link here" value={links} onChange={(e) => setLinks(e.target.value)} className="h-10 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-bold text-xs" />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-red-500 ml-1 leading-none animate-pulse">Shi utr dalo varna payment verify nhi hoga</label>
                  <Input placeholder="Enter 12-Digit UTR ID" value={utr} maxLength={12} onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))} className="h-10 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-black tracking-widest text-xs" />
                </div>
              </div>
              
              <div className="flex flex-col gap-2 pt-1">
                <Button onClick={() => onOptionClick?.(`SUBMIT_PAYMENT:${links}:${utr}`)} disabled={!links || utr.length !== 12} className="w-full h-12 bg-[#312ECB] font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10">
                  SUBMIT PAYMENT
                </Button>
                
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[7px] font-black uppercase text-red-500 tracking-tighter">payment karne ke bad admin ko bheje</p>
                  <Button 
                    onClick={handleWhatsAppConfirmation}
                    className="w-full h-10 bg-[#25D366] hover:bg-[#1EBE57] text-white font-black text-[9px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10 gap-2"
                  >
                    <MessageCircle size={14} /> Send to WhatsApp
                  </Button>
                </div>
              </div>
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
             
             <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-500 ml-1 tracking-widest">{isBulk ? "Bulk Links Confirmed" : "Post/Profile Link"}</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                  {isBulk ? (
                    <Textarea 
                      value={links} 
                      readOnly
                      className="min-h-[80px] rounded-xl bg-slate-900 border-none shadow-3d-pressed font-bold text-[10px] text-slate-400 opacity-70 pl-8 pt-2.5" 
                    />
                  ) : (
                    <Input 
                      placeholder="Enter link here" 
                      value={links} 
                      onChange={(e) => setLinks(e.target.value)} 
                      className="h-10 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-bold text-xs pl-8" 
                    />
                  )}
                </div>
             </div>

             <Button 
               onClick={() => onOptionClick?.(`CONFIRM_WALLET:${links}`)} 
               disabled={!links}
               className="w-full h-12 bg-[#312ECB] font-black text-[10px] uppercase rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10"
             >
               CONFIRM ORDER
             </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[12px] font-bold whitespace-pre-wrap leading-relaxed tracking-wide">{text}</p>
          </div>
        )}

        {options && !isPaymentCard && !isWalletCard && !isComboConfigCard && !isBulkLinkCard && (
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
