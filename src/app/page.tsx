"use client";

import { useState, useEffect } from "react";
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
import { useAuth, useFirestore, useUser } from "@/firebase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user) router.push("/chat");
  }, [user, router]);

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
    <div className="min-h-screen flex items-center justify-center bg-background chat-bg p-4 dark">
      <Card className="w-full max-w-md border-primary/20 bg-card/80 backdrop-blur-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
            <Rocket size={32} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold tracking-tight">SocialBoost</CardTitle>
            <CardDescription>Scale your social media growth instantly.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail size={14} className="text-primary" /> Email Address
                  </label>
                  <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Lock size={14} className="text-primary" /> Password
                  </label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={loading} 
                  className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.02]"
                >
                  {loading ? "Authenticating..." : "Login to SocialBoost"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <User size={14} className="text-primary" /> Full Name
                  </label>
                  <Input 
                    type="text" 
                    placeholder="John Doe" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-background/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail size={14} className="text-primary" /> Email Address
                  </label>
                  <Input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Lock size={14} className="text-primary" /> Password
                  </label>
                  <Input 
                    type="password" 
                    placeholder="Create a strong password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/50"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={loading} 
                  className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.02]"
                >
                  {loading ? "Creating Account..." : "Create Free Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="mt-8 text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium">
            Professional • Secure • Global
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
