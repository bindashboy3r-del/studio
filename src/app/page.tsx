
"use client";

import { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Zap, ShieldCheck, Rocket, Globe, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser } from "@/firebase";

export default function AuthPage() {
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

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";

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
      toast({ variant: "destructive", title: "Login Error", description: error.message || "Invalid credentials." });
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName || !auth || !db) return;
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      await setDoc(doc(db, "users", result.user.uid), { id: result.user.uid, email, displayName, balance: 0, createdAt: new Date().toISOString() });
      toast({ title: "Account Created!", description: "Redirecting..." });
      router.push("/chat");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Error", description: error.message || "Could not create account." });
      setLoading(false);
    }
  };

  if (isUserLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-white"><Loader2 className="w-8 h-8 text-[#312ECB] animate-spin mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Loading...</p></div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-6 font-body overflow-x-hidden relative">
      
      <div className="w-full max-w-[380px] bg-white rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.1)] p-10 flex flex-col items-center relative overflow-hidden border border-white">
        
        {/* Bolt Icon Container */}
        <div className="w-20 h-20 bg-[#312ECB] rounded-[1.8rem] flex items-center justify-center shadow-[0_15px_30px_rgba(49,46,203,0.3)] mb-10">
          <Zap className="text-white fill-current" size={40} />
        </div>

        <div className="text-center space-y-2 mb-12">
          <h1 className="text-[28px] font-black tracking-tight text-[#111B21] uppercase leading-tight">
            {user ? "WELCOME BACK" : "SOCIALBOOST"}
          </h1>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            {user ? (user.displayName || user.email?.split('@')[0]) : "Powering SMM Automation"}
          </p>
        </div>

        {user ? (
          <div className="w-full space-y-6">
            <Button 
              onClick={() => user.email === ADMIN_EMAIL ? router.push("/admin") : router.push("/chat")} 
              className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[12px] uppercase tracking-[0.2em] rounded-3xl shadow-lg gap-3 transition-all active:scale-95"
            >
              Go to Hub <ArrowRight size={18} />
            </Button>
            <div className="text-center">
              <button 
                onClick={() => signOut(auth!)} 
                className="text-slate-300 font-black text-[10px] uppercase tracking-widest hover:text-[#312ECB] transition-colors"
              >
                Switch Profile
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={isLogin ? handleLogin : handleSignup} className="w-full space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Name</label>
                <Input type="text" placeholder="John Doe" value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner" required />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email</label>
              <Input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Password</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-inner" required />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[12px] uppercase tracking-[0.2em] rounded-3xl shadow-lg mt-6 active:scale-95 transition-all">
              {loading ? <Loader2 className="animate-spin" size={20} /> : isLogin ? "LOG IN" : "REGISTER"}
            </Button>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-[11px] font-black text-[#312ECB] uppercase tracking-widest hover:opacity-80">
                {isLogin ? "Join SocialBoost" : "Already a member? Login"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer Version Info */}
      <div className="mt-16 flex flex-col items-center">
        <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.5em]">
          PRO VERSION 3.0
        </p>
      </div>

      {/* Next.js N Logo (Bottom Left) */}
      <div className="absolute bottom-8 left-8">
        <div className="w-10 h-10 bg-[#111B21] rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-lg italic">N</span>
        </div>
      </div>
    </div>
  );
}
