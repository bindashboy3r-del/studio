
"use client";

import { useState, useEffect, Suspense } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDocs, collection, query, where, limit, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Loader2, Instagram, ListChecks, X, Search, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SMMService } from "@/app/lib/constants";

function AuthContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const searchParams = useSearchParams();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";

  // Fetch Services for Rate Card
  const servicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, "services"), 
      where("platform", "==", "instagram"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );
  }, [db]);
  const { data: services, isLoading: isServicesLoading } = useCollection<SMMService>(servicesQuery);

  const filteredServices = (services || []).filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!isUserLoading && user) {
      const userEmail = user.email?.toLowerCase();
      if (userEmail === ADMIN_EMAIL.toLowerCase()) router.replace("/admin");
      else router.replace("/chat");
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !auth) return;
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = result.user.email?.toLowerCase();
      if (userEmail === ADMIN_EMAIL.toLowerCase()) router.push("/admin");
      else router.push("/chat");
      toast({ title: "Welcome!", description: "Accessing your dashboard..." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login Error", description: error.message });
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName || !auth || !db) return;
    setLoading(true);
    try {
      const refCodeFromUrl = searchParams.get('ref');
      let referredByUid = "";

      if (refCodeFromUrl) {
        const q = query(collection(db, "users"), where("referralCode", "==", refCodeFromUrl.toUpperCase()), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) referredByUid = snap.docs[0].id;
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      
      const referralCode = result.user.uid.slice(0, 6).toUpperCase();
      
      await setDoc(doc(db, "users", result.user.uid), { 
        id: result.user.uid, 
        email, 
        displayName, 
        balance: 0, 
        referralCode,
        referredBy: referredByUid,
        referralEarnings: 0,
        totalReferralPaid: 0,
        createdAt: new Date().toISOString() 
      });

      toast({ title: "Account Created!", description: referredByUid ? "Joined via referral bonus program!" : "Welcome to SocialBoost!" });
      router.push("/chat");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Error", description: error.message });
      setLoading(false);
    }
  };

  if (isUserLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#312ECB]" /></div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-6 font-body overflow-x-hidden relative">
      <div className="w-full max-w-[380px] bg-white rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.1)] p-10 flex flex-col items-center relative overflow-hidden border border-white">
        <div className="w-20 h-20 bg-[#312ECB] rounded-[1.8rem] flex items-center justify-center shadow-[0_15px_30px_rgba(49,46,203,0.3)] mb-10">
          <Zap className="text-white fill-current" size={40} />
        </div>
        <div className="text-center space-y-2 mb-12">
          <h1 className="text-[28px] font-black tracking-tight text-[#111B21] uppercase">SOCIALBOOST</h1>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">GET VIRAL IN JUST ONE CLICK 🚀</p>
        </div>
        <form onSubmit={isLogin ? handleLogin : handleSignup} className="w-full space-y-4">
          {!isLogin && <Input type="text" placeholder="Full Name" value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner" required />}
          <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner" required />
          <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner" required />
          <Button type="submit" disabled={loading} className="w-full h-16 bg-[#312ECB] text-white font-black text-[12px] uppercase rounded-3xl shadow-lg mt-6 active:scale-95 transition-all">
            {loading ? <Loader2 className="animate-spin" size={20} /> : isLogin ? "LOG IN" : "REGISTER"}
          </Button>
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-[11px] font-black text-[#312ECB] uppercase tracking-widest mt-4">
            {isLogin ? "New Member? Create Free Account" : "Already a member? Login"}
          </button>
        </form>

        <div className="w-full border-t border-slate-100 mt-8 pt-6">
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full h-12 border-[#312ECB]/20 text-[#312ECB] font-black text-[10px] uppercase tracking-widest rounded-2xl gap-2 hover:bg-[#312ECB]/5"
              >
                <ListChecks size={16} /> VIEW SERVICES & PRICES
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[360px] rounded-[2.5rem] border-none shadow-2xl bg-white p-0 overflow-hidden">
              <header className="bg-[#312ECB] p-6 text-white text-center">
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Instagram Rate Card</DialogTitle>
                <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-1">Live Pricing Per 1,000 Qty</p>
              </header>
              
              <div className="p-4">
                <div className="relative mb-4">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Search service..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 bg-slate-50 border-none rounded-xl pl-9 text-xs font-bold"
                  />
                </div>

                <ScrollArea className="h-[350px] pr-2">
                  {isServicesLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="animate-spin text-[#312ECB]" size={24} />
                      <p className="text-[10px] font-black text-slate-400 uppercase">Updating Rates...</p>
                    </div>
                  ) : filteredServices.length > 0 ? (
                    <div className="space-y-2">
                      {filteredServices.map((s) => (
                        <div key={s.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between group">
                          <div className="flex-1 pr-4">
                            <h4 className="text-[11px] font-black text-slate-800 uppercase leading-tight">{s.name}</h4>
                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Min: {s.minQuantity}</p>
                          </div>
                          <div className="bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-0.5 text-[#312ECB]">
                              <IndianRupee size={10} strokeWidth={3} />
                              <span className="text-sm font-black italic">{s.pricePer1000}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 opacity-30">
                      <ListChecks size={40} className="mx-auto mb-2" />
                      <p className="text-[10px] font-black uppercase">No Services Found</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <p className="text-[8px] font-black text-center text-slate-400 uppercase tracking-widest">Login to place an order instantly</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="mt-16 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2.5 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white shadow-sm">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Created by</span>
          <div className="flex items-center gap-1.5 text-[#312ECB]">
            <Instagram size={14} />
            <span className="text-[12px] font-black tracking-tight italic">@bindash_boy3</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#312ECB]" /></div>}>
      <AuthContent />
    </Suspense>
  );
}
