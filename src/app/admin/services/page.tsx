
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
      if (snap.exists()) setEnabledCategories(snap.data().list || []);
      else setEnabledCategories(['instagram']);
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
    await setDoc(doc(db, "globalSettings", "categories"), { list: newList }, { merge: true });
    setIsAddingCategory(false);
  };

  const handleDeleteCategory = async (platform: string) => {
    if (!db || !isActuallyAdmin) return;
    if (!confirm(`Delete all services in ${PLATFORMS[platform as Platform] || platform}?`)) return;
    setDeletingCategory(platform);
    try {
      const newList = enabledCategories.filter(p => p !== platform);
      await setDoc(doc(db, "globalSettings", "categories"), { list: newList });
      const q = query(collection(db, "services"), where("platform", "==", platform));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast({ title: "Category Deleted" });
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleAddService = () => {
    if (!db || !newService.name || !newService.id) return;
    const platform = newService.platform || 'other';
    const finalDocId = `${platform}_${newService.id.toLowerCase().replace(/\s+/g, '_')}`;
    setDoc(doc(db, "services", finalDocId), {
      ...newService,
      id: finalDocId,
      platform: platform,
      order: Number(newService.order) || (services?.length || 0) + 1,
      updatedAt: serverTimestamp()
    }).then(() => {
      setIsAddingService(false);
      setNewService({ id: "", name: "", platform: platform as Platform, isActive: true, pricePer1000: 0, minQuantity: 100, order: 0 });
    });
  };

  if (isUserLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-[#312ECB]" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-20 text-slate-950">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft size={20} /></button>
          <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase">Category Hub</h1>
        </div>
        <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
          <DialogTrigger asChild>
            <Button className="bg-[#312ECB] text-white rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest">New Category</Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] bg-white text-slate-950 border-none shadow-2xl p-8">
            <DialogHeader><DialogTitle className="text-slate-950 font-black uppercase">Create Category</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-6">
              {(Object.entries(PLATFORMS) as [Platform, string][]).map(([key, label]) => (
                <Button key={key} variant="outline" disabled={enabledCategories.includes(key)} onClick={() => handleAddCategory(key)} className="h-16 rounded-2xl flex flex-col gap-1 border-slate-100 text-slate-950 font-black text-[10px] uppercase">
                  {label}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <Accordion type="single" collapsible className="space-y-4">
          {enabledCategories.map(platform => (
            <AccordionItem key={platform} value={platform} className="bg-white rounded-[2rem] border-slate-100 shadow-sm overflow-hidden">
              <AccordionTrigger className="px-6 py-5 hover:no-underline text-slate-950 font-black uppercase">
                {PLATFORMS[platform] || platform} ({(groupedServices[platform] || []).length})
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 pt-2">
                <div className="space-y-4">
                  <Button onClick={() => { setNewService({...newService, platform: platform}); setIsAddingService(true); }} variant="outline" className="w-full h-14 border-dashed border-slate-200 text-slate-400 font-black text-[11px] uppercase">
                    + Add Service
                  </Button>
                  {groupedServices[platform]?.map(s => (
                    <div key={s.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex-1"><p className="text-slate-950 font-black text-sm">{s.name}</p><code className="text-[8px] text-slate-400">ID: {s.id}</code></div>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-600 font-black text-xs">₹{s.pricePer1000}/1k</span>
                        <button onClick={() => deleteDoc(doc(db, "services", s.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-slate-100 flex justify-between">
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(platform)} className="text-red-500 font-black text-[9px] uppercase tracking-widest">
                      Delete Category
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>

      <Dialog open={isAddingService} onOpenChange={setIsAddingService}>
        <DialogContent className="rounded-[2.5rem] bg-white text-slate-950 border-none shadow-2xl p-8">
          <DialogHeader><DialogTitle className="text-slate-950 font-black uppercase">Add Service</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Service Unique ID (e.g. likes)" value={newService.id} onChange={e => setNewService({...newService, id: e.target.value})} className="bg-slate-50 border-none text-slate-950 font-bold" />
            <Input placeholder="Display Name" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className="bg-slate-50 border-none text-slate-950 font-bold" />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" placeholder="Price / 1k" onChange={e => setNewService({...newService, pricePer1000: parseFloat(e.target.value)})} className="bg-slate-50 border-none text-slate-950 font-bold" />
              <Input type="number" placeholder="Min Qty" onChange={e => setNewService({...newService, minQuantity: parseInt(e.target.value)})} className="bg-slate-50 border-none text-slate-950 font-bold" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddService} className="w-full bg-[#312ECB] text-white font-black h-14 rounded-2xl">SAVE & ACTIVATE</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
