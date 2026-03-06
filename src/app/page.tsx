
"use client";

import { useState, useEffect, Suspense } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDocs, collection, query, where, limit } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Loader2, Instagram } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser } from "@/firebase";

function AuthContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const searchParams = useSearchParams();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";

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
  if (user) return null;

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
