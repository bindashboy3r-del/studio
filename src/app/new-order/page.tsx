
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  Timestamp,
  addDoc
} from "firebase/firestore";
import { 
  ChevronLeft, 
  ShoppingCart, 
  Rocket, 
  Layers, 
  Package, 
  TrendingDown, 
  Wallet, 
  CheckCircle2, 
  QrCode, 
  Copy, 
  Download, 
  Loader2, 
  MessageCircle,
  Link as LinkIcon,
  Trash2,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { SMMService, PLATFORMS, Platform } from "@/app/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/tabs"; // Adjusted for convenience
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/BottomNav";

export default function NewOrderPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // Order Settings
  const [orderType, setOrderType] = useState<'single' | 'combo' | 'bulk'>('single');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('instagram');
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [targetLink, setTargetLink] = useState<string>("");
  const [bulkLinks, setBulkLinks] = useState<string[]>([]);
  const [currentBulkLink, setCurrentBulkLink] = useState("");
  const [utrId, setUtrId] = useState("");
  
  // Checkout State
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'summary' | 'payment'>('form');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Data
  const servicesQuery = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db, currentUser]);
  const { data: rawServices } = useCollection<SMMService>(servicesQuery);
  const activeServices = useMemo(() => (rawServices || []).filter(s => s.isActive !== false), [rawServices]);
  
  const { data: userData } = useDoc(useMemoFirebase(() => currentUser && db ? doc(db, "users", currentUser.uid) : null, [db, currentUser]));
  const walletBalance = userData?.balance || 0;

  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  const [paymentConfig, setPaymentConfig] = useState<any>(null);

  useEffect(() => {
    if (!db) return;
    onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) setGlobalDiscounts({ single: snap.data().single || 0, combo: snap.data().combo || 0, bulk: snap.data().bulk || 0 });
    });
    onSnapshot(doc(db, "globalSettings", "payment"), (snap) => { if (snap.exists()) setPaymentConfig(snap.data()); });
  }, [db]);

  const selectedService = useMemo(() => activeServices.find(s => s.id === selectedServiceId), [activeServices, selectedServiceId]);
  const currentDiscount = globalDiscounts[orderType];

  // Pricing Logic
  const calcPrices = () => {
    const qty = parseInt(quantity) || 0;
    const rate = selectedService?.pricePer1000 || 0;
    const multiplier = orderType === 'bulk' ? Math.max(1, bulkLinks.length) : 1;
    const raw = (qty / 1000) * rate * multiplier;
    const final = raw * (1 - currentDiscount / 100);
    return { raw, final, savings: raw - final };
  };

  const { raw: rawPrice, final: finalPrice, savings } = calcPrices();

  // Handlers
  const handlePlaceOrder = async () => {
    if (!currentUser || !db || !selectedService) return;
    setIsProcessing(true);

    const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
    const linksArr = orderType === 'bulk' ? bulkLinks : [targetLink];
    
    try {
      const batch = writeBatch(db);
      if (paymentMethod === 'wallet') {
        if (walletBalance < finalPrice) { toast({ variant: "destructive", title: "Low Balance" }); setIsProcessing(false); return; }
        batch.update(doc(db, "users", currentUser.uid), { balance: increment(-finalPrice) });
      }

      batch.set(doc(collection(db, "users", currentUser.uid, "orders")), {
        orderId, 
        service: selectedService.name, 
        quantity: parseInt(quantity), 
        price: finalPrice,
        status: paymentMethod === 'wallet' ? 'Processing' : 'Pending', 
        type: paymentMethod === 'wallet' ? 'API' : 'Manual',
        links: linksArr, 
        utrId: paymentMethod === 'upi' ? utrId : "", 
        platform: selectedPlatform, 
        createdAt: serverTimestamp(),
        autoCompleteAt: Timestamp.fromDate(new Date(Date.now() + 45 * 60 * 1000))
      });

      await batch.commit();
      toast({ title: "Order Placed!", description: `Order #${orderId} is now queued.` });
      router.push('/orders');
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to place order." });
    } finally {
      setIsProcessing(false);
    }
  };

  const addBulkLink = () => {
    if (currentBulkLink.trim()) { setBulkLinks([...bulkLinks, currentBulkLink.trim()]); setCurrentBulkLink(""); }
  };

  if (isUserLoading) return null;

  return (
    <div className="min-h-screen bg-[#030712] font-body text-slate-100 pb-24">
      <header className="sticky top-0 z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/chat')} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[10px] tracking-widest">
          <ChevronLeft size={16} /> BACK
        </button>
        <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Create New Order</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-5 space-y-6">
        {checkoutStep === 'form' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Tabs defaultValue="single" onValueChange={(v) => setOrderType(v as any)} className="w-full">
              <TabsList className="bg-white/5 border border-white/5 w-full h-14 rounded-2xl p-1 gap-1">
                <TabsTrigger value="single" className="flex-1 rounded-xl font-black text-[10px] uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">Single</TabsTrigger>
                <TabsTrigger value="combo" className="flex-1 rounded-xl font-black text-[10px] uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">Combo</TabsTrigger>
                <TabsTrigger value="bulk" className="flex-1 rounded-xl font-black text-[10px] uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">Bulk</TabsTrigger>
              </TabsList>

              <div className="mt-6 space-y-5">
                {/* Platform Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Platform</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(PLATFORMS).map(([key, label]) => (
                      <button 
                        key={key} 
                        onClick={() => setSelectedPlatform(key as Platform)}
                        className={cn(
                          "h-12 rounded-xl border font-black text-[9px] uppercase transition-all",
                          selectedPlatform === key ? "bg-[#312ECB]/10 border-[#312ECB] text-white shadow-lg" : "bg-white/5 border-white/5 text-slate-500"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Select Service</label>
                  <Select onValueChange={setSelectedServiceId} value={selectedServiceId}>
                    <SelectTrigger className="h-14 bg-white/5 border-white/5 rounded-2xl font-bold text-sm text-white px-5 focus:ring-[#312ECB]">
                      <SelectValue placeholder="Pick a service..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#030712] border-white/10 rounded-2xl">
                      {activeServices.filter(s => s.platform === selectedPlatform).map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-sm font-bold p-4 focus:bg-[#312ECB] text-white">
                          {s.name} (₹{s.pricePer1000}/1k)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">
                    Quantity {selectedService ? `(Min: ${selectedService.minQuantity})` : ''}
                  </label>
                  <Input 
                    type="number" 
                    placeholder="Enter amount..." 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-14 bg-white/5 border-white/5 rounded-2xl px-5 text-base font-black text-white focus-visible:ring-[#312ECB]"
                  />
                </div>

                {/* Link Input(s) */}
                {orderType === 'bulk' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Target Links ({bulkLinks.length})</label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Add multiple links..." 
                        value={currentBulkLink} 
                        onChange={(e) => setCurrentBulkLink(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addBulkLink()}
                        className="h-14 bg-white/5 border-white/5 rounded-2xl px-5 text-sm font-bold text-white flex-1"
                      />
                      <Button onClick={addBulkLink} size="icon" className="h-14 w-14 rounded-2xl bg-[#312ECB] shadow-lg shrink-0">
                        <Plus size={24} />
                      </Button>
                    </div>
                    {bulkLinks.length > 0 && (
                      <div className="bg-white/5 rounded-2xl p-3 space-y-2 max-h-32 overflow-y-auto">
                        {bulkLinks.map((l, i) => (
                          <div key={i} className="flex items-center justify-between bg-white/5 p-2 rounded-lg group">
                            <span className="text-[10px] font-bold text-slate-400 truncate flex-1">{l}</span>
                            <button onClick={() => setBulkLinks(bulkLinks.filter((_, idx) => idx !== i))} className="text-red-500/50 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Target Link</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <Input 
                        placeholder="Paste link here..." 
                        value={targetLink} 
                        onChange={(e) => setTargetLink(e.target.value)}
                        className="h-14 bg-white/5 border-white/5 rounded-2xl pl-12 text-sm font-bold text-white focus-visible:ring-[#312ECB]"
                      />
                    </div>
                  </div>
                )}

                <Button 
                  disabled={!selectedService || !quantity || (orderType === 'bulk' ? bulkLinks.length === 0 : !targetLink)}
                  onClick={() => setCheckoutStep('summary')}
                  className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl mt-4"
                >
                  Confirm Selection
                </Button>
              </div>
            </Tabs>
          </div>
        )}

        {checkoutStep === 'summary' && (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <div className="w-14 h-14 rounded-2xl bg-[#312ECB]/20 flex items-center justify-center text-[#312ECB]">
                  <Package size={28} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-white tracking-tight">{selectedService?.name}</h3>
                  <Badge className="bg-[#312ECB]/10 text-[#312ECB] border-none font-black text-[9px] uppercase px-3 mt-1">
                    Qty: {quantity}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Original Price</span>
                  <span className="text-sm font-bold text-slate-400 line-through">₹{rawPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={18} className="text-emerald-400" />
                    <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">Offer ({currentDiscount}%)</span>
                  </div>
                  <span className="text-sm font-black text-emerald-400">- ₹{savings.toFixed(2)}</span>
                </div>
                <div className="pt-6 border-t border-white/10 flex justify-between items-center px-1">
                  <span className="text-[13px] font-black text-white uppercase tracking-[0.2em]">Net Payable</span>
                  <span className="text-3xl font-black text-[#312ECB] italic">₹{finalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Wallet size={20} />
                  </div>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Wallet Balance</span>
                </div>
                <p className={cn("text-base font-black italic", walletBalance >= finalPrice ? "text-emerald-400" : "text-red-400")}>
                  ₹{walletBalance.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button 
                onClick={() => { setPaymentMethod('wallet'); handlePlaceOrder(); }}
                disabled={isProcessing || walletBalance < finalPrice}
                className={cn(
                  "h-16 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl gap-3",
                  walletBalance >= finalPrice ? "bg-emerald-500 text-white" : "bg-red-500/10 text-red-500 border border-red-500/20"
                )}
              >
                {isProcessing && paymentMethod === 'wallet' ? <Loader2 className="animate-spin" /> : <Wallet size={20} />}
                {walletBalance >= finalPrice ? "Pay from Wallet" : "Insufficient Balance"}
              </Button>

              <Button 
                onClick={() => { setPaymentMethod('upi'); setCheckoutStep('payment'); }}
                disabled={isProcessing}
                variant="outline"
                className="h-16 border-white/10 bg-white/5 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl gap-3"
              >
                <QrCode size={20} className="text-[#312ECB]" /> Pay via UPI QR
              </Button>

              <button onClick={() => setCheckoutStep('form')} className="text-center py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                Cancel & Go Back
              </button>
            </div>
          </div>
        )}

        {checkoutStep === 'payment' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl">
              <div className="bg-white p-4 rounded-[2rem] inline-block shadow-3d">
                <img 
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(`upi://pay?pa=smmxpressbot@slc&pn=SocialBoost&am=${finalPrice.toFixed(2)}&cu=INR`)}&size=400&margin=1&format=png`} 
                  alt="Payment QR" 
                  className="w-48 h-48" 
                />
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount to Pay</p>
                <h2 className="text-3xl font-black text-white italic">₹{finalPrice.toFixed(2)}</h2>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-red-500 animate-pulse">Sahi UTR ID dalo varna verify nahi hoga</label>
                <Input 
                  placeholder="Enter 12-Digit UTR ID" 
                  maxLength={12}
                  value={utrId}
                  onChange={(e) => setUtrId(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-14 bg-white/5 border-none rounded-2xl text-center text-lg font-black tracking-[0.3em] text-white focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <Button 
              onClick={handlePlaceOrder}
              disabled={isProcessing || utrId.length !== 12}
              className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl gap-3"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
              Verify & Place Order
            </Button>

            <button onClick={() => setCheckoutStep('summary')} className="w-full text-center py-2 text-[10px] font-black uppercase text-slate-500 tracking-widest">
              Back to Summary
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
