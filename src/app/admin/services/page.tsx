
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Plus, 
  Save, 
  Trash2, 
  RefreshCw, 
  Layers, 
  Instagram, 
  DollarSign, 
  Hash,
  AlertCircle,
  Zap,
  ArrowUpDown
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
  writeBatch
} from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: string;
  name: string;
  platform: 'instagram';
  pricePer1000: number;
  minQuantity: number;
  order: number;
  isActive: boolean;
}

const DEFAULT_SERVICES: Service[] = [
  { id: 'ig_followers', name: 'Followers', platform: 'instagram', pricePer1000: 89, minQuantity: 100, order: 1, isActive: true },
  { id: 'ig_likes', name: 'Likes', platform: 'instagram', pricePer1000: 18, minQuantity: 100, order: 2, isActive: true },
  { id: 'ig_views', name: 'Views', platform: 'instagram', pricePer1000: 0.60, minQuantity: 500, order: 3, isActive: true },
  { id: 'ig_comments', name: 'Comments', platform: 'instagram', pricePer1000: 260, minQuantity: 50, order: 4, isActive: true },
  { id: 'ig_shares', name: 'Shares', platform: 'instagram', pricePer1000: 7, minQuantity: 100, order: 5, isActive: true },
  { id: 'ig_profile_visit', name: 'Profile Visit', platform: 'instagram', pricePer1000: 25, minQuantity: 100, order: 6, isActive: true },
];

export default function ServiceManagerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const isActuallyAdmin = user?.email === ADMIN_EMAIL || user?.uid === "s55uL0f8PmcypR75usVYOLwVs7O2";

  const servicesQuery = useMemoFirebase(() => {
    // Only query if user is definitely confirmed as admin
    if (!db || !isActuallyAdmin) return null;
    return query(collection(db, "services"), orderBy("order", "asc"));
  }, [db, isActuallyAdmin]);

  const { data: services, isLoading: isServicesLoading } = useCollection<Service>(servicesQuery);

  const [isAdding, setIsAdding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [newService, setNewService] = useState<Partial<Service>>({
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

  useEffect(() => {
    if (services) {
      setNewService(prev => ({ ...prev, order: services.length + 1 }));
    }
  }, [services]);

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
      toast({ title: "Defaults Loaded", description: "Standard SMM services have been populated." });
    } catch (e) {
      toast({ variant: "destructive", title: "Seed Failed" });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddService = async () => {
    if (!db || !newService.name || !newService.id || !isActuallyAdmin) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Name and ID are required." });
      return;
    }

    try {
      const docId = newService.id.toLowerCase().replace(/\s+/g, '_');
      const docRef = doc(db, "services", docId);
      await setDoc(docRef, {
        ...newService,
        id: docId,
        order: Number(newService.order) || (services?.length || 0) + 1,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Service Added", description: `${newService.name} is now available.` });
      setIsAdding(false);
      setNewService({ id: "", name: "", platform: 'instagram', isActive: true, pricePer1000: 0, minQuantity: 100, order: (services?.length || 0) + 1 });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add service." });
    }
  };

  const handleUpdateField = async (service: Service, field: keyof Service, value: string) => {
    if (!db || !isActuallyAdmin) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    try {
      const docRef = doc(db, "services", service.id);
      await setDoc(docRef, { [field]: numValue }, { merge: true });
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !isActuallyAdmin) return;
    if (confirm("Are you sure? Users will no longer see this service.")) {
      try {
        await deleteDoc(doc(db, "services", id));
        toast({ title: "Service Deleted" });
      } catch (e) {
        toast({ variant: "destructive", title: "Delete Failed" });
      }
    }
  };

  if (isUserLoading || (!user && !isUserLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-20">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">Service Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleSeedDefaults} 
            disabled={isSeeding}
            className="rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest gap-2 border-blue-100 text-[#312ECB]"
          >
            <Zap size={14} className={isSeeding ? "animate-pulse" : ""} /> {isSeeding ? "Loading..." : "Load Defaults"}
          </Button>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
                <Plus size={16} /> Add Custom
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <Layers className="text-[#312ECB]" /> New SMM Service
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Unique ID</label>
                    <Input placeholder="ig_followers" value={newService.id || ""} onChange={e => setNewService({...newService, id: e.target.value})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Order (Position)</label>
                    <Input type="number" value={newService.order || 0} onChange={e => setNewService({...newService, order: parseInt(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Display Name</label>
                  <Input placeholder="e.g. Followers (High Quality)" value={newService.name || ""} onChange={e => setNewService({...newService, name: e.target.value})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Price (₹ / 1k)</label>
                    <Input type="number" value={newService.pricePer1000 || 0} onChange={e => setNewService({...newService, pricePer1000: parseFloat(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Min Quantity</label>
                    <Input type="number" value={newService.minQuantity || 100} onChange={e => setNewService({...newService, minQuantity: parseInt(e.target.value) || 0})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddService} className="w-full h-14 bg-[#312ECB] text-white font-black uppercase tracking-widest rounded-2xl">Create Service</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <Instagram size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">Services List</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordered by your preference</p>
              </div>
            </div>
            <Badge className="bg-blue-50 text-[#312ECB] border-none font-black text-[10px] uppercase">{services?.length || 0} Total</Badge>
          </div>

          <div className="space-y-4">
            {services?.map((service) => (
              <div key={service.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row md:items-center gap-6 group transition-all hover:shadow-md">
                <div className="flex items-center gap-4 min-w-[50px]">
                   <span className="text-[12px] font-black text-slate-300">#{service.order}</span>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-black text-[#111B21]">{service.name}</span>
                    <Badge variant="outline" className="text-[8px] font-black uppercase opacity-50 border-slate-200">{service.id}</Badge>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Instagram Hub</p>
                </div>

                <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
                   <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Pos</label>
                    <div className="relative">
                      <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <Input 
                        type="number" 
                        defaultValue={service.order} 
                        onBlur={(e) => handleUpdateField(service, 'order', e.target.value)}
                        className="h-10 w-16 bg-white border-none rounded-xl pl-8 text-xs font-black text-slate-700 shadow-sm" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Price</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-500" size={12} />
                      <Input 
                        type="number" 
                        defaultValue={service.pricePer1000} 
                        onBlur={(e) => handleUpdateField(service, 'pricePer1000', e.target.value)}
                        className="h-10 w-20 bg-white border-none rounded-xl pl-6 text-xs font-black text-emerald-700 shadow-sm" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest ml-1">Min</label>
                    <div className="relative">
                      <Hash className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500" size={12} />
                      <Input 
                        type="number" 
                        defaultValue={service.minQuantity} 
                        onBlur={(e) => handleUpdateField(service, 'minQuantity', e.target.value)}
                        className="h-10 w-20 bg-white border-none rounded-xl pl-6 text-xs font-black text-blue-700 shadow-sm" 
                      />
                    </div>
                  </div>
                </div>

                <button onClick={() => handleDelete(service.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            {services?.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <Layers size={48} className="mx-auto text-slate-200" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">No services added yet</p>
                <Button onClick={handleSeedDefaults} variant="link" className="text-[#312ECB] font-black text-[10px] uppercase">Click to load standard services</Button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex items-start gap-4">
          <AlertCircle className="text-[#312ECB] shrink-0" size={20} />
          <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
            Order System: 'Order' number se aap services ki sequence badal sakte hain. Kam number pehle dikhayi dega. Nayi service add karte waqt use apne hisaab se order number dein.
          </p>
        </div>
      </main>
    </div>
  );
}
