
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
import { Zap, Instagram } from "lucide-react";
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !auth) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/chat");
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
        createdAt: new Date().toISOString()
      });
      
      router.push("/chat");
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#E9EBF0] p-6 font-body">
      <div className="w-full max-w-[440px] bg-white rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-10 pb-12 flex flex-col items-center">
        
        {/* Logo Icon */}
        <div className="w-16 h-16 bg-[#312ECB] rounded-2xl flex items-center justify-center shadow-[0_8px_16px_rgba(49,46,203,0.3)] mb-8">
          <Zap className="text-white fill-current" size={32} />
        </div>

        {/* Heading */}
        <h1 className="text-[28px] font-black tracking-tight text-[#111B21] uppercase text-center mb-2">
          SOCIALBOOST ACCESS
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-10">
          {isLogin ? "SIGN IN TO MANAGE YOUR ORDERS" : "CREATE AN ACCOUNT TO GET STARTED"}
        </p>

        {/* Form */}
        <form onSubmit={isLogin ? handleLogin : handleSignup} className="w-full space-y-6">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#111B21] uppercase tracking-wider ml-1">
                FULL NAME
              </label>
              <Input 
                type="text" 
                placeholder="Enter your name..." 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-semibold placeholder:text-slate-300 shadow-none focus-visible:ring-1 focus-visible:ring-[#312ECB]/20"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#111B21] uppercase tracking-wider ml-1">
              USERNAME OR EMAIL
            </label>
            <Input 
              type="email" 
              placeholder="Enter details..." 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-semibold placeholder:text-slate-300 shadow-none focus-visible:ring-1 focus-visible:ring-[#312ECB]/20"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#111B21] uppercase tracking-wider ml-1">
              PASSWORD
            </label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-semibold placeholder:text-slate-300 shadow-none focus-visible:ring-1 focus-visible:ring-[#312ECB]/20"
              required
            />
          </div>

          <Button 
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[13px] uppercase tracking-widest rounded-2xl shadow-[0_12px_24px_rgba(49,46,203,0.25)] transition-all active:scale-95 mt-4"
          >
            {loading ? "PROCESSING..." : isLogin ? "ACCESS DASHBOARD" : "CREATE ACCOUNT"}
          </Button>
        </form>

        {/* Toggle */}
        <div className="mt-8 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            {isLogin ? "DON'T HAVE AN ACCOUNT?" : "ALREADY HAVE AN ACCOUNT?"}
          </p>
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[12px] font-black text-[#312ECB] uppercase tracking-wider hover:underline"
          >
            {isLogin ? "CREATE FREE ACCOUNT" : "SIGN IN TO DASHBOARD"}
          </button>
        </div>
      </div>

      {/* Footer Credits */}
      <div className="mt-12 flex flex-col items-center space-y-3">
        <p className="text-[9px] font-black text-[#111B21] uppercase tracking-[0.25em]">
          SOCIALBOOST CREATE BY CHETAN NAGANI
        </p>
        <a 
          href="https://instagram.com/bindash_boy3" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col items-center group"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#312ECB] group-hover:scale-110 transition-transform">
            <Instagram size={20} />
          </div>
          <span className="text-[11px] font-black text-[#312ECB] uppercase tracking-widest">
            @BINDASH_BOY3
          </span>
        </a>
      </div>
    </div>
  );
}
