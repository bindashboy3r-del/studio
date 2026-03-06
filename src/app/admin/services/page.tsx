
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
  Zap,
  Loader2,
  Globe,
  Youtube,
  Facebook,
  Twitter,
  LayoutGrid,
  AlertTriangle,
  PlusCircle,
  X
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
  where,
  onSnapshot
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PLATFORMS, Platform, SMMService } from "@/app/lib/constants";
import { cn } from "@/lib/utils";

export default function ServiceManagerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [enabledCategories, setEnabledCategories] = useState<Platform[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
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

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const ADMIN_UID = "s55uL0f8PmcypR75usVYOLwVs7O2";
  const isActuallyAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || user?.uid === ADMIN_UID;

  useEffect(() => {
    if (!db || !isActuallyAdmin) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "categories"), (snap) => {
      if (snap.exists()) {
        setEnabledCategories(snap.data().list || []);
      } else {
        setEnabledCategories(['instagram']);
      }
    });
    return () => unsub();
  }, [db, isActuallyAdmin]);

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

  useEffect(() => {
    if (!isUserLoading && (!user || !isActuallyAdmin)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, isActuallyAdmin, router]);

  const handleAddCategory = async (platform: Platform) => {
    if (!db || !isActuallyAdmin) return;
    const newList = Array.from(new Set([...enabledCategories, platform]));
    try {
      await setDoc(doc(db, "globalSettings", "categories"), { list: newList }, { merge: true });
      toast({ title: "Category Added", description: `${PLATFORMS[platform] || platform} is now active.` });
      setIsAddingCategory(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to add category" });
    }
  };

  const handleDeleteCategory = async (platform: string) => {
    if (!db || !isActuallyAdmin) return;
    const platformLabel = PLATFORMS[platform as Platform] || platform;
    if (!confirm(`Are you sure? This will delete all services in ${platformLabel}.`)) return;
    
    setDeletingCategory(platform);
    
    try {
      const newList = enabledCategories.filter(p => p !== platform);
      await setDoc(doc(db, "globalSettings", "categories"), { list: newList });

      const q = query(collection(db, "services"), where("platform", "==", platform));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      toast({ title: "Category Deleted", description: `Removed ${platformLabel} and all its services.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Deletion Failed", description: e.message || "Database error." });
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleAddService = () => {
    if (!db || !newService.name || !newService.id || !isActuallyAdmin) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Name and ID are required." });
      return;
    }

    const platform = newService.platform || 'other';
    const cleanIdInput = newService.id.toLowerCase().replace(/\s+/g, '_');
    const finalDocId = `${platform}_${cleanIdInput}`;
    
    const docRef = doc(db, "services", finalDocId);
    const data = {
      ...newService,
      id: finalDocId,
      platform: platform,
      order: Number(newService.order) || (services?.length || 0) + 1,
      updatedAt: serverTimestamp()
    };

    setDoc(docRef, data)
      .then(() => {
        toast({ title: "Service Added", description: `${newService.name} is now live.` });
        setIsAddingService(false);
        setNewService({ id: "", name: "", platform: platform as Platform, isActive: true, pricePer1000: 0, minQuantity: 100, order: (services?.length || 0) + 1 });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: data
        }));
      });
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
    <div className="min-h-screen bg-slate-50 font-body pb-20 text-slate-950">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft size={20} /></button>
          <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">Category Hub</h1>
        </div>
        <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
          <DialogTrigger asChild>
            <Button className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
              <PlusCircle size={16} /> New Category
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 bg-white text-slate-950">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-slate-900">
                <LayoutGrid className="text-[#312ECB]" /> Create Category
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-6">
              {(Object.entries(PLATFORMS) as [Platform, string][]).map(([key, label]) => (
                <Button 
                  key={key} 
                  variant="outline" 
                  disabled={enabledCategories.includes(key)}
                  onClick={() => handleAddCategory(key)}
                  className={cn(
                    "h-16 rounded-2xl flex flex-col gap-1 border-slate-100 font-black text-[10px] uppercase text-slate-600",
                    enabledCategories.includes(key) && "opacity-30 bg-slate-50"
                  )}
                >
                  {getPlatformIcon(key)}
                  {label}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {enabledCategories.length > 0 ? (
          <Accordion type="single" collapsible className="space-y-4">
            {enabledCategories.sort().map(platform => (
              <AccordionItem key={platform} value={platform} className="border-none">
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                  <AccordionTrigger className="px-6 py-5 hover:no-underline group">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shadow-inner group-data-[state=open]:bg-blue-50">
                          {getPlatformIcon(platform)}
                        </div>
                        <div>
                          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">{PLATFORMS[platform] || platform} Category</h2>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {(groupedServices[platform] || []).length} Services Managed
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2">
                    <div className="space-y-4">
                      <Button 
                        onClick={() => {
                          setNewService({...newService, platform: platform});
                          setIsAddingService(true);
                        }}
                        variant="outline" 
                        className="w-full h-14 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 gap-2"
                      >
                        <Plus size={16} /> Add Service to {PLATFORMS[platform] || platform}
                      </Button>

                      <div className="space-y-3">
                        {(groupedServices[platform] || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map((service) => (
                          <div key={service.id} className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 flex flex-col md:flex-row md:items-center gap-4 group/item">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-black text-slate-800">{service.name}</span>
                                <Badge variant="outline" className="text-[7px] uppercase opacity-40 border-slate-200 text-slate-600">#{service.order}</Badge>
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
                                  className="h-9 w-20 bg-white border-none rounded-xl pl-6 text-xs font-black shadow-sm text-slate-900" 
                                />
                              </div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-[10px]">#</span>
                                <Input 
                                  type="number" 
                                  defaultValue={service.minQuantity} 
                                  onBlur={(e) => handleUpdateField(service, 'minQuantity', parseInt(e.target.value))}
                                  className="h-9 w-20 bg-white border-none rounded-xl pl-6 text-xs font-black shadow-sm text-slate-900" 
                                />
                              </div>
                              <button onClick={() => handleDeleteService(service.id)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                {deletingId === service.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t border-slate-100 mt-4 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-red-500">
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
          </div>
        )}
      </main>

      <Dialog open={isAddingService} onOpenChange={setIsAddingService}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-slate-900">
              <Layers className="text-[#312ECB]" /> Add Service
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Service Unique ID</label>
                <Input placeholder="e.g. basic_likes" value={newService.id || ""} onChange={e => setNewService({...newService, id: e.target.value})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Position</label>
                <Input type="number" placeholder="1" value={newService.order || ""} onChange={e => setNewService({...newService, order: parseInt(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Service Name</label>
              <Input placeholder="Service Name" value={newService.name || ""} onChange={e => setNewService({...newService, name: e.target.value})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Price per 1k (₹)</label>
                <Input type="number" placeholder="0" value={newService.pricePer1000 || ""} onChange={e => setNewService({...newService, pricePer1000: parseFloat(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Min Quantity</label>
                <Input type="number" placeholder="100" value={newService.minQuantity || ""} onChange={e => setNewService({...newService, minQuantity: parseInt(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddService} className="w-full h-14 bg-[#312ECB] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg">Save & Activate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
