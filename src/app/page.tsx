
"use client";

import { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { Rocket, Mail, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore } from "@/firebase";

export default function AuthPage() {
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
    <div className="min-h-screen flex items-center justify-center bg-background whatsapp-bg p-4">
      <Card className="w-full max-w-md border-primary/20 bg-white shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#054640] flex items-center justify-center text-white border border-primary/30 shadow-lg">
            <Rocket size={32} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-extrabold tracking-tight text-[#054640]">SocialBoost</CardTitle>
            <CardDescription className="text-black font-semibold">Scale your social media growth instantly.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100">
              <TabsTrigger value="login" className="data-[state=active]:bg-[#054640] data-[state=active]:text-white font-bold">Login</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-[#054640] data-[state=active]:text-white font-bold">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-black flex items-center gap-2">
                    <Mail size={14} className="text-[#054640]" /> EMAIL ADDRESS
                  </label>
                  <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white border-slate-300 text-black font-medium"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-black flex items-center gap-2">
                    <Lock size={14} className="text-[#054640]" /> PASSWORD
                  </label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-slate-300 text-black font-medium"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={loading} 
                  className="w-full h-11 bg-[#054640] hover:bg-[#04332f] text-white font-bold transition-all active:scale-95 shadow-md"
                >
                  {loading ? "AUTHENTICATING..." : "LOGIN TO SOCIALBOOST"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-black flex items-center gap-2">
                    <User size={14} className="text-[#054640]" /> FULL NAME
                  </label>
                  <Input 
                    type="text" 
                    placeholder="John Doe" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-white border-slate-300 text-black font-medium"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-black flex items-center gap-2">
                    <Mail size={14} className="text-[#054640]" /> EMAIL ADDRESS
                  </label>
                  <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white border-slate-300 text-black font-medium"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-black flex items-center gap-2">
                    <Lock size={14} className="text-[#054640]" /> PASSWORD
                  </label>
                  <Input 
                    type="password" 
                    placeholder="Create a strong password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-slate-300 text-black font-medium"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={loading} 
                  className="w-full h-11 bg-[#054640] hover:bg-[#04332f] text-white font-bold transition-all active:scale-95 shadow-md"
                >
                  {loading ? "CREATING ACCOUNT..." : "CREATE FREE ACCOUNT"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="mt-8 text-center text-[10px] text-black uppercase tracking-[0.2em] font-extrabold">
            Professional • Secure • Global
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
