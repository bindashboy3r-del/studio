
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
import { Zap, Instagram, ShieldCheck, Rocket, Globe, Loader2, LogOut, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser } from "@/firebase";
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
  const { user, isUserLoading } = useUser();

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
      toast({ title: "Welcome!", description: "Accessing your dashboard..." });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Login Error", 
        description: error.message || "Invalid credentials." 
      });
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
      
      toast({ title: "Account Created!", description: "Accessing dashboard..." });
      router.push("/chat");
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Registration Error", 
        description: error.message || "Could not create account." 
      });
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!user) return;
    const userEmail = user.email?.toLowerCase();
    if (userEmail === ADMIN_EMAIL.toLowerCase()) {
      router.push("/admin");
    } else {
      router.push("/chat");
    }
  };

  const handleLogoutExisting = async () => {
    if (auth) await signOut(auth);
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0F2F5] dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-[#312ECB] animate-spin mb-3" />
        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">Verifying Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0F2F5] dark:bg-slate-950 p-4 font-body overflow-x-hidden">
      <div className="w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_15px_40px_rgba(0,0,0,0.06)] p-6 pb-8 flex flex-col items-center relative overflow-hidden border border-white/50 dark:border-slate-800">
        
        <div className="absolute top-0 right-0 w-20 h-20 bg-[#312ECB]/5 rounded-full -mr-10 -mt-10 blur-3xl" />

        <div className="w-12 h-12 bg-[#312ECB] rounded-xl flex items-center justify-center shadow-[0_10px_20px_rgba(49,46,203,0.2)] mb-5 relative z-10">
          <Zap className="text-white fill-current" size={24} />
        </div>

        <div className="text-center space-y-1 mb-6 relative z-10">
          <h1 className="text-[20px] font-black tracking-tighter text-[#111B21] dark:text-white uppercase leading-tight">
            {user ? "WELCOME BACK" : "SOCIALBOOST"}
          </h1>
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
            {user ? user.displayName || user.email : "The most powerful SMM automation."}
          </p>
        </div>

        {user ? (
          <div className="w-full space-y-3 relative z-10">
            <Button 
              onClick={handleContinue}
              className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg gap-2"
            >
              Continue to Chat <ArrowRight size={14} />
            </Button>
            <button 
              onClick={handleLogoutExisting}
              className="w-full text-slate-400 font-black text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors"
            >
              Switch Account
            </button>
          </div>
        ) : (
          <form onSubmit={isLogin ? handleLogin : handleSignup} className="w-full space-y-3.5 relative z-10">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[8px] font-black text-[#111B21] dark:text-slate-300 uppercase tracking-widest ml-1">Full Name</label>
                <Input 
                  type="text" 
                  placeholder="Ex. Chetan Nagani" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-4 text-[11px] font-bold shadow-inner"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8px] font-black text-[#111B21] dark:text-slate-300 uppercase tracking-widest ml-1">Email Address</label>
              <Input 
                type="email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-4 text-[11px] font-bold shadow-inner"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-[#111B21] dark:text-slate-300 uppercase tracking-widest ml-1">Password</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-4 text-[11px] font-bold shadow-inner"
                required
              />
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-md transition-all active:scale-95 mt-1"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : isLogin ? "ACCESS PORTAL" : "CREATE ACCOUNT"}
            </Button>
          </form>
        )}

        {!user && (
          <div className="mt-6 text-center relative z-10">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest hover:opacity-80 transition-opacity"
            >
              {isLogin ? "CREATE FREE ACCOUNT" : "SIGN IN TO DASHBOARD"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center space-y-2.5 opacity-30">
        <p className="text-[8px] font-black text-[#111B21] dark:text-slate-500 uppercase tracking-[0.3em]">
          CREATED BY CHETAN NAGANI
        </p>
        <div className="flex gap-3">
          <ShieldCheck size={12} />
          <Rocket size={12} />
          <Globe size={12} />
        </div>
      </div>
    </div>
  );
}
