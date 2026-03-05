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

  if (isUserLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950"><Loader2 className="w-10 h-10 text-[#312ECB] animate-spin mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Authenticating...</p></div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-slate-950 p-6 font-body overflow-x-hidden">
      <div className="w-full max-w-[360px] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-3d p-8 flex flex-col items-center relative overflow-hidden border border-white dark:border-slate-800">
        
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#312ECB]/5 rounded-full -mr-16 -mt-16 blur-3xl" />

        <div className="w-16 h-16 bg-[#312ECB] rounded-[1.5rem] flex items-center justify-center shadow-3d-sm mb-8 relative z-10">
          <Zap className="text-white fill-current" size={32} />
        </div>

        <div className="text-center space-y-2 mb-10 relative z-10">
          <h1 className="text-[24px] font-black tracking-tighter text-[#111B21] dark:text-white uppercase leading-tight">{user ? "WELCOME BACK" : "SOCIALBOOST"}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">{user ? user.displayName || user.email : "Powering SMM Automation"}</p>
        </div>

        {user ? (
          <div className="w-full space-y-4 relative z-10">
            <Button onClick={() => user.email === ADMIN_EMAIL ? router.push("/admin") : router.push("/chat")} className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-3d-sm gap-3 active:shadow-3d-pressed transition-all">Go to Hub <ArrowRight size={16} /></Button>
            <button onClick={() => signOut(auth!)} className="w-full text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors p-2 rounded-lg active:shadow-3d-pressed">Switch Profile</button>
          </div>
        ) : (
          <form onSubmit={isLogin ? handleLogin : handleSignup} className="w-full space-y-4 relative z-10">
            {!isLogin && <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Name</label><Input type="text" placeholder="John Doe" value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-5 text-sm font-bold shadow-3d-pressed" required /></div>}
            <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email</label><Input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-5 text-sm font-bold shadow-3d-pressed" required /></div>
            <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Password</label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-5 text-sm font-bold shadow-3d-pressed" required /></div>
            <Button type="submit" disabled={loading} className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-3d-sm mt-4 active:shadow-3d-pressed transition-all">{loading ? <Loader2 className="animate-spin" size={18} /> : isLogin ? "LOG IN" : "REGISTER"}</Button>
          </form>
        )}

        {!user && <div className="mt-8 text-center relative z-10"><button onClick={() => setIsLogin(!isLogin)} className="text-[11px] font-black text-[#312ECB] uppercase tracking-widest hover:opacity-80 transition-opacity p-2 rounded-lg active:shadow-3d-pressed">{isLogin ? "Join SocialBoost" : "Already a member? Login"}</button></div>}
      </div>

      <div className="mt-10 flex flex-col items-center space-y-4 opacity-30">
        <div className="flex gap-6"><ShieldCheck size={16} /><Rocket size={16} /><Globe size={16} /></div>
        <p className="text-[10px] font-black text-[#111B21] dark:text-slate-500 uppercase tracking-[0.4em]">PRO VERSION 3.0</p>
      </div>
    </div>
  );
}