
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
  AlertCircle
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
  orderBy 
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  isActive: boolean;
}

export default function ServiceManagerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const servicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "services"), orderBy("name", "asc"));
  }, [db]);

  const { data: services, isLoading: isServicesLoading } = useCollection<Service>(servicesQuery);

  const [isAdding, setIsAdding] = useState(false);
  const [newService, setNewService] = useState<Partial<Service>>({
    id: "",
    name: "",
    platform: 'instagram',
    isActive: true,
    pricePer1000: 0,
    minQuantity: 100
  });

  useEffect(() => {
    const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  const handleAddService = async () => {
    if (!db || !newService.name || !newService.id) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Name and ID are required." });
      return;
    }

    try {
      const docRef = doc(db, "services", newService.id);
      await setDoc(docRef, {
        ...newService,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Service Added", description: `${newService.name} is now available.` });
      setIsAdding(false);
      setNewService({ id: "", name: "", platform: 'instagram', isActive: true, pricePer1000: 0, minQuantity: 100 });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add service." });
    }
  };

  const handleUpdatePrice = async (service: Service, field: 'pricePer1000' | 'minQuantity', value: string) => {
    if (!db) return;
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
    if (!db) return;
    if (confirm("Are you sure? Users will no longer see this service.")) {
      try {
        await deleteDoc(doc(db, "services", id));
        toast({ title: "Service Deleted" });
      } catch (e) {
        toast({ variant: "destructive", title: "Delete Failed" });
      }
    }
  };

  if (isServicesLoading) {
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
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
              <Plus size={16} /> Add New Service
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <Layers className="text-[#312ECB]" /> New SMM Service
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Unique ID (lowercase)</label>
                <Input placeholder="e.g. ig_followers_real" value={newService.id || ""} onChange={e => setNewService({...newService, id: e.target.value})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Display Name</label>
                <Input placeholder="e.g. Followers (High Quality)" value={newService.name || ""} onChange={e => setNewService({...newService, name: e.target.value})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Price (₹ / 1k)</label>
                  <Input type="number" value={newService.pricePer1000} onChange={e => setNewService({...newService, pricePer1000: parseFloat(e.target.value)})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Min Quantity</label>
                  <Input type="number" value={newService.minQuantity} onChange={e => setNewService({...newService, minQuantity: parseInt(e.target.value)})} className="h-12 rounded-2xl bg-slate-50 border-none font-bold" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddService} className="w-full h-14 bg-[#312ECB] text-white font-black uppercase tracking-widest rounded-2xl">Create Service</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Instagram size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Active Services</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Edit prices and limits live</p>
            </div>
          </div>

          <div className="space-y-4">
            {services?.map((service) => (
              <div key={service.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row md:items-center gap-6 group">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-black text-[#111B21]">{service.name}</span>
                    <Badge variant="outline" className="text-[8px] font-black uppercase opacity-50">{service.id}</Badge>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Instagram Hub</p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Price (1k)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
                      <Input 
                        type="number" 
                        defaultValue={service.pricePer1000} 
                        onBlur={(e) => handleUpdatePrice(service, 'pricePer1000', e.target.value)}
                        className="h-10 w-28 bg-white border-none rounded-xl pl-8 text-xs font-black text-emerald-700" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Min Qty</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={14} />
                      <Input 
                        type="number" 
                        defaultValue={service.minQuantity} 
                        onBlur={(e) => handleUpdatePrice(service, 'minQuantity', e.target.value)}
                        className="h-10 w-28 bg-white border-none rounded-xl pl-8 text-xs font-black text-blue-700" 
                      />
                    </div>
                  </div>
                </div>

                <button onClick={() => handleDelete(service.id)} className="p-3 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            {services?.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <Layers size={48} className="mx-auto text-slate-200" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">No services added yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex items-start gap-4">
          <AlertCircle className="text-amber-600 shrink-0" size={20} />
          <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase">
            Pricing Notice: Changes made here reflect instantly across the entire application for all users. Ensure you update your API mappings in "API Settings" for any new services added.
          </p>
        </div>
      </main>
    </div>
  );
}
