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
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getApiBalance } from "@/app/actions/smm-api";
import { SERVICES } from "@/app/lib/constants";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ApiSettingsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [serviceMappings, setServiceMappings] = useState<Record<string, string>>({});
  const [apiBalance, setApiBalance] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        setApiUrl(data.apiUrl || "");
        setApiKey(data.apiKey || "");
        setServiceMappings(data.serviceMappings || {});
      }
    });
    return () => unsub();
  }, [db, user]);

  const handleRefreshBalance = async () => {
    if (!apiUrl || !apiKey) return;
    setIsRefreshing(true);
    const result = await getApiBalance(apiUrl, apiKey);
    if (result.success) {
      setApiBalance(`${result.balance} ${result.currency || 'INR'}`);
      toast({ title: "Balance Updated", description: `API Provider balance: ${result.balance}` });
    } else {
      setApiBalance("Error fetching");
      toast({ variant: "destructive", title: "Sync Failed", description: result.error });
    }
    setIsRefreshing(false);
  };

  const handleSave = async () => {
    if (!db || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "globalSettings", "api"), {
        apiUrl,
        apiKey,
        serviceMappings,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      toast({ title: "Settings Saved", description: "SMM Panel API config updated successfully." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed", description: "Database error." });
    } finally {
      setIsSaving(false);
    }
  };

  const updateMapping = (serviceId: string, value: string) => {
    setServiceMappings(prev => ({ ...prev, [serviceId]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-20">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-[#111B21]">SMM API Integration</h1>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg"
        >
          {isSaving ? "Saving..." : <><Save size={16} /> Save Changes</>}
        </Button>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* API Credentials */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
              <Settings2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Main API Config</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connect your SMM Provider</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">API Endpoint URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <Input 
                  placeholder="https://smmpanel.com/api/v2" 
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-xl pl-12 font-bold text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">API Key</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <Input 
                  type="password"
                  placeholder="Your Secret API Key" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-xl pl-12 font-bold text-sm"
                />
              </div>
            </div>
          </div>

          {apiUrl && apiKey && (
            <div className="bg-slate-900 rounded-3xl p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Provider Balance</p>
                  <p className="text-lg font-black">{apiBalance || "Not checked"}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleRefreshBalance} 
                disabled={isRefreshing}
                className="hover:bg-white/10 text-white gap-2 text-[10px] font-black uppercase"
              >
                <RefreshCw className={isRefreshing ? "animate-spin" : ""} size={16} /> Refresh
              </Button>
            </div>
          )}
        </section>

        {/* Service Mapping */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Service IDs</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Map SocialBoost to Provider IDs</p>
            </div>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-[0.2em] border-b pb-2">Instagram Services</h3>
                <div className="grid gap-4">
                  {SERVICES.instagram.map(s => (
                    <div key={s.id} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                      <div className="flex-1">
                        <p className="text-[12px] font-black text-slate-700">{s.name}</p>
                        <p className="text-[9px] font-bold text-slate-400">Rate: ₹{s.pricePer1000}/1k</p>
                      </div>
                      <div className="w-32">
                        <Input 
                          placeholder="API ID" 
                          value={serviceMappings[s.id] || ""}
                          onChange={(e) => updateMapping(s.id, e.target.value)}
                          className="h-10 bg-white border-slate-100 rounded-xl text-center font-black text-xs"
                        />
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
            Important: Ensure your API Provider has enough balance. Wallet orders will be submitted automatically. UPI orders remain manual for you to check.
          </p>
        </div>
      </main>
    </div>
  );
}