"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Login Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader className="text-center">
          <ShieldAlert className="mx-auto w-12 h-12 text-red-500 mb-2" />
          <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input 
            placeholder="Admin Email" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-800 border-slate-700"
          />
          <Input 
            placeholder="Password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-800 border-slate-700"
          />
          <Button onClick={handleLogin} disabled={loading} className="w-full bg-red-600 hover:bg-red-700">
            {loading ? "Authenticating..." : "Access Dashboard"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
