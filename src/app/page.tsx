
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
import { Rocket, Mail, Lock, User, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser } from "@/firebase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
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
        email,
        displayName,
        createdAt: serverTimestamp()
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
      <Card className="w-full max-w-md border-primary/20 bg-white/90 backdrop-blur-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#0F5C53] flex items-center justify-center text-white border border-primary/30">
            <Rocket size={32} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold tracking-tight text-[#0F5C53]">SocialBoost</CardTitle>
            <CardDescription className="text-[#2E2E2E]/70">Scale your social media growth instantly.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!isUserLoading && user ? (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-[#2E2E2E]">Welcome back, <span className="text-[#0F5C53] font-bold">{user.displayName || 'User'}</span></p>
                <p className="text-xs text-[#8A8A8A]">You are currently logged in.</p>
              </div>
              <Button 
                onClick={() => router.push("/chat")}
                className="w-full h-12 bg-[#25D366] hover:bg-[#20bd5b] text-white font-bold gap-2 transition-all hover:scale-[1.02]"
              >
                Continue to Chat <ArrowRight size={18} />
              </Button>
              <button 
                onClick={() => auth?.signOut()}
                className="w-full text-xs text-red-500 hover:underline"
              >
                Sign out of this account
              </button>
            </div>
          ) : (
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100">
                <TabsTrigger value="login" className="data-[state=active]:bg-[#0F5C53] data-[state=active]:text-white">Login</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-[#0F5C53] data-[state=active]:text-white">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#2E2E2E] flex items-center gap-2">
                      <Mail size={14} className="text-[#0F5C53]" /> Email Address
                    </label>
                    <Input 
                      type="email" 
                      placeholder="name@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#2E2E2E] flex items-center gap-2">
                      <Lock size={14} className="text-[#0F5C53]" /> Password
                    </label>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={loading} 
                    className="w-full h-11 bg-[#0F5C53] hover:bg-[#0d4d45] text-white font-semibold transition-all hover:scale-[1.02]"
                  >
                    {loading ? "Authenticating..." : "Login to SocialBoost"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#2E2E2E] flex items-center gap-2">
                      <User size={14} className="text-[#0F5C53]" /> Full Name
                    </label>
                    <Input 
                      type="text" 
                      placeholder="John Doe" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#2E2E2E] flex items-center gap-2">
                      <Mail size={14} className="text-[#0F5C53]" /> Email Address
                    </label>
                    <Input 
                      type="email" 
                      placeholder="name@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#2E2E2E] flex items-center gap-2">
                      <Lock size={14} className="text-[#0F5C53]" /> Password
                    </label>
                    <Input 
                      type="password" 
                      placeholder="Create a strong password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={loading} 
                    className="w-full h-11 bg-[#0F5C53] hover:bg-[#0d4d45] text-white font-semibold transition-all hover:scale-[1.02]"
                  >
                    {loading ? "Creating Account..." : "Create Free Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
          
          <div className="mt-8 text-center text-[10px] text-[#8A8A8A] uppercase tracking-[0.2em] font-medium">
            Professional • Secure • Global
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
