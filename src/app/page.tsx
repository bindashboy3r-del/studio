
"use client";

import { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Zap, Instagram, ShieldCheck, Rocket, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore } from "@/firebase";
import { cn } from "@/lib/utils";

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

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !auth) return;
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = result.user.email?.toLowerCase();
      if (userEmail === ADMIN_EMAIL.toLowerCase()) {
        router.push("/admin");
      } else {
        router.push("/chat");
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Login Error", 
        description: error.message || "Invalid credentials." 
      });
    } finally {
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
      
      await setDoc(doc(db, "users", result.user.uid), {
        id: result.user.uid,
        email,
        displayName,
        balance: 0,
        createdAt: new Date().toISOString()
      });
      
      const userEmail = result.user.email?.toLowerCase();
      if (userEmail === ADMIN_EMAIL.toLowerCase()) {
        router.push("/admin");
      } else {
        router.push("/chat");
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Registration Error", 
        description: error.message || "Could not create account." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0F2F5] dark:bg-slate-950 p-6 font-body overflow-x-hidden">
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-10 pb-12 flex flex-col items-center relative overflow-hidden border border-white/50 dark:border-slate-800">
        
        {/* Background Decorative Gradient */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#312ECB]/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#312ECB]/5 rounded-full -ml-16 -mb-16 blur-3xl" />

        {/* Logo Icon */}
        <div className="w-20 h-20 bg-[#312ECB] rounded-3xl flex items-center justify-center shadow-[0_12px_24px_rgba(49,46,203,0.3)] mb-8 relative z-10">
          <Zap className="text-white fill-current" size={36} />
        </div>

        {/* Heading */}
        <div className="text-center space-y-2 mb-10 relative z-10">
          <h1 className="text-[32px] font-black tracking-tighter text-[#111B21] dark:text-white uppercase leading-none">
            WELCOME TO <br/> <span className="text-[#312ECB]">SOCIALBOOST</span>
          </h1>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed px-4">
            The most powerful SMM automation for Instagram growth.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={isLogin ? handleLogin : handleSignup} className="w-full space-y-6 relative z-10">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#111B21] dark:text-slate-300 uppercase tracking-widest ml-1">
                Full Name
              </label>
              <Input 
                type="text" 
                placeholder="Ex. Chetan Nagani" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner focus-visible:ring-2 focus-visible:ring-[#312ECB]/10"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#111B21] dark:text-slate-300 uppercase tracking-widest ml-1">
              Email Address
            </label>
            <Input 
              type="email" 
              placeholder="name@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner focus-visible:ring-2 focus-visible:ring-[#312ECB]/10"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#111B21] dark:text-slate-300 uppercase tracking-widest ml-1">
              Password
            </label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner focus-visible:ring-2 focus-visible:ring-[#312ECB]/10"
              required
            />
          </div>

          <Button 
            type="submit"
            disabled={loading}
            className="w-full h-16 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[13px] uppercase tracking-[0.2em] rounded-2xl shadow-[0_15px_30px_rgba(49,46,203,0.3)] transition-all active:scale-95 mt-4"
          >
            {loading ? "INITIALIZING..." : isLogin ? "ACCESS PORTAL" : "CREATE ACCOUNT"}
          </Button>
        </form>

        {/* Toggle */}
        <div className="mt-10 text-center relative z-10">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
            {isLogin ? "NEW TO OUR PLATFORM?" : "ALREADY A MEMBER?"}
          </p>
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[13px] font-black text-[#312ECB] uppercase tracking-widest hover:opacity-80 transition-opacity"
          >
            {isLogin ? "CREATE FREE ACCOUNT" : "SIGN IN TO DASHBOARD"}
          </button>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="mt-10 flex items-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} />
          <span className="text-[9px] font-black uppercase tracking-widest">Secure Cloud</span>
        </div>
        <div className="flex items-center gap-2">
          <Rocket size={16} />
          <span className="text-[9px] font-black uppercase tracking-widest">Instant Growth</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe size={16} />
          <span className="text-[9px] font-black uppercase tracking-widest">Global SMM</span>
        </div>
      </div>

      {/* Footer Credits */}
      <div className="mt-12 flex flex-col items-center space-y-4">
        <p className="text-[10px] font-black text-[#111B21] dark:text-slate-500 uppercase tracking-[0.3em] opacity-40">
          CREATED BY CHETAN NAGANI
        </p>
        <a 
          href="https://instagram.com/bindash_boy3" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center group"
        >
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-[#312ECB] group-hover:scale-110 group-hover:bg-[#312ECB] group-hover:text-white transition-all duration-300">
            <Instagram size={22} />
          </div>
          <span className="text-[11px] font-black text-[#312ECB] uppercase tracking-[0.3em] mt-3">
            @BINDASH_BOY3
          </span>
        </a>
      </div>
    </div>
  );
}
