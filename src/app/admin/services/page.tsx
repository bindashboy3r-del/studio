
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Layers, 
  Instagram, 
  DollarSign, 
  Hash,
  Zap,
  Loader2,
  Globe,
  Youtube,
  Facebook,
  Twitter,
  LayoutGrid,
  ChevronDown,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy,
  writeBatch,
  getDocs,
  where
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PLATFORMS, Platform, SMMService } from "@/app/lib/constants";
import { cn } from "@/lib/utils";

const DEFAULT_SERVICES: SMMService[] = [
  { id: 'ig_followers', name: 'Followers', platform: 'instagram', pricePer1000: 89, minQuantity: 100, order: 1, isActive: true },
  { id: 'ig_likes', name: 'Likes', platform: 'instagram', pricePer1000: 18, minQuantity: 100, order: 2, isActive: true },
  { id: 'ig_views', name: 'Views', platform: 'instagram', pricePer1000: 0.60, minQuantity: 500, order: 3, isActive: true },
];

export default function ServiceManagerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const ADMIN_UID = "s55uL0f8PmcypR75usVYOLwVs7O2";
  const isActuallyAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || user?.uid === ADMIN_UID;

  const servicesQuery = useMemoFirebase(() => {
    if (!db || !isActuallyAdmin) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db, isActuallyAdmin]);

  const { data: services, isLoading: isServicesLoading } = useCollection<SMMService>(servicesQuery);

  const groupedServices = useMemo(() => {
    if (!services) return {};
    const groups: Record<string, SMMService[]> = {};
    services.forEach(s => {
      const p = s.platform || 'other';
      if (!groups[p]) groups[p] = [];
      groups[p].push(s);
    });
    return groups;
  }, [services]);

  const activePlatforms = Object.keys(groupedServices) as Platform[];

  const [isAdding, setIsAdding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  
  const [newService, setNewService] = useState<Partial<SMMService>>({
    id: "",
    name: "",
    platform: 'instagram',
    isActive: true,
    pricePer1000: 0,
    minQuantity: 100,
    order: 0
  });

  useEffect(() => {
    if (!isUserLoading && (!user || !isActuallyAdmin)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, isActuallyAdmin, router]);

  const handleSeedDefaults = async () => {
    if (!db || !isActuallyAdmin) return;
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      DEFAULT_SERVICES.forEach(s => {
        const ref = doc(db, "services", s.id);
        batch.set(ref, { ...s, updatedAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit();
      toast({ title: "Defaults Loaded", description: "Categories populated successfully." });
    } catch (e) {
      toast({ variant: "destructive", title: "Seed Failed" });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddService = () => {
    if (!db || !newService.name || !newService.id || !isActuallyAdmin) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Name and ID are required." });
      return;
    }

    const docId = newService.id.toLowerCase().replace(/\s+/g, '_');
    const docRef = doc(db, "services", docId);
    const data = {
      ...newService,
      id: docId,
      order: Number(newService.order) || (services?.length || 0) + 1,
      updatedAt: serverTimestamp()
    };

    setDoc(docRef, data)
      .then(() => {
        toast({ title: "Service Added", description: `${newService.name} is now live.` });
        setIsAdding(false);
        setNewService({ id: "", name: "", platform: 'instagram', isActive: true, pricePer1000: 0, minQuantity: 100, order: (services?.length || 0) + 1 });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: data
        }));
      });
  };

  const handleDeleteCategory = async (platform: string) => {
    if (!db || !isActuallyAdmin) return;
    setDeletingCategory(platform);
    
    try {
      const q = query(collection(db, "services"), where("platform", "==", platform));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast({ title: "Category Deleted", description: `All services under ${PLATFORMS[platform as Platform]} removed.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Deletion Failed" });
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleUpdateField = (service: SMMService, field: keyof SMMService, value: any) => {
    if (!db || !isActuallyAdmin) return;
    const docRef = doc(db, "services", service.id);
    setDoc(docRef, { [field]: value }, { merge: true });
  };

  const handleDeleteService = (id: string) => {
    if (!db || !isActuallyAdmin || deletingId) return;
    setDeletingId(id);
    deleteDoc(doc(db, "services", id))
      .then(() => toast({ title: "Deleted" }))
      .finally(() => setDeletingId(null));
  };

  const getPlatformIcon = (platform: Platform) => {
    switch(platform) {
      case 'instagram': return <Instagram size={20} className="text-pink-500" />;
      case 'youtube': return <Youtube size={20} className="text-red-600" />;
      case 'facebook': return <Facebook size={20} className="text-blue-600" />;
      case 'twitter': return <Twitter size={20} className="text-sky-500" />;
      default: return <Globe size={20} className="text-slate-400" />;
    }
  };

  if (isUserLoading || (!user && !isUserLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-[#312ECB]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-body pb-20">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft size={20} /></button>
          <h1 className="text-lg font-black tracking-tight text-[#111B21] uppercase">Category Hub</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSeedDefaults} disabled={isSeeding} className="rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest gap-2 border-blue-100 text-[#312ECB]">
            <Zap size={14} className={isSeeding ? "animate-pulse" : ""} /> Defaults
          </Button>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
                <Plus size={16} /> New Service
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 bg-white">
              <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-slate-900"><Layers className="text-[#312ECB]" /> Add New Service</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Category</label>
                  <Select value={newService.platform} onValueChange={(val: Platform) => setNewService({...newService, platform: val})}>
                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold"><SelectValue placeholder="Pick Category" /></SelectTrigger>
                    <SelectContent>{Object.entries(PLATFORMS).map(([val, label]) => (<SelectItem key={val} value={val}>{label}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input placeholder="Service ID (e.g. ig_followers)" value={newService.id || ""} onChange={e => setNewService({...newService, id: e.target.value})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                  <Input type="number" placeholder="Position" value={newService.order || ""} onChange={e => setNewService({...newService, order: parseInt(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
                <Input placeholder="Display Name" value={newService.name || ""} onChange={e => setNewService({...newService, name: e.target.value})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                <div className="grid grid-cols-2 gap-4">
                  <Input type="number" placeholder="Price per 1k" value={newService.pricePer1000 || ""} onChange={e => setNewService({...newService, pricePer1000: parseFloat(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                  <Input type="number" placeholder="Min Qty" value={newService.minQuantity || ""} onChange={e => setNewService({...newService, minQuantity: parseInt(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
              </div>
              <DialogFooter><Button onClick={handleAddService} className="w-full h-14 bg-[#312ECB] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg">Save & Activate</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {activePlatforms.length > 0 ? (
          <Accordion type="single" collapsible className="space-y-4">
            {activePlatforms.sort().map(platform => (
              <AccordionItem key={platform} value={platform} className="border-none">
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                  <AccordionTrigger className="px-6 py-5 hover:no-underline group">
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shadow-inner group-data-[state=open]:bg-blue-50">
                        {getPlatformIcon(platform)}
                      </div>
                      <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">{PLATFORMS[platform]} Category</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupedServices[platform].length} Services Managed</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2">
                    <div className="space-y-3">
                      {groupedServices[platform].sort((a, b) => (a.order || 0) - (b.order || 0)).map((service) => (
                        <div key={service.id} className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 flex flex-col md:flex-row md:items-center gap-4 group/item">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-black text-slate-800">{service.name}</span>
                              <Badge variant="outline" className="text-[7px] uppercase opacity-40 border-slate-200">#{service.order}</Badge>
                            </div>
                            <code className="text-[8px] font-bold text-slate-400 uppercase">{service.id}</code>
                          </div>
                          
                          <div className="grid grid-cols-2 md:flex items-center gap-3">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-[10px]">₹</span>
                              <Input 
                                type="number" 
                                defaultValue={service.pricePer1000} 
                                onBlur={(e) => handleUpdateField(service, 'pricePer1000', parseFloat(e.target.value))}
                                className="h-9 w-20 bg-white border-none rounded-xl pl-6 text-xs font-black shadow-sm" 
                              />
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-[10px]">#</span>
                              <Input 
                                type="number" 
                                defaultValue={service.minQuantity} 
                                onBlur={(e) => handleUpdateField(service, 'minQuantity', parseInt(e.target.value))}
                                className="h-9 w-20 bg-white border-none rounded-xl pl-6 text-xs font-black shadow-sm" 
                              />
                            </div>
                            <button onClick={() => handleDeleteService(service.id)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                              {deletingId === service.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="pt-4 border-t border-slate-100 mt-4 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-red-400">
                          <AlertTriangle size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Danger Zone</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteCategory(platform)}
                          disabled={deletingCategory === platform}
                          className="text-red-500 hover:bg-red-50 font-black text-[9px] uppercase tracking-[0.2em] rounded-xl h-9"
                        >
                          {deletingCategory === platform ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} className="mr-2" />}
                          Delete Category
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        ) : !isServicesLoading && (
          <div className="py-24 text-center space-y-6">
            <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto shadow-sm border border-slate-100">
              <LayoutGrid size={40} className="text-slate-200" />
            </div>
            <p className="text-[13px] font-black text-slate-400 uppercase tracking-[0.2em]">No Active Categories Found</p>
            <Button onClick={handleSeedDefaults} variant="link" className="text-[#312ECB] font-black text-[11px] uppercase underline-offset-4">Load Standard Platforms</Button>
          </div>
        )}
      </main>
    </div>
  );
}
