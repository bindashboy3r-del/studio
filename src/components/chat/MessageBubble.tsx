
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
  CheckCircle2,
  Package,
  Info,
  ChevronRight,
  TrendingDown,
  Loader2,
  QrCode,
  History
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SMMService } from "@/app/lib/constants";
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
  isSuccessCard?: boolean;
  showWhatsAppSuccess?: boolean;
  utrId?: string;
  orderId?: string;
  discountPct?: number;
  serviceName?: string;
  quantity?: number;
  isBulk?: boolean;
  dynamicServices?: SMMService[] | null;
  prefilledLinks?: string;
  walletBalance?: number;
  isCombo?: boolean;
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
  isSuccessCard,
  showWhatsAppSuccess,
  utrId: propUtr,
  orderId,
  discountPct = 0,
  serviceName,
  quantity,
  isBulk,
  dynamicServices,
  prefilledLinks = "",
  walletBalance = 0,
  isCombo
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
  const savings = finalRawPrice - price;
  const linkCount = prefilledLinks ? prefilledLinks.split('\n').filter(l => l.trim()).length : (isBulk ? bulkLinks.length : 1);

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
      toast({ title: "QR Saved!" });
    } catch (e) { 
      window.open(qrUrl, '_blank'); 
    } finally { 
      setIsDownloading(false); 
    }
  };

  const handleWhatsAppConfirmation = () => {
    const adminNumber = "919116399517";
    const finalLinks = links || prefilledLinks;
    const message = `🚀 *NEW ORDER PLACED!*\n\n🆔 *Order ID:* #${orderId || "N/A"}\n📊 *Service:* ${serviceName || "Service"}\n🔢 *Quantity:* ${quantity || "N/A"}\n💰 *Amount:* ₹${price.toFixed(2)}\n🔗 *Target Link:* ${finalLinks || "N/A"}\n💳 *UTR ID:* ${propUtr || utr || "N/A"}\n\nPlease process my order ASAP!`;
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

  const OrderSummaryBreakdown = () => (
    <div className="bg-slate-950/90 backdrop-blur-xl rounded-[1.8rem] p-5 border border-white/10 shadow-3d-pressed space-y-4">
      <div className="flex items-center gap-3 border-b border-white/5 pb-3">
        <div className="w-10 h-10 rounded-xl bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB]">
          <Package size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black uppercase text-white truncate tracking-tight">{serviceName || 'Package'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Qty: {quantity || 'N/A'}</span>
            {isBulk && (
              <Badge className="bg-purple-500/10 text-purple-400 border-none font-black text-[8px] px-2 h-4">
                {linkCount} LINKS
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Real Price</span>
          <span className="text-[11px] font-bold text-slate-400 line-through">₹{finalRawPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-1.5">
            <TrendingDown size={14} className="text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Saved ({discountPct}%)</span>
          </div>
          <span className="text-[11px] font-black text-emerald-400">- ₹{savings.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pt-2.5 border-t border-white/10 px-1">
          <span className="text-[11px] font-black text-white uppercase tracking-widest">Final Amount</span>
          <span className="text-[18px] font-black text-[#312ECB] italic">₹{price.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-emerald-500/5 rounded-2xl p-3.5 flex items-center justify-between border border-emerald-500/10 shadow-inner mt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Wallet size={14} />
          </div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Wallet Balance</span>
        </div>
        <div className="text-right">
          <p className={cn(
            "text-[12px] font-black tracking-tight",
            walletBalance >= price ? "text-emerald-400" : "text-red-400"
          )}>
            ₹{walletBalance.toFixed(2)}
          </p>
          {walletBalance < price && <p className="text-[7px] font-black uppercase text-red-500 mt-0.5 animate-pulse">Low Balance</p>}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;

  const hasPriceData = paymentPrice !== undefined && rawPrice !== undefined;

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
                <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Add Multiple Target Links</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Enter target link here"
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
                    placeholder="Enter target link here" 
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
                  onOptionClick?.(`SUBMIT_COMBO_CONFIG###${itemsStr}###${links}###${comboTotal}`);
                }}
                className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed"
              >
                Proceed to Payment
              </Button>
            </div>
          </div>
        ) : isPaymentCard ? (
          <div className="space-y-5 min-w-[260px] py-1">
            <div className="bg-slate-950 p-4 rounded-[1.8rem] flex flex-col items-center gap-4 shadow-3d-pressed border border-white/5">
              <div className="bg-white p-2.5 rounded-2xl shadow-3d border border-white/20">
                <img src={qrUrl} alt="UPI QR" className="w-32 h-32" />
              </div>
              <div className="flex w-full gap-2.5 px-1">
                <Button onClick={() => { navigator.clipboard.writeText(upiId); toast({ title: "Copied!" }); }} variant="outline" className="flex-1 h-10 text-[9px] font-black uppercase rounded-xl border-white/10 shadow-3d active:shadow-3d-pressed text-slate-300">
                  <Copy size={12} className="mr-1.5" /> COPY UPI
                </Button>
                <Button onClick={handleDownloadQR} disabled={isDownloading} variant="outline" className="flex-1 h-10 text-[9px] font-black uppercase rounded-xl border-white/10 shadow-3d active:shadow-3d-pressed text-[#312ECB]">
                  {isDownloading ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Download size={12} className="mr-1.5" />} SAVE QR
                </Button>
              </div>
            </div>

            <div className="space-y-4 px-1">
              <div className="space-y-2">
                {!isCombo && (
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-500 ml-1 tracking-[0.2em]">Target Link</label>
                    {isBulk ? (
                      <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5 shadow-inner">
                         <p className="text-[9px] font-bold text-slate-400 leading-tight italic">{linkCount} target links submitted in this batch.</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                        <Input placeholder="Enter target link here" value={links} onChange={(e) => setLinks(e.target.value)} className="h-11 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-bold text-xs pl-9 text-white" />
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1 pt-1">
                  <label className="text-[9px] font-black uppercase text-red-500 ml-1 leading-none animate-pulse tracking-tighter">Shi utr dalo varna payment verify nhi hoga</label>
                  <Input placeholder="Enter 12-Digit UTR ID" value={utr} maxLength={12} onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))} className="h-11 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-black tracking-[0.3em] text-xs text-center text-white" />
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <Button onClick={() => onOptionClick?.(`SUBMIT_PAYMENT###${links || prefilledLinks}###${utr}`)} disabled={(!isCombo && !links) || utr.length !== 12} className="w-full h-14 bg-[#312ECB] font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10">
                  VERIFY & SUBMIT
                </Button>
              </div>
            </div>
          </div>
        ) : isWalletCard ? (
          <div className="space-y-5 min-w-[260px] py-1">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-[12px] font-black uppercase text-white tracking-tight flex items-center gap-2">
                  <Wallet size={14} className="text-[#312ECB]" /> CONFIRM ORDER
                </h3>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black text-[8px] uppercase h-5">WALLET</Badge>
             </div>

             <OrderSummaryBreakdown />
             
             <div className="space-y-3 px-1">
                {!isCombo && (
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-500 ml-1 tracking-[0.2em]">Target Link</label>
                    {isBulk ? (
                      <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5 shadow-inner">
                         <p className="text-[9px] font-bold text-slate-400 leading-tight italic">{linkCount} target links confirmed in this batch.</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                        <Input 
                          placeholder="Enter target link here" 
                          value={links} 
                          onChange={(e) => setLinks(e.target.value)} 
                          className="h-11 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-bold text-xs pl-9 text-white" 
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <Button 
                    onClick={() => onOptionClick?.(`CONFIRM_WALLET###${links || prefilledLinks}`)} 
                    disabled={(!isCombo && !links) || walletBalance < price}
                    className={cn(
                      "w-full h-14 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10 transition-all",
                      walletBalance >= price ? "bg-[#312ECB] text-white" : "bg-red-500/20 text-red-400 cursor-not-allowed border-red-500/20"
                    )}
                  >
                    {walletBalance >= price ? "PLACE ORDER NOW" : "INSUFFICIENT BALANCE"}
                  </Button>
                  {walletBalance < price && (
                    <p className="text-center text-[8px] font-black uppercase text-red-500 mt-2 animate-pulse">Refill wallet to proceed</p>
                  )}
                </div>
             </div>
          </div>
        ) : isSuccessCard ? (
          <div className="space-y-5 min-w-[280px] py-2">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="text-emerald-500" size={32} />
              </div>
              <h3 className="text-[15px] font-black uppercase text-white tracking-tight">Congratulations!</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your order is placed</p>
            </div>

            <div className="bg-slate-950/80 rounded-[1.5rem] p-4 border border-white/5 space-y-3 shadow-inner">
              <div className="flex justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Service:</span>
                <span className="text-[10px] font-black text-[#312ECB] uppercase">{serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Quantity:</span>
                <span className="text-[10px] font-black text-white">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Paid Amount:</span>
                <span className="text-[10px] font-black text-emerald-400">₹{price.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-white/5">
                <span className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Target Link:</span>
                <p className="text-[9px] font-medium text-slate-300 break-all">{links || prefilledLinks}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2.5">
                <Button onClick={() => onOptionClick?.("menu")} variant="outline" className="w-full h-11 border-white/10 bg-slate-950 text-white font-black text-[9px] uppercase tracking-widest rounded-xl shadow-3d active:shadow-3d-pressed">
                  MENU
                </Button>
              </div>

              {showWhatsAppSuccess && (
                <div className="pt-2">
                  <p className="text-center text-[8px] font-black text-slate-500 uppercase mb-2">Send order details to admin</p>
                  <Button 
                    onClick={handleWhatsAppConfirmation}
                    className="w-full h-12 bg-[#25D366] hover:bg-[#1EBE57] text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10 gap-2"
                  >
                    <MessageCircle size={18} /> SEND ON WHATSAPP
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : hasPriceData ? (
          <div className="space-y-4 min-w-[260px] py-1">
            <div className="flex items-center gap-2 px-1">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <h3 className="text-[13px] font-black uppercase text-white tracking-tight">Order Summary</h3>
            </div>
            <OrderSummaryBreakdown />
            {text && !text.includes('SUMMARY') && (
              <p className="text-[11px] font-bold text-slate-300 px-1 mt-2">{text}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[12px] font-bold whitespace-pre-wrap leading-relaxed tracking-wide">{text}</p>
          </div>
        )}

        {options && !isPaymentCard && !isWalletCard && !isComboConfigCard && !isBulkLinkCard && !isSuccessCard && (
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
