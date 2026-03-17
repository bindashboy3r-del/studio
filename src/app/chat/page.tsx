
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
} from "firebase/firestore";
import { 
  ShoppingCart, 
  Wallet, 
  CheckCircle2, 
  Loader2, 
  Link as LinkIcon,
  Trash2,
  Plus,
  Zap,
  Bell,
  X,
  Package,
  TrendingDown,
  QrCode,
  LogIn
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { SMMService, Platform } from "@/app/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ComboItem {
  id: string;
  serviceId: string;
  serviceName: string;
  quantity: string;
  pricePer1000: number;
}

export default function DashboardPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // Guest State
  const isGuest = !currentUser && !isUserLoading;

  // Order Settings
  const [orderType, setOrderType] = useState<'single' | 'combo' | 'bulk'>('single');
  const selectedPlatform: Platform = 'instagram'; // Hardcoded to Instagram
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [targetLink, setTargetLink] = useState<string>("");
  const [bulkLinks, setBulkLinks] = useState<string[]>([]);
  const [currentBulkLink, setCurrentBulkLink] = useState("");
  const [utrId, setUtrId] = useState("");
  
  // Combo State
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);
  
  // Checkout State
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'summary' | 'payment'>('form');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Data - Services
  const servicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db]);
  const { data: rawServices } = useCollection<SMMService>(servicesQuery);
  
  // Filter only Instagram services
  const activeServices = useMemo(() => 
    (rawServices || []).filter(s => s.isActive !== false && s.platform === 'instagram'), 
  [rawServices]);
  
  const { data: userData } = useDoc(useMemoFirebase(() => currentUser && db ? doc(db, "users", currentUser.uid) : null, [db, currentUser]));
  const walletBalance = userData?.balance || 0;

  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, combo: 0, bulk: 0 });
  const [paymentConfig, setPaymentConfig] = useState<any>(null);

  useEffect(() => {
    if (!db) return;
    onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) setGlobalDiscounts({ 
        single: snap.data().single || 0, 
        combo: snap.data().combo || 0, 
        bulk: snap.data().bulk || 0 
      });
    });
    onSnapshot(doc(db, "globalSettings", "payment"), (snap) => { if (snap.exists()) setPaymentConfig(snap.data()); });
    
    if (currentUser) {
      const qNotif = query(collection(db, "users", currentUser.uid, "notifications"), orderBy("createdAt", "desc"));
      onSnapshot(qNotif, (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [db, currentUser]);

  const selectedService = useMemo(() => activeServices.find(s => s.id === selectedServiceId), [activeServices, selectedServiceId]);
  const currentDiscount = globalDiscounts[orderType];

  // Pricing Logic
  const calcPrices = () => {
    let raw = 0;
    if (orderType === 'combo') {
      raw = comboItems.reduce((acc, item) => acc + (parseInt(item.quantity || "0") / 1000) * item.pricePer1000, 0);
    } else {
      const qty = parseInt(quantity) || 0;
      const rate = selectedService?.pricePer1000 || 0;
      const multiplier = orderType === 'bulk' ? Math.max(1, bulkLinks.length) : 1;
      raw = (qty / 1000) * rate * multiplier;
    }
    const final = raw * (1 - currentDiscount / 100);
    return { raw, final, savings: raw - final };
  };

  const { raw: rawPrice, final: finalPrice, savings } = calcPrices();

  // Handlers
  const handlePlaceOrder = async () => {
    if (isGuest) { router.push('/'); return; }
    if (!currentUser || !db) return;
    if (orderType !== 'combo' && !selectedService) return;
    if (orderType === 'combo' && comboItems.length === 0) return;

    setIsProcessing(true);
    const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
    const linksArr = orderType === 'bulk' ? bulkLinks : [targetLink];
    
    try {
      const batch = writeBatch(db);
      if (paymentMethod === 'wallet') {
        if (walletBalance < finalPrice) { 
          toast({ variant: "destructive", title: "Low Balance" }); 
          setIsProcessing(false); 
          return; 
        }
        batch.update(doc(db, "users", currentUser.uid), { balance: increment(-finalPrice) });
      }

      const orderPayload = {
        orderId, 
        service: orderType === 'combo' ? `Combo (${comboItems.length} items)` : selectedService?.name, 
        quantity: orderType === 'combo' ? comboItems.reduce((a, b) => a + parseInt(b.quantity || "0"), 0) : parseInt(quantity), 
        price: finalPrice,
        status: paymentMethod === 'wallet' ? 'Processing' : 'Pending', 
        type: paymentMethod === 'wallet' ? 'API' : 'Manual',
        links: linksArr, 
        utrId: paymentMethod === 'upi' ? utrId : "", 
        platform: selectedPlatform, 
        createdAt: serverTimestamp(),
        autoCompleteAt: Timestamp.fromDate(new Date(Date.now() + 45 * 60 * 1000)),
        comboItems: orderType === 'combo' ? comboItems : null
      };

      batch.set(doc(collection(db, "users", currentUser.uid, "orders")), orderPayload);

      await batch.commit();
      toast({ title: "Order Placed!", description: `Order #${orderId} is now queued.` });
      router.push('/orders');
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to place order." });
    } finally {
      setIsProcessing(false);
    }
  };

  const addComboItem = (serviceId: string) => {
    const s = activeServices.find(x => x.id === serviceId);
    if (!s) return;
    setComboItems([...comboItems, {
      id: Math.random().toString(36).substr(2, 9),
      serviceId: s.id,
      serviceName: s.name,
      quantity: s.minQuantity.toString(),
      pricePer1000: s.pricePer1000
    }]);
    setSelectedServiceId(""); 
  };

  const removeComboItem = (id: string) => {
    setComboItems(comboItems.filter(item => item.id !== id));
  };

  const updateComboItemQty = (id: string, qty: string) => {
    setComboItems(comboItems.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const addBulkLink = () => {
    if (currentBulkLink.trim()) { 
      setBulkLinks([...bulkLinks, currentBulkLink.trim()]); 
      setCurrentBulkLink(""); 
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-[100dvh] bg-[#030712] font-body text-slate-100 pb-24 overflow-x-hidden">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-50 bg-[#030712]/80 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#312ECB] flex items-center justify-center text-white shadow-lg">
            <ShoppingCart size={20} className="fill-current" />
          </div>
          <div>
            <h1 className="text-base font-black italic tracking-tighter text-white uppercase">INSTAGRAM SERVICES</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Wallet size={10} className="text-emerald-400" />
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                {isGuest ? 'Login to View Balance' : `Balance: ₹${walletBalance.toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGuest ? (
            <Button onClick={() => router.push('/')} size="sm" className="bg-[#312ECB] rounded-xl font-black text-[9px] uppercase tracking-widest px-4">
              <LogIn size={12} className="mr-1.5" /> LOGIN
            </Button>
          ) : (
            <button 
              onClick={() => setIsNotifOpen(true)} 
              className="relative p-2.5 bg-white/5 rounded-xl border border-white/5 text-slate-400"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-[#030712]">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-6">
        {checkoutStep === 'form' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Tabs defaultValue="single" onValueChange={(v) => {
              setOrderType(v as any);
              setSelectedServiceId("");
              setComboItems([]);
            }} className="w-full">
              <TabsList className="bg-white/5 border border-white/5 w-full h-14 rounded-2xl p-1 gap-1">
                <TabsTrigger value="single" className="flex-1 rounded-xl font-black text-[10px] uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">Single</TabsTrigger>
                <TabsTrigger value="combo" className="flex-1 rounded-xl font-black text-[10px] uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">Combo</TabsTrigger>
                <TabsTrigger value="bulk" className="flex-1 rounded-xl font-black text-[10px] uppercase data-[state=active]:bg-[#312ECB] data-[state=active]:text-white">Bulk</TabsTrigger>
              </TabsList>

              <div className="mt-6 space-y-5">
                {/* Info Alert for Guest */}
                {isGuest && (
                  <div className="bg-[#312ECB]/10 border border-[#312ECB]/20 p-4 rounded-2xl flex items-start gap-3">
                    <Zap className="text-[#312ECB] shrink-0" size={18} />
                    <p className="text-[10px] font-bold text-slate-300 leading-relaxed uppercase">
                      You are in <span className="text-white font-black">Preview Mode</span>. Browse Instagram services and rates below. Login to place orders.
                    </p>
                  </div>
                )}

                {/* Service Selection */}
                {orderType === 'combo' ? (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Build Instagram Pack</label>
                    <Select onValueChange={addComboItem} value={selectedServiceId}>
                      <SelectTrigger className="h-14 bg-white/5 border-white/5 rounded-2xl font-bold text-sm text-white px-5 focus:ring-[#312ECB]">
                        <SelectValue placeholder="Add service to pack..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#030712] border-white/10 rounded-2xl">
                        {activeServices.map(s => (
                          <SelectItem key={s.id} value={s.id} className="text-sm font-bold p-4 focus:bg-[#312ECB] text-white">
                            {s.name} (₹{s.pricePer1000}/1k)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Combo List */}
                    <div className="space-y-2">
                      {comboItems.map((item) => (
                        <div key={item.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-white truncate uppercase">{item.serviceName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Input 
                                type="number" 
                                disabled={isGuest}
                                value={item.quantity} 
                                onChange={(e) => updateComboItemQty(item.id, e.target.value)}
                                className="h-8 w-20 bg-white/5 border-none rounded-lg text-[10px] font-black text-white px-2"
                              />
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Qty</span>
                            </div>
                          </div>
                          {!isGuest && (
                            <button onClick={() => removeComboItem(item.id)} className="text-red-500/50 hover:text-red-500 p-2">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Select Instagram Service</label>
                      <Select onValueChange={setSelectedServiceId} value={selectedServiceId}>
                        <SelectTrigger className="h-14 bg-white/5 border-white/5 rounded-2xl font-bold text-sm text-white px-5 focus:ring-[#312ECB]">
                          <SelectValue placeholder="Pick a service..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#030712] border-white/10 rounded-2xl">
                          {activeServices.map(s => (
                            <SelectItem key={s.id} value={s.id} className="text-sm font-bold p-4 focus:bg-[#312ECB] text-white">
                              {s.name} (₹{s.pricePer1000}/1k)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">
                        Quantity {selectedService ? `(Min: ${selectedService.minQuantity})` : ''}
                      </label>
                      <Input 
                        type="number" 
                        disabled={isGuest}
                        placeholder={isGuest ? "Login to enter quantity" : "Enter amount..."}
                        value={quantity} 
                        onChange={(e) => setQuantity(e.target.value)}
                        className="h-14 bg-white/5 border-white/5 rounded-2xl px-5 text-base font-black text-white focus-visible:ring-[#312ECB]"
                      />
                    </div>
                  </>
                )}

                {/* Target Links */}
                {orderType === 'bulk' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Target Links ({bulkLinks.length})</label>
                    <div className="flex gap-2">
                      <Input 
                        disabled={isGuest}
                        placeholder={isGuest ? "Login to add links" : "Add multiple links..."} 
                        value={currentBulkLink} 
                        onChange={(e) => setCurrentBulkLink(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addBulkLink()}
                        className="h-14 bg-white/5 border-white/5 rounded-2xl px-5 text-sm font-bold text-white flex-1"
                      />
                      <Button onClick={addBulkLink} disabled={isGuest} size="icon" className="h-14 w-14 rounded-2xl bg-[#312ECB] shadow-lg shrink-0">
                        <Plus size={24} />
                      </Button>
                    </div>
                    {bulkLinks.length > 0 && (
                      <div className="bg-white/5 rounded-2xl p-3 space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {bulkLinks.map((l, i) => (
                          <div key={i} className="flex items-center justify-between bg-white/5 p-2 rounded-lg group">
                            <span className="text-[10px] font-bold text-slate-400 truncate flex-1">{l}</span>
                            {!isGuest && (
                              <button onClick={() => setBulkLinks(bulkLinks.filter((_, idx) => idx !== i))} className="text-red-500/50 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
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
                        disabled={isGuest}
                        placeholder={isGuest ? "Login to enter link" : "Paste link here..."} 
                        value={targetLink} 
                        onChange={(e) => setTargetLink(e.target.value)}
                        className="h-14 bg-white/5 border-white/5 rounded-2xl pl-12 text-sm font-bold text-white focus-visible:ring-[#312ECB]"
                      />
                    </div>
                  </div>
                )}

                <Button 
                  disabled={
                    !isGuest && (
                      (orderType === 'combo' && comboItems.length === 0) || 
                      (orderType === 'single' && (!selectedService || !quantity || !targetLink)) ||
                      (orderType === 'bulk' && (!selectedService || !quantity || bulkLinks.length === 0))
                    )
                  }
                  onClick={() => isGuest ? router.push('/') : setCheckoutStep('summary')}
                  className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl mt-4"
                >
                  {isGuest ? "Login to Place Order" : "Confirm Selection"}
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
                  <h3 className="text-base font-black uppercase text-white tracking-tight">
                    {orderType === 'combo' ? 'Combo Pack' : selectedService?.name}
                  </h3>
                  <Badge className="bg-[#312ECB]/10 text-[#312ECB] border-none font-black text-[9px] uppercase px-3 mt-1">
                    {orderType === 'combo' ? `${comboItems.length} Services` : `Qty: ${quantity}`}
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

      {/* Notifications Drawer */}
      <Dialog open={isNotifOpen} onOpenChange={setIsNotifOpen}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-2xl bg-slate-950 p-0 overflow-hidden">
          <header className="bg-[#312ECB] p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={20} />
              <DialogTitle className="font-black uppercase text-sm tracking-widest">Inbox</DialogTitle>
            </div>
            <button onClick={() => setIsNotifOpen(false)}><X size={20} /></button>
          </header>
          <ScrollArea className="h-[400px] p-5">
            {notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map((n) => (
                  <div key={n.id} className={cn("p-4 rounded-[1.5rem] border transition-all", n.read ? "bg-slate-900/50 border-white/5" : "bg-white/5 border-[#312ECB]/20 shadow-lg")}>
                    <h4 className="text-[11px] font-black text-[#312ECB] uppercase mb-1">{n.title}</h4>
                    <p className="text-[10px] font-bold text-slate-300 leading-relaxed">{n.message}</p>
                    <p className="text-[7px] font-black text-slate-500 uppercase mt-2">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 opacity-30">
                <Bell size={48} className="mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">No new updates</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
