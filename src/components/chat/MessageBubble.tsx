
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
  isSummaryCard?: boolean;
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
  isSummaryCard,
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
    <div className="bg-slate-950/90 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 shadow-3d-pressed space-y-5">
      <div className="flex items-center gap-4 border-b border-white/5 pb-4">
        <div className="w-12 h-12 rounded-2xl bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB]">
          <Package size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black uppercase text-white truncate tracking-tight">{serviceName || 'Package'}</p>
          <div className="flex items-center gap-2.5 mt-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qty: {quantity || 'N/A'}</span>
            {isBulk && (
              <Badge className="bg-purple-500/10 text-purple-400 border-none font-black text-[9px] px-2.5 h-5">
                {linkCount} LINKS
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        <div className="flex justify-between items-center px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Market Price</span>
          <span className="text-xs font-bold text-slate-400 line-through">₹{finalRawPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Offer ({discountPct}%)</span>
          </div>
          <span className="text-xs font-black text-emerald-400">- ₹{savings.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-white/10 px-1">
          <span className="text-xs font-black text-white uppercase tracking-widest">Net Payable</span>
          <span className="text-2xl font-black text-[#312ECB] italic">₹{price.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-emerald-500/5 rounded-2xl p-4 flex items-center justify-between border border-emerald-500/10 shadow-inner">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Wallet size={16} />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wallet</span>
        </div>
        <div className="text-right">
          <p className={cn(
            "text-sm font-black tracking-tight",
            walletBalance >= price ? "text-emerald-400" : "text-red-400"
          )}>
            ₹{walletBalance.toFixed(2)}
          </p>
          {walletBalance < price && <p className="text-[8px] font-black uppercase text-red-500 mt-1 animate-pulse">Insufficient</p>}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;

  return (
    <div className={cn("flex w-full mb-5", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[94%] px-5 py-4 relative border border-white/5", 
        isUser ? "bubble-user" : "bubble-bot"
      )}>
        
        {isBulkLinkCard ? (
          <div className="space-y-6 min-w-[290px] py-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB]">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Bulk Order Setup</h3>
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Add Multiple Target Links</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <Input 
                  placeholder="Enter target link here"
                  value={currentBulkLink}
                  onChange={(e) => setCurrentBulkLink(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBulkLink()}
                  className="h-12 bg-slate-950 border-none rounded-xl text-sm font-bold text-white shadow-3d-pressed flex-1"
                />
                <Button onClick={addBulkLink} size="icon" className="h-12 w-12 rounded-xl bg-[#312ECB] shadow-3d active:shadow-3d-pressed shrink-0">
                  <Plus size={24} />
                </Button>
              </div>

              {bulkLinks.length > 0 && (
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 space-y-2.5 max-h-[180px] overflow-y-auto custom-scrollbar">
                  {bulkLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-white/5 group">
                      <span className="text-[10px] font-bold text-slate-400 truncate max-w-[200px]">{link}</span>
                      <button onClick={() => removeBulkLink(idx)} className="text-red-500/50 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={14} />
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
              className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed flex items-center justify-center gap-3"
            >
              <CheckCircle2 size={18} /> CONFIRM {bulkLinks.length} LINKS
            </Button>
          </div>
        ) : isComboConfigCard ? (
          <div className="space-y-6 min-w-[290px] py-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB]">
                <Rocket size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Combo Builder</h3>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black text-[8px] px-2.5 mt-1 tracking-widest">
                  {discountPct}% AUTO-DISCOUNT
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              {comboItems.map((item) => (
                <div key={item.service.id} className="bg-slate-950 p-5 rounded-[1.8rem] border border-white/5 shadow-3d-pressed relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase text-[#312ECB] tracking-widest">{item.service.name}</span>
                    <button onClick={() => removeServiceFromCombo(item.service.id)} className="text-red-500/50 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <Input 
                    placeholder={`Qty (Min ${item.service.minQuantity})`}
                    value={item.qty}
                    onChange={(e) => updateComboQty(item.service.id, e.target.value)}
                    className="h-11 bg-slate-900 border-none rounded-xl text-sm font-bold text-white shadow-inner"
                  />
                </div>
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-12 border-dashed border-white/10 bg-transparent text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/5">
                    <Plus size={16} className="mr-2" /> Add Service to Pack
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-white/10 rounded-xl max-h-[220px] overflow-y-auto custom-scrollbar">
                  {dynamicServices?.filter(s => !comboItems.find(i => i.service.id === s.id)).map(s => (
                    <DropdownMenuItem key={s.id} onClick={() => addServiceToCombo(s)} className="text-[10px] font-black uppercase text-slate-300 focus:bg-[#312ECB] focus:text-white p-3">
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Target Link</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                  <Input 
                    placeholder="Enter target link here" 
                    value={links}
                    onChange={(e) => setLinks(e.target.value)}
                    className="h-12 bg-slate-950 border-none rounded-xl pl-11 text-sm font-bold text-white shadow-3d-pressed"
                  />
                </div>
              </div>

              <div className="bg-slate-950/50 p-5 rounded-[1.5rem] space-y-2.5 border border-white/5 shadow-inner">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase">
                  <span>Subtotal:</span>
                  <span>₹{comboSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-black text-emerald-400 uppercase tracking-tight">
                  <span>Pay Only:</span>
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
                className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed"
              >
                GENERATE COMBO SUMMARY
              </Button>
            </div>
          </div>
        ) : isSummaryCard ? (
          <div className="space-y-5 min-w-[270px] py-1">
            <div className="flex items-center gap-3 px-1">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <h3 className="text-sm font-black uppercase text-white tracking-tight">Final Summary</h3>
            </div>
            <OrderSummaryBreakdown />
            {options && (
              <div className="mt-5 space-y-3 px-1">
                {options.map((opt, i) => (
                  <button key={i} onClick={() => onOptionClick?.(opt)} className="w-full bg-slate-900 border border-white/5 p-4 rounded-2xl flex items-center justify-between group shadow-3d active:shadow-3d-pressed transition-all">
                    <span className="text-[11px] font-black uppercase text-[#312ECB] tracking-widest">{opt}</span>
                    <div className="w-8 h-8 rounded-xl bg-[#312ECB]/10 flex items-center justify-center text-[#312ECB] shadow-3d-sm group-hover:scale-110 transition-transform">
                      <SendHorizonal size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : isPaymentCard ? (
          <div className="space-y-6 min-w-[270px] py-1">
            <div className="bg-slate-950 p-5 rounded-[2rem] flex flex-col items-center gap-5 shadow-3d-pressed border border-white/5">
              <div className="bg-white p-3 rounded-[1.5rem] shadow-3d border border-white/20">
                <img src={qrUrl} alt="UPI QR" className="w-40 h-40" />
              </div>
              <div className="flex w-full gap-3 px-1">
                <Button onClick={() => { navigator.clipboard.writeText(upiId); toast({ title: "Copied!" }); }} variant="outline" className="flex-1 h-11 text-[10px] font-black uppercase rounded-xl border-white/10 shadow-3d active:shadow-3d-pressed text-slate-300">
                  <Copy size={14} className="mr-2" /> COPY ID
                </Button>
                <Button onClick={handleDownloadQR} disabled={isDownloading} variant="outline" className="flex-1 h-11 text-[10px] font-black uppercase rounded-xl border-white/10 shadow-3d active:shadow-3d-pressed text-[#312ECB]">
                  {isDownloading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Download size={14} className="mr-2" />} SAVE QR
                </Button>
              </div>
            </div>

            <div className="space-y-5 px-1">
              <div className="space-y-3">
                {!isCombo && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Target Link</label>
                    {isBulk ? (
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 shadow-inner">
                         <p className="text-[10px] font-bold text-slate-400 leading-tight italic">{linkCount} target links submitted.</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <LinkIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                        <Input placeholder="Enter target link here" value={links} onChange={(e) => setLinks(e.target.value)} className="h-12 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-bold text-sm pl-11 text-white" />
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2 pt-1">
                  <label className="text-[10px] font-black uppercase text-red-500 ml-1 leading-none animate-pulse tracking-tighter">Shi utr dalo varna payment verify nhi hoga</label>
                  <Input placeholder="12-Digit UTR ID" value={utr} maxLength={12} onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))} className="h-12 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-black tracking-[0.4em] text-sm text-center text-white" />
                </div>
              </div>
              
              <Button onClick={() => onOptionClick?.(`SUBMIT_PAYMENT###${links || prefilledLinks}###${utr}`)} disabled={(!isCombo && !links) || utr.length !== 12} className="w-full h-16 bg-[#312ECB] font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] shadow-3d active:shadow-3d-pressed border border-white/10">
                VERIFY & SUBMIT ORDER
              </Button>
            </div>
          </div>
        ) : isWalletCard ? (
          <div className="space-y-6 min-w-[270px] py-1">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black uppercase text-white tracking-tight flex items-center gap-3">
                  <Wallet size={18} className="text-[#312ECB]" /> SECURE CHECKOUT
                </h3>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black text-[9px] uppercase h-6 px-3">WALLET</Badge>
             </div>

             <OrderSummaryBreakdown />
             
             <div className="space-y-4 px-1">
                {!isCombo && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Target Link</label>
                    {isBulk ? (
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 shadow-inner">
                         <p className="text-[10px] font-bold text-slate-400 leading-tight italic">{linkCount} target links confirmed.</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                        <Input 
                          placeholder="Enter target link here" 
                          value={links} 
                          onChange={(e) => setLinks(e.target.value)} 
                          className="h-12 rounded-xl bg-slate-950 border-none shadow-3d-pressed font-bold text-sm pl-11 text-white" 
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
                      "w-full h-16 font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] shadow-3d active:shadow-3d-pressed border border-white/10 transition-all",
                      walletBalance >= price ? "bg-[#312ECB] text-white" : "bg-red-500/20 text-red-400 cursor-not-allowed border-red-500/20"
                    )}
                  >
                    {walletBalance >= price ? "PLACE ORDER NOW" : "REFILL WALLET FIRST"}
                  </Button>
                  {walletBalance < price && (
                    <p className="text-center text-[9px] font-black uppercase text-red-500 mt-3 animate-pulse tracking-widest">Low balance detected!</p>
                  )}
                </div>
             </div>
          </div>
        ) : isSuccessCard ? (
          <div className="space-y-6 min-w-[290px] py-2">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="text-emerald-500" size={40} />
              </div>
              <h3 className="text-lg font-black uppercase text-white tracking-tight">Success!</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Order has been queued</p>
            </div>

            <div className="bg-slate-950/80 rounded-[2rem] p-5 border border-white/5 space-y-4 shadow-inner">
              <div className="flex justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Service</span>
                <span className="text-xs font-black text-[#312ECB] uppercase">{serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Quantity</span>
                <span className="text-xs font-black text-white">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Total Paid</span>
                <span className="text-xs font-black text-emerald-400">₹{price.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-white/5">
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">Target</span>
                <p className="text-[10px] font-medium text-slate-300 break-all leading-relaxed">{links || prefilledLinks}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Button onClick={() => onOptionClick?.("menu")} variant="outline" className="w-full h-12 border-white/10 bg-slate-950 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-3d active:shadow-3d-pressed">
                BACK TO MENU
              </Button>

              {showWhatsAppSuccess && (
                <div className="pt-2">
                  <p className="text-center text-[9px] font-black text-slate-500 uppercase mb-3">Send snapshot to admin</p>
                  <Button 
                    onClick={handleWhatsAppConfirmation}
                    className="w-full h-14 bg-[#25D366] hover:bg-[#1EBE57] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-3d active:shadow-3d-pressed border border-white/10 gap-3"
                  >
                    <MessageCircle size={20} /> WHATSAPP ADMIN
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-bold whitespace-pre-wrap leading-relaxed tracking-wide">{text}</p>
          </div>
        )}

        {options && !isPaymentCard && !isWalletCard && !isComboConfigCard && !isBulkLinkCard && !isSuccessCard && !isSummaryCard && (
          <div className="mt-5 space-y-3">
            {options.map((opt, i) => (
              <button key={i} onClick={() => onOptionClick?.(opt)} className="w-full bg-slate-900 border border-white/5 p-4 rounded-2xl flex items-center justify-between group shadow-3d active:shadow-3d-pressed transition-all">
                <span className="text-[11px] font-black uppercase text-[#312ECB] tracking-widest">{opt}</span>
                <div className="w-8 h-8 rounded-xl bg-[#312ECB]/10 flex items-center justify-center text-[#312ECB] shadow-3d-sm group-hover:scale-110 transition-transform">
                  <SendHorizonal size={14} />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className={cn("text-[8px] mt-2.5 font-black uppercase opacity-40 tracking-widest", isUser ? "text-right" : "text-left")}>
          {format(timestamp, 'HH:mm')}
        </div>
      </div>
    </div>
  );
}
