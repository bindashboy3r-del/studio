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
  Loader2, 
  History, 
  Wallet,
  Plus,
  Trash2,
  Layers,
  Link as LinkIcon,
  Percent,
  ChevronDown
} from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SERVICES } from "@/app/lib/constants";
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
  onComboSubmit
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  const { toast } = useToast();
  const router = useRouter();
  
  const [link, setLink] = useState("");
  const [utr, setUtr] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [bulkLinks, setBulkLinks] = useState<string[]>([]);
  const [currentBulkLink, setCurrentBulkLink] = useState("");

  // Default Combo Services: Likes, Views, Comments
  const [comboItems, setComboItems] = useState<{ serviceId: string, quantity: number }[]>([
    { serviceId: 'likes', quantity: 0 },
    { serviceId: 'views', quantity: 0 },
    { serviceId: 'comments', quantity: 0 }
  ]);
  const [comboLink, setComboLink] = useState("");

  const price = paymentPrice || fundPrice || 0;
  const upiId = "smmxpressbot@slc";
  
  const upiLink = `upi://pay?pa=${upiId}&pn=SocialBoost&am=${price.toFixed(2)}&cu=INR`;
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
      window.open(qrUrl, '_blank');
      toast({ title: "Download Help", description: "Long-press image to save." });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(upiId);
    toast({ title: "Copied!", description: "UPI ID copied to clipboard." });
  };

  const isFormValid = isFundPaymentCard ? utr.length === 12 : (link.trim() !== "" && utr.length === 12);

  const getWhatsAppAdminUrl = () => {
    if (!successDetails) return "#";
    const msg = encodeURIComponent(
      `🚀 *NEW ORDER PLACED!*\n\n` +
      `🆔 *Order ID:* #${successDetails.orderId}\n` +
      `📊 *Service:* ${successDetails.platform} ${successDetails.service}\n` +
      `🔢 *Quantity:* ${successDetails.quantity}\n` +
      `💰 *Price:* ₹${successDetails.price.toFixed(0)}\n` +
      `🔗 *Link:* ${successDetails.link}\n` +
      `💳 *Payment:* ${successDetails.utrId === 'WALLET-PAYMENT' ? 'WALLET' : 'UPI (' + successDetails.utrId + ')'}\n\n` +
      `Please process my order ASAP!`
    );
    return `https://wa.me/919116399517?text=${msg}`;
  };

  const addBulkLink = () => {
    if (!currentBulkLink.trim()) return;
    setBulkLinks([...bulkLinks, currentBulkLink.trim()]);
    setCurrentBulkLink("");
  };

  const removeBulkLink = (index: number) => {
    setBulkLinks(bulkLinks.filter((_, i) => i !== index));
  };

  // Combo Card Logic: List all Instagram services that AREN'T currently in the combo
  const availableServices = useMemo(() => {
    const selectedIds = comboItems.map(i => i.serviceId);
    return SERVICES.instagram.filter(s => !selectedIds.includes(s.id));
  }, [comboItems]);

  const addComboService = (serviceId: string) => {
    setComboItems([...comboItems, { serviceId, quantity: 0 }]);
  };

  const removeComboService = (index: number) => {
    setComboItems(comboItems.filter((_, i) => i !== index));
  };

  const updateComboQuantity = (index: number, qty: number) => {
    const updated = [...comboItems];
    updated[index].quantity = qty;
    setComboItems(updated);
  };

  const comboTotal = useMemo(() => {
    const raw = comboItems.reduce((sum, item) => {
      const s = SERVICES.instagram.find(sv => sv.id === item.serviceId);
      return sum + (item.quantity / 1000) * (s?.pricePer1000 || 0);
    }, 0);
    return { raw, discounted: raw * 0.95 };
  }, [comboItems]);

  const isComboValid = comboItems.length >= 1 && comboItems.every(item => {
    const s = SERVICES.instagram.find(sv => sv.id === item.serviceId);
    return item.quantity >= (s?.minQuantity || 100);
  }) && comboLink.trim() !== "";

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

            <div className="space-y-3 mt-4">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Order confirm karne ke liye admin ko send kre
                </p>
                <Button 
                  asChild
                  className="w-full h-14 bg-[#25D366] hover:bg-[#20bd5b] text-white rounded-2xl font-black uppercase text-[12px] tracking-widest gap-2 shadow-lg"
                >
                  <a href={getWhatsAppAdminUrl()} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={18} /> Send to Admin
                  </a>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
        ) : (isPaymentCard || isFundPaymentCard) ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-black text-[#111B21] dark:text-white uppercase tracking-tight">
                <QrCode size={16} className="text-[#312ECB]" /> {isFundPaymentCard ? 'Add Funds' : 'Secure Payment'}
              </div>
              <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                Please scan QR or copy UPI ID to pay <span className="text-[#312ECB] font-black">₹{price.toFixed(0)}</span>.
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
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white p-3 rounded-[2rem] shadow-inner border border-slate-100 flex items-center justify-center min-h-[220px] min-w-[220px]">
                <img src={qrUrl} alt="Payment QR" className="w-48 h-48 block rounded-xl" crossOrigin="anonymous" />
              </div>
              <Button 
                onClick={handleDownloadQR}
                disabled={isDownloading}
                className="w-full h-12 bg-white dark:bg-slate-900 text-[#312ECB] hover:bg-slate-50 border-2 border-[#312ECB] rounded-xl text-[12px] font-black uppercase tracking-widest gap-2 shadow-sm"
              >
                <Download size={18} /> Download QR
              </Button>
            </div>

            <div className="space-y-3 pt-2">
              {!isFundPaymentCard && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Link</label>
                  <Input 
                    placeholder="Paste Link here"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 text-sm font-bold shadow-inner"
                  />
                </div>
              )}
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
                onClick={() => isFundPaymentCard ? onFundSubmit?.(price, utr) : onPaymentSubmit?.(link, utr)}
                disabled={!isFormValid}
                className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[12px] uppercase tracking-widest rounded-2xl shadow-xl gap-3 transition-all transform active:scale-95"
              >
                🚀 {isFundPaymentCard ? 'Submit Fund Request' : 'Submit Order Now'}
              </Button>
            </div>
          </div>
        ) : isBulkLinkCard ? (
          <div className="space-y-6 min-w-[280px]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-black text-[#111B21] dark:text-white uppercase tracking-tight">
                <Layers size={16} className="text-[#312ECB]" /> Bulk Link Input
              </div>
              <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                Add links one-by-one to your bulk list.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                  <Input 
                    placeholder="Paste link here..."
                    value={currentBulkLink}
                    onChange={(e) => setCurrentBulkLink(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addBulkLink()}
                    className="h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl pl-10 pr-5 text-sm font-bold shadow-inner"
                  />
                </div>
                <Button 
                  onClick={addBulkLink}
                  className="h-12 w-12 bg-[#312ECB] rounded-2xl shadow-lg shrink-0"
                >
                  <Plus size={20} />
                </Button>
              </div>

              <ScrollArea className={cn("h-[180px] bg-slate-50 dark:bg-slate-900 rounded-3xl p-4 border border-slate-100 dark:border-slate-800", bulkLinks.length === 0 && "flex items-center justify-center")}>
                {bulkLinks.length > 0 ? (
                  <div className="space-y-2">
                    {bulkLinks.map((l, i) => (
                      <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-[11px] font-bold truncate max-w-[180px] text-slate-600 dark:text-slate-300">
                          {l}
                        </span>
                        <button onClick={() => removeBulkLink(i)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 py-10">
                    <Layers size={32} className="mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Links List Empty</p>
                  </div>
                )}
              </ScrollArea>

              <Button 
                onClick={() => onBulkLinksSubmit?.(bulkLinks)}
                disabled={bulkLinks.length === 0}
                className="w-full h-14 bg-[#25D366] hover:bg-[#20bd5b] text-white rounded-2xl font-black uppercase text-[12px] tracking-widest gap-2 shadow-xl transition-all active:scale-95"
              >
                Submit {bulkLinks.length} Links
              </Button>
            </div>
          </div>
        ) : isComboCard ? (
          <div className="space-y-6 min-w-[280px]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-black text-[#111B21] dark:text-white uppercase tracking-tight">
                <Rocket size={16} className="text-[#312ECB]" /> Configure Combo
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[9px] uppercase tracking-widest">
                <Percent size={10} className="mr-1" /> 5% Discount Active
              </Badge>
            </div>

            <div className="space-y-4">
              <ScrollArea className="max-h-[350px] pr-2">
                <div className="space-y-3">
                  {comboItems.map((item, idx) => {
                    const s = SERVICES.instagram.find(sv => sv.id === item.serviceId);
                    const min = s?.minQuantity || 100;
                    return (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#312ECB] dark:text-blue-400">{s?.name || 'Service'}</span>
                          <button onClick={() => removeComboService(idx)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="relative">
                          <Input 
                            type="number"
                            placeholder={`Qty (Min ${min})`}
                            value={item.quantity || ""}
                            onChange={(e) => updateComboQuantity(idx, parseInt(e.target.value) || 0)}
                            className="h-10 bg-white dark:bg-slate-800 border-none rounded-xl px-4 text-xs font-bold shadow-inner"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {availableServices.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full h-12 border-dashed border-2 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-[#312ECB] rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2">
                      <Plus size={14} /> Add Service
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-[200px] bg-white dark:bg-slate-900 rounded-2xl border-gray-100 dark:border-slate-800 shadow-xl">
                    {availableServices.map(s => (
                      <DropdownMenuItem 
                        key={s.id} 
                        onClick={() => addComboService(s.id)}
                        className="text-[10px] font-black uppercase tracking-widest py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {s.name} (Min {s.minQuantity})
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div className="space-y-1 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Link</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                  <Input 
                    placeholder="Instagram link for combo"
                    value={comboLink}
                    onChange={(e) => setComboLink(e.target.value)}
                    className="h-12 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl pl-10 pr-5 text-sm font-bold shadow-inner"
                  />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between text-[11px] font-bold text-slate-400 line-through">
                  <span>Subtotal:</span>
                  <span>₹{comboTotal.raw.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[13px] font-black text-emerald-600">
                  <span>Combo Total (5% OFF):</span>
                  <span>₹{comboTotal.discounted.toFixed(2)}</span>
                </div>
              </div>

              <Button 
                onClick={() => onComboSubmit?.(comboItems, comboLink)}
                disabled={!isComboValid}
                className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-2xl font-black uppercase text-[12px] tracking-widest gap-2 shadow-xl transition-all active:scale-95"
              >
                Proceed to Payment
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed font-bold text-black dark:text-white whitespace-pre-wrap">
            {text}
          </p>
        )}

        {options && options.length > 0 && !isPaymentCard && !isSuccessCard && !isFundPaymentCard && !isBulkLinkCard && !isComboCard && (
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
