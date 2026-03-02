"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Lock, User as UserIcon } from "lucide-react";
import { useAuth } from "@/firebase";

export default function AdminLoginPage() {
  // Pre-filling as requested for convenience in this prototype
  const [email, setEmail] = useState("chetanmadhav4@gmail.com");
  const [password, setPassword] = useState("Jolly4554");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Access Denied", 
        description: error.code === 'auth/user-not-found' 
          ? "Admin user not found. Please create this account in Firebase Console." 
          : error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 font-body">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(220,38,38,0.3)] mb-4">
            <ShieldAlert className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Admin Portal</h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Authorized Access Only</p>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-[2.5rem] overflow-hidden">
          <CardContent className="p-8 pt-10">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Email</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <Input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 bg-slate-800 border-none rounded-2xl pl-12 pr-5 text-white font-bold placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-red-500/50"
                    placeholder="admin@socialboost.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <Input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 bg-slate-800 border-none rounded-2xl pl-12 pr-5 text-white font-bold placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-red-500/50"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black text-[13px] uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95"
              >
                {loading ? "Authenticating..." : "Enter Dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center mt-8 text-[9px] font-black text-slate-600 uppercase tracking-[0.5em]">
          SocialBoost Security Systems
        </p>
      </div>
    </div>
  );
}
