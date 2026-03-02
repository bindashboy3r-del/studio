"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Settings2, 
  Save, 
  Link as LinkIcon, 
  Key, 
  RefreshCw,
  Wallet,
  Layers,
  Zap,
  Plus,
  Trash2,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getApiBalance } from "@/app/actions/smm-api";
import { SERVICES } from "@/app/lib/constants";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ApiProvider {
  id: string;
  name: string;
  url: string;
  key: string;
}

interface ServiceMapping {
  providerId: string;
  remoteServiceId: string;
}

export default function ApiSettingsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [mappings, setMappings] = useState<Record<string, ServiceMapping>>({});
  const [apiBalances, setApiBalances] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!db || !user) return;
    const unsub = onSnapshot(doc(db, "globalSettings", "api"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProviders(data.providers || []);
        setMappings(data.mappings || {});
      }
    });
    return () => unsub();
  }, [db, user]);

  const handleRefreshBalance = async (provider: ApiProvider) => {
    if (!provider.url || !provider.key) return;
    setIsRefreshing(prev => ({ ...prev, [provider.id]: true }));
    const result = await getApiBalance(provider.url, provider.key);
    if (result.success) {
      setApiBalances(prev => ({ ...prev, [provider.id]: `${result.balance} ${result.currency || 'INR'}` }));
      toast({ title: `${provider.name} Balance`, description: `Available: ${result.balance}` });
    } else {
      setApiBalances(prev => ({ ...prev, [provider.id]: "Error" }));
      toast({ variant: "destructive", title: "Sync Failed", description: result.error });
    }
    setIsRefreshing(prev => ({ ...prev, [provider.id]: false }));
  };

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "globalSettings", "api"), {
        providers,
        mappings,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      toast({ title: "Settings Saved", description: "Multi-Provider API config updated successfully." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed", description: "Database error." });
    } finally {
      setIsSaving(false);
    }
  };

  const addProvider = () => {
    const id = `prov_${Date.now()}`;
    setProviders([...providers, { id, name: "New Provider", url: "", key: "" }]);
  };

  const updateProvider = (id: string, updates: Partial<ApiProvider>) => {
    setProviders(providers.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProvider = (id: string) => {
    setProviders(providers.filter(p => p.id !== id));
    // Also cleanup mappings
    const newMappings = { ...mappings };
    Object.keys(newMappings).forEach(key => {
      if (newMappings[key].providerId === id) delete newMappings[key];
    });
    setMappings(newMappings);
  };

  const updateMapping = (serviceId: string, updates: Partial<ServiceMapping>) => {
    setMappings(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], ...updates }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-20">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">SMM API Management</h1>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg"
        >
          {isSaving ? "Saving..." : <><Save size={16} /> Save Changes</>}
        </Button>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Manage Providers Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">API Providers</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add multiple SMM panels</p>
            </div>
            <Button onClick={addProvider} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest gap-2">
              <Plus size={16} /> Add New Panel
            </Button>
          </div>

          <div className="grid gap-4">
            {providers.map((prov) => (
              <Card key={prov.id} className="rounded-[2rem] border-slate-100 shadow-xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="text-blue-500" size={20} />
                      <Input 
                        value={prov.name} 
                        onChange={(e) => updateProvider(prov.id, { name: e.target.value })}
                        className="h-8 w-48 bg-transparent border-none font-black text-sm p-0 focus-visible:ring-0"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeProvider(prov.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Endpoint URL</label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <Input 
                          placeholder="https://smmpanel.com/api/v2" 
                          value={prov.url}
                          onChange={(e) => updateProvider(prov.id, { url: e.target.value })}
                          className="h-10 bg-slate-50 border-none rounded-xl pl-9 text-xs font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">API Key</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <Input 
                          type="password"
                          placeholder="Your Secret API Key" 
                          value={prov.key}
                          onChange={(e) => updateProvider(prov.id, { key: e.target.value })}
                          className="h-10 bg-slate-50 border-none rounded-xl pl-9 text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                  {prov.url && prov.key && (
                    <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between text-white">
                      <div className="flex items-center gap-3">
                        <Wallet size={16} className="text-emerald-400" />
                        <span className="text-[11px] font-black">{apiBalances[prov.id] || "Check Balance..."}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRefreshBalance(prov)} 
                        disabled={isRefreshing[prov.id]}
                        className="h-8 text-[9px] font-black uppercase hover:bg-white/10"
                      >
                        <RefreshCw className={isRefreshing[prov.id] ? "animate-spin" : ""} size={14} />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {providers.length === 0 && (
              <div className="bg-white rounded-[2rem] p-12 flex flex-col items-center justify-center border border-dashed border-slate-200 text-slate-400">
                < Globe size={40} className="mb-4 opacity-20" />
                <p className="font-black uppercase text-[10px] tracking-widest">No API Panels Connected</p>
              </div>
            )}
          </div>
        </section>

        {/* Service Routing Section */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Service Routing</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign panels to services</p>
            </div>
          </div>

          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-[0.2em] border-b pb-2">Instagram Hub</h3>
                <div className="grid gap-3">
                  {SERVICES.instagram.map(s => (
                    <div key={s.id} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1">
                        <p className="text-[13px] font-black text-slate-800">{s.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rate: ₹{s.pricePer1000}/1k</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="w-48">
                          <Select 
                            value={mappings[s.id]?.providerId || ""} 
                            onValueChange={(val) => updateMapping(s.id, { providerId: val })}
                          >
                            <SelectTrigger className="h-10 rounded-xl bg-white border-slate-100 font-black text-[10px] uppercase">
                              <SelectValue placeholder="Pick Panel" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {providers.map(p => (
                                <SelectItem key={p.id} value={p.id} className="text-[10px] font-black uppercase">{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <Input 
                            placeholder="Remote ID" 
                            value={mappings[s.id]?.remoteServiceId || ""}
                            onChange={(e) => updateMapping(s.id, { remoteServiceId: e.target.value })}
                            className="h-10 bg-white border-slate-100 rounded-xl text-center font-black text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </section>

        <div className="bg-yellow-50 p-6 rounded-[2rem] border border-yellow-100 flex items-start gap-4">
          <Zap className="text-yellow-600 shrink-0" size={20} />
          <p className="text-[10px] font-bold text-yellow-700 leading-relaxed uppercase">
            Order Routing: Multi-API system is active. Wallet orders will be routed to the specific provider assigned to each service. Ensure all assigned providers have sufficient balance.
          </p>
        </div>
      </main>
    </div>
  );
}
