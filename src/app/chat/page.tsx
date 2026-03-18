
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
  getDoc
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
  LogIn,
  ChevronRight,
  Clock,
  Layers,
  Moon,
  Sun,
  ArrowRight,
  Instagram,
  PlusCircle,
  Download,
  MessageCircle,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { SMMService } from "@/app/lib/constants";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { placeApiOrder } from "@/app/actions/smm-api";

export default function DashboardPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [orderType, setOrderType] = useState<'single' | 'bulk' | 'combo' | 'drip'>('single');
  
  // States
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [targetLink, setTargetLink] = useState<string>("");
  
  // Bulk States
  const [bulkLinks, setBulkLinks] = useState<string[]>([]);
  const [currentBulkLink, setCurrentBulkLink] = useState("");
  
  // Combo State
  const [comboItems, setComboItems] = useState<{serviceId: string, qty: string}[]>([]);
  
  // Drip-Feed State
  const [batchQty, setBatchQty] = useState<string>("");
  const [interval, setInterval] = useState<string>("15");
  
  // Checkout State
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'summary' | 'payment'>('form');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [utrId, setUtrId] = useState("");
  
  // Success State
  const [lastPlacedOrder, setLastPlacedOrder] = useState<any>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Global Settings
  const [globalDiscounts, setGlobalDiscounts] = useState({ single: 0, bulk: 0, combo: 0, drip: 0 });
  const [globalBonus, setGlobalBonus] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // Theme Toggle
  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) html.classList.add('dark');
    else html.classList.remove('dark');
  }, [isDarkMode]);

  // Fetch Services
  const servicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db]);
  const { data: rawServices } = useCollection<SMMService>(servicesQuery);
  const activeServices = useMemo(() => (rawServices || []).filter(s => s.isActive !== false && s.platform === 'instagram'), [rawServices]);
  
  // User Data
  const userDocRef = useMemoFirebase(() => currentUser && db ? doc(db, "users", currentUser.uid) : null, [db, currentUser]);
  const { data: userData } = useDoc(userDocRef);
  const walletBalance = userData?.balance || 0;

  useEffect(() => {
    if (!db) return;
    const unsubDiscounts = onSnapshot(doc(db, "globalSettings", "discounts"), (snap) => {
      if (snap.exists()) setGlobalDiscounts({ 
        single: snap.data().single || 0, 
        bulk: snap.data().bulk || 0, 
        combo: snap.data().combo || 0, 
        drip: snap.data().drip || snap.data().single || 0 
      });
    });

    const unsubFinance = onSnapshot(doc(db, "globalSettings", "finance"), (snap) => {
      if (snap.exists()) setGlobalBonus(snap.data().bonusPercentage || 0);
    });
    
    let unsubNotif = () => {};
    if (currentUser) {
      const qNotif = query(collection(db, "users", currentUser.uid, "notifications"), orderBy("createdAt", "desc"));
      unsubNotif = onSnapshot(qNotif, (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    return () => { unsubDiscounts(); unsubFinance(); unsubNotif(); };
  }, [db, currentUser]);

  const selectedService = useMemo(() => activeServices.find(s => s.id === selectedServiceId), [activeServices, selectedServiceId]);
  const currentDiscount = globalDiscounts[orderType] || 0;

  const calcPrices = () => {
    let raw = 0;
    if (orderType === 'combo') {
      raw = comboItems.reduce((acc, item) => {
        const s = activeServices.find(srv => srv.id === item.serviceId);
        const q = parseInt(item.qty) || 0;
        return acc + ((q / 1000) * (s?.pricePer1000 || 0));
      }, 0);
    } else if (orderType === 'bulk') {
      const linksCount = bulkLinks.length;
      const qty = parseInt(quantity) || 0;
      const rate = selectedService?.pricePer1000 || 0;
      raw = (qty / 1000) * rate * Math.max(1, linksCount);
    } else {
      const qty = parseInt(quantity) || 0;
      const rate = selectedService?.pricePer1000 || 0;
      raw = (qty / 1000) * rate;
    }
    
    const final = raw * (1 - currentDiscount / 100);
    return { raw, final, savings: raw - final };
  };

  const { raw: rawPrice, final: finalPrice, savings } = calcPrices();

  const upiId = "smmxpressbot@slc";
  const finalQrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=SocialBoost&am=${finalPrice.toFixed(2)}&cu=INR`)}&size=400&margin=1&format=png`;

  const handleDownloadQR = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(finalQrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SocialBoost_Pay_₹${finalPrice.toFixed(0)}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "QR Saved to Gallery!" });
    } catch (e) { 
      window.open(finalQrUrl, '_blank'); 
    } finally { 
      setIsDownloading(false); 
    }
  };

  const handlePlaceOrder = async () => {
    if (!currentUser || !db) return;
    setIsProcessing(true);
    const orderId = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
    
    let linksArr = orderType === 'bulk' ? bulkLinks : [targetLink];
    
    try {
      let apiOrderId = "";
      let apiProviderId = "";

      if (paymentMethod === 'wallet') {
        if (walletBalance < finalPrice) { 
          toast({ variant: "destructive", title: "Low Balance" }); 
          setIsProcessing(false); 
          return; 
        }

        if (orderType !== 'combo') {
          const apiSettingsSnap = await getDoc(doc(db, "globalSettings", "api"));
          const apiSettings = apiSettingsSnap.data();
          const mapping = apiSettings?.mappings?.[selectedServiceId];

          if (mapping?.providerId && mapping?.remoteServiceId) {
            const provider = apiSettings.providers?.find((p: any) => p.id === mapping.providerId);
            if (provider?.url && provider?.key) {
              const apiResult = await placeApiOrder({
                apiUrl: provider.url, 
                apiKey: provider.key, 
                serviceId: mapping.remoteServiceId,
                link: linksArr[0], 
                quantity: parseInt(quantity),
                runs: orderType === 'drip' ? Math.ceil(parseInt(quantity) / (parseInt(batchQty) || 1)) : 1,
                interval: orderType === 'drip' ? parseInt(interval) : 0
              });

              if (apiResult.success) { 
                apiOrderId = apiResult.order?.toString() || ""; 
                apiProviderId = provider.id; 
              } else { 
                toast({ variant: "destructive", title: "API Panel Error", description: apiResult.error }); 
                setIsProcessing(false); 
                return; 
              }
            }
          }
        }
      }

      const batch = writeBatch(db);
      if (paymentMethod === 'wallet') batch.update(doc(db, "users", currentUser.uid), { balance: increment(-finalPrice) });
      
      const orderData = {
        orderId, 
        service: orderType === 'combo' ? 'Combo Pack' : selectedService?.name, 
        quantity: orderType === 'combo' ? comboItems.reduce((a, b) => a + (parseInt(b.qty) || 0), 0) : parseInt(quantity), 
        price: finalPrice,
        status: paymentMethod === 'wallet' ? (apiOrderId ? 'Processing' : 'Pending') : 'Pending', 
        type: paymentMethod === 'wallet' && apiOrderId ? 'API' : 'Manual',
        links: linksArr, 
        utrId: paymentMethod === 'upi' ? utrId : "", 
        platform: 'instagram', 
        createdAt: serverTimestamp(),
        autoCompleteAt: Timestamp.fromDate(new Date(Date.now() + 45 * 60 * 1000)),
        isDripFeed: orderType === 'drip', 
        apiOrderId, 
        providerId: apiProviderId,
        comboDetails: orderType === 'combo' ? comboItems : null
      };

      batch.set(doc(collection(db, "users", currentUser.uid, "orders")), orderData);

      await batch.commit();
      
      setLastPlacedOrder(orderData);
      setShowSuccessDialog(true);
      
      // Reset form
      setCheckoutStep('form');
      setTargetLink("");
      setQuantity("");
      setBulkLinks([]);
      setUtrId("");
      setPaymentMethod(null);

    } catch (e) { 
      toast({ variant: "destructive", title: "Order Placement Failed" }); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleWhatsAppConfirm = () => {
    if (!lastPlacedOrder) return;
    const adminNumber = "919116399517";
    const serviceName = lastPlacedOrder.service;
    const links = lastPlacedOrder.links?.join(', ');
    const qty = lastPlacedOrder.quantity;
    const utr = lastPlacedOrder.utrId || 'Wallet Payment';
    const id = lastPlacedOrder.orderId;

    const message = `🚀 *NEW ORDER PLACED!*\n\n🆔 *Order ID:* ${id}\n📊 *Service:* ${serviceName}\n🔢 *Quantity:* ${qty}\n🔗 *Target:* ${links}\n💳 *UTR ID:* ${utr}\n💰 *Price:* ₹${lastPlacedOrder.price.toFixed(2)}\n\nKripya order verify karke start karein. Dhanyawad!`;
    
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

  const addComboItem = () => {
    const firstService = activeServices[0];
    if (firstService) setComboItems([...comboItems, { serviceId: firstService.id, qty: "" }]);
  };

  const removeComboItem = (index: number) => setComboItems(comboItems.filter((_, i) => i !== index));
  const updateComboItem = (index: number, updates: Partial<{serviceId: string, qty: string}>) => {
    setComboItems(comboItems.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background text-foreground font-body pb-24 overflow-x-hidden transition-colors duration-300">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <ShoppingCart size={20} className="fill-current" />
          </div>
          <div>
            <h1 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/60 leading-none">SocialBoost Pro</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-base font-black italic tracking-tighter text-foreground">SMM ORDER PANEL</p>
              {globalBonus > 0 && <Badge className="bg-emerald-500 text-white border-none text-[7px] font-black animate-pulse h-4 px-1.5">{globalBonus}% BONUS</Badge>}
            </div>
            
            {currentUser && (
              <button 
                onClick={() => router.push('/add-funds')}
                className="flex items-center gap-1.5 mt-1 hover:opacity-80 transition-opacity"
              >
                <span className="text-[10px] font-black text-primary uppercase">Wallet: ₹{walletBalance.toFixed(2)}</span>
                <div className="w-4 h-4 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Plus size={10} />
                </div>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-secondary rounded-xl border border-border text-foreground hover:bg-muted transition-all">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {!isUserLoading && currentUser && (
            <button onClick={() => setIsNotifOpen(true)} className="relative p-2.5 bg-secondary rounded-xl border border-border text-foreground hover:bg-muted transition-all">
              <Bell size={18} />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-background">{unreadCount}</span>}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-6">
        {checkoutStep === 'form' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Package size={18} /></div>
                <h2 className="text-lg font-black uppercase tracking-tight">Place New Order</h2>
              </div>
              <button onClick={() => router.push('/orders')} className="p-2.5 bg-secondary rounded-xl border border-border text-muted-foreground hover:text-primary transition-all">
                <History size={18} />
              </button>
            </div>

            <div className="bg-card rounded-[2.5rem] p-8 border border-border shadow-2xl space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Select Mode</label>
                <Tabs defaultValue="single" value={orderType} onValueChange={(v) => setOrderType(v as any)} className="w-full">
                  <TabsList className="bg-input border border-border w-full h-14 rounded-2xl p-1 gap-1">
                    <TabsTrigger value="single" className="flex-1 rounded-xl font-black text-[9px] uppercase data-[state=active]:bg-primary data-[state=active]:text-white">Single</TabsTrigger>
                    <TabsTrigger value="bulk" className="flex-1 rounded-xl font-black text-[9px] uppercase data-[state=active]:bg-primary data-[state=active]:text-white">Bulk</TabsTrigger>
                    <TabsTrigger value="combo" className="flex-1 rounded-xl font-black text-[9px] uppercase data-[state=active]:bg-primary data-[state=active]:text-white">Combo</TabsTrigger>
                    <TabsTrigger value="drip" className="flex-1 rounded-xl font-black text-[9px] uppercase data-[state=active]:bg-primary data-[state=active]:text-white">Drip</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {orderType !== 'combo' ? (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Select Service</label>
                  <Select onValueChange={setSelectedServiceId} value={selectedServiceId}>
                    <SelectTrigger className="h-16 bg-input border-border rounded-2xl font-bold text-sm px-6 focus:ring-primary shadow-inner">
                      <SelectValue placeholder="Select SMM Service..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border rounded-2xl">
                      {activeServices.map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-sm font-bold p-4 focus:bg-primary focus:text-white">{s.name} (₹{s.pricePer1000}/1k)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Combo Services</label>
                    <Button onClick={addComboItem} variant="ghost" className="h-8 text-[9px] font-black text-primary uppercase gap-1.5"><PlusCircle size={14} /> Add Service</Button>
                  </div>
                  <div className="space-y-3">
                    {comboItems.map((item, idx) => (
                      <div key={idx} className="bg-input/50 p-4 rounded-2xl border border-border space-y-3 relative">
                        <button onClick={() => removeComboItem(idx)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"><X size={14} /></button>
                        <Select value={item.serviceId} onValueChange={(val) => updateComboItem(idx, { serviceId: val })}>
                          <SelectTrigger className="h-10 bg-background border-border rounded-xl text-[11px] font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-card">{activeServices.map(s => <SelectItem key={s.id} value={s.id} className="text-xs font-bold">{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input placeholder="Quantity" type="number" value={item.qty} onChange={(e) => updateComboItem(idx, { qty: e.target.value })} className="h-10 bg-background border-none rounded-xl text-xs font-bold" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">
                  {orderType === 'bulk' ? 'Target Links' : 'Target Link'}
                </label>
                {orderType === 'bulk' ? (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input placeholder="Add target link" value={currentBulkLink} onChange={(e) => setCurrentBulkLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBulkLink()} className="h-14 bg-input border-none rounded-xl text-sm font-bold shadow-inner" />
                      <Button onClick={addBulkLink} className="h-14 w-14 bg-primary text-white rounded-xl"><Plus size={20} /></Button>
                    </div>
                    {bulkLinks.length > 0 && (
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        {bulkLinks.map((link, idx) => (
                          <div key={idx} className="bg-input p-3 rounded-xl flex items-center justify-between border border-border group animate-in slide-in-from-left-2">
                            <span className="text-[10px] font-bold truncate max-w-[200px]">{link}</span>
                            <button onClick={() => removeBulkLink(idx)} className="text-destructive opacity-50 group-hover:opacity-100"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground"><Instagram size={20} /></div>
                    <Input placeholder="Post or Profile URL" value={targetLink} onChange={(e) => setTargetLink(e.target.value)} className="h-16 bg-input border-none rounded-2xl pl-16 pr-6 text-sm font-bold shadow-inner" />
                  </div>
                )}
              </div>

              {orderType !== 'combo' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Quantity</label>
                    <Input type="number" placeholder="Ex: 1000" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-16 bg-input border-none rounded-2xl px-6 text-sm font-black shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Total Price</label>
                    <div className="h-16 bg-primary/5 border-2 border-dashed border-primary/30 rounded-2xl flex items-center justify-center"><span className="text-xl font-black text-primary">₹{finalPrice.toFixed(2)}</span></div>
                  </div>
                </div>
              )}

              {orderType === 'drip' && (
                <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 space-y-4">
                  <div className="flex items-center gap-2 mb-2"><Clock size={16} className="text-primary" /><span className="text-[10px] font-black uppercase tracking-widest">Drip Options</span></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[8px] font-black uppercase text-muted-foreground">Batch Qty</label><Input type="number" value={batchQty} onChange={(e) => setBatchQty(e.target.value)} className="h-12 bg-background border-none rounded-xl" placeholder="e.g. 100" /></div>
                    <div className="space-y-2"><label className="text-[8px] font-black uppercase text-muted-foreground">Interval (Min)</label><Input type="number" value={interval} onChange={(e) => setInterval(e.target.value)} className="h-12 bg-background border-none rounded-xl" /></div>
                  </div>
                </div>
              )}

              <Button 
                disabled={isProcessing || (orderType === 'bulk' && bulkLinks.length === 0) || (orderType !== 'bulk' && orderType !== 'combo' && (!selectedServiceId || !quantity || !targetLink)) || (orderType === 'combo' && comboItems.length === 0)}
                onClick={() => currentUser ? setCheckoutStep('summary') : router.push('/')}
                className="w-full h-16 bg-primary hover:bg-primary/90 text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl gap-3 group"
              >
                {currentUser ? "Confirm Order Details" : "Login to Place Order"}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {checkoutStep === 'summary' && (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
            <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
              <div className="flex items-center gap-4 border-b border-border pb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary"><Package size={28} /></div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">{orderType === 'combo' ? 'Combo Multi-Service' : selectedService?.name}</h3>
                  <Badge className="bg-primary/10 text-primary border-none font-black text-[9px] uppercase px-3 mt-1">
                    {orderType === 'bulk' ? `Links: ${bulkLinks.length}` : `QTY: ${quantity || 'Combo'}`}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1"><span className="text-[11px] font-black text-muted-foreground uppercase">Market Rate</span><span className="text-sm font-bold">₹{rawPrice.toFixed(2)}</span></div>
                <div className="flex justify-between items-center px-1"><div className="flex items-center gap-2"><TrendingDown size={18} className="text-emerald-500" /><span className="text-[11px] font-black text-emerald-500 uppercase">Discount ({currentDiscount}%)</span></div><span className="text-sm font-black text-emerald-500">- ₹{savings.toFixed(2)}</span></div>
                <div className="pt-6 border-t border-border flex justify-between items-center px-1"><span className="text-[13px] font-black uppercase tracking-[0.2em]">Payable</span><span className="text-3xl font-black text-primary italic">₹{finalPrice.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button 
                onClick={() => { setPaymentMethod('wallet'); handlePlaceOrder(); }}
                disabled={isProcessing || walletBalance < finalPrice}
                className={cn("h-16 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl gap-3", walletBalance >= finalPrice ? "bg-emerald-500 text-white" : "bg-destructive/10 text-destructive border border-destructive/20")}
              >
                {isProcessing && paymentMethod === 'wallet' ? <Loader2 className="animate-spin" /> : <Wallet size={20} />}
                {walletBalance >= finalPrice ? "Pay from Wallet Balance" : "Insufficient Wallet Balance"}
              </Button>

              {orderType !== 'drip' && (
                <Button onClick={() => { setPaymentMethod('upi'); setCheckoutStep('payment'); }} disabled={isProcessing} variant="outline" className="h-16 border-border bg-card text-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl gap-3">
                  <QrCode size={20} className="text-primary" /> Pay via UPI / QR Code
                </Button>
              )}

              <button onClick={() => setCheckoutStep('form')} className="text-center py-4 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cancel & Change Order</button>
            </div>
          </div>
        )}

        {checkoutStep === 'payment' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-card border border-border rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl">
              <div className="bg-white p-4 rounded-[2rem] inline-block shadow-lg relative group">
                <img src={finalQrUrl} alt="Payment QR" className="w-48 h-48" />
                <button 
                  onClick={handleDownloadQR}
                  disabled={isDownloading}
                  className="absolute bottom-2 right-2 p-2 bg-primary text-white rounded-full shadow-lg active:scale-90 transition-transform"
                >
                  {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                </button>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Scan or Save to Pay</p>
                <h2 className="text-3xl font-black text-foreground italic">₹{finalPrice.toFixed(2)}</h2>
                <Button onClick={handleDownloadQR} variant="ghost" className="text-[9px] font-black text-primary uppercase gap-2">
                  <Download size={14} /> Download QR Code
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-destructive animate-pulse">Sahi UTR ID dalo varna verify nahi hoga</label>
                <Input placeholder="Enter 12-Digit UTR ID" maxLength={12} value={utrId} onChange={(e) => setUtrId(e.target.value.replace(/[^0-9]/g, ''))} className="h-14 bg-input border-none rounded-2xl text-center text-lg font-black tracking-[0.3em] focus-visible:ring-emerald-500 shadow-inner" />
              </div>
            </div>
            
            <Button onClick={handlePlaceOrder} disabled={isProcessing || utrId.length !== 12} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl gap-3">
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
              Verify & Complete Order
            </Button>
            <button onClick={() => setCheckoutStep('summary')} className="w-full text-center py-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Back to Summary</button>
          </div>
        )}
      </main>

      {/* Notifications Drawer */}
      <Dialog open={isNotifOpen} onOpenChange={setIsNotifOpen}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-2xl bg-card p-0 overflow-hidden">
          <header className="bg-primary p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3"><Bell size={20} /><DialogTitle className="font-black uppercase text-sm tracking-widest">Inbox</DialogTitle></div>
            <button onClick={() => setIsNotifOpen(false)}><X size={20} /></button>
          </header>
          <ScrollArea className="h-[400px] p-5">
            {notifications.length > 0 ? (
              <div className="space-y-4">
                {notifications.map((n) => (
                  <div key={n.id} className={cn("p-4 rounded-[1.5rem] border transition-all", n.read ? "bg-muted/50 border-border" : "bg-primary/5 border-primary/20 shadow-lg")}>
                    <h4 className="text-[11px] font-black text-primary uppercase mb-1">{n.title}</h4>
                    <p className="text-[10px] font-bold text-foreground/80 leading-relaxed">{n.message}</p>
                    <p className="text-[7px] font-black text-muted-foreground uppercase mt-2">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : 'Just now'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 opacity-30"><Bell size={48} className="mb-3 text-muted-foreground" /><p className="text-[10px] font-black uppercase tracking-widest">No new updates</p></div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-[340px] rounded-[2.5rem] border-none shadow-2xl bg-card p-0 overflow-hidden">
          <div className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={48} className="text-emerald-500 animate-in zoom-in-50 duration-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight">Order Placed!</h2>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Aapka order line mein hai.</p>
            </div>

            <div className="bg-muted/50 rounded-[2rem] p-5 border border-border space-y-3.5 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-muted-foreground uppercase">Order ID</span>
                <span className="text-xs font-black text-primary">#{lastPlacedOrder?.orderId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-muted-foreground uppercase">Service</span>
                <span className="text-xs font-bold truncate max-w-[120px]">{lastPlacedOrder?.service}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-muted-foreground uppercase">Quantity</span>
                <span className="text-xs font-bold">{lastPlacedOrder?.quantity}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[9px] font-black text-muted-foreground uppercase block mb-1">Target Link</span>
                <p className="text-[10px] font-medium break-all text-foreground opacity-80 leading-relaxed">
                  {lastPlacedOrder?.links?.[0]}
                  {lastPlacedOrder?.links?.length > 1 && ` (+${lastPlacedOrder.links.length - 1} more)`}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button 
                onClick={handleWhatsAppConfirm}
                className="w-full h-14 bg-[#25D366] hover:bg-[#1EBE57] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl gap-3 animate-pulse"
              >
                <MessageCircle size={20} /> SEND ADMIN CONFIRMATION
              </Button>
              <button 
                onClick={() => setShowSuccessDialog(false)}
                className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] py-2"
              >
                Close & Go Back
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
