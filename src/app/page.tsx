"use client";

import { useState, useEffect } from "react";
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { ShoppingCart, Phone, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser } from "@/firebase";

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user) router.push("/chat");
  }, [user, router]);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier && auth) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const onSendCode = async () => {
    if (!phoneNumber || !auth) return;
    setLoading(true);
    try {
      setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setStep('otp');
      toast({ title: "OTP Sent", description: "Please check your messages." });
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const onVerifyCode = async () => {
    if (!otp || !confirmationResult || !db) return;
    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      const loggedUser = result.user;
      
      const userDoc = await getDoc(doc(db, "users", loggedUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", loggedUser.uid), {
          phone: loggedUser.phoneNumber,
          createdAt: serverTimestamp()
        });
      }
      
      router.push("/chat");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Invalid OTP" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background chat-bg p-4 dark">
      <div id="recaptcha-container"></div>
      
      <Card className="w-full max-w-md border-primary/20 bg-card/80 backdrop-blur-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
            <ShoppingCart size={32} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">ChatServe Bot</CardTitle>
            <CardDescription>Experience the future of SMM services via chat.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'phone' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Phone size={14} className="text-primary" /> Phone Number
                </label>
                <Input 
                  type="tel" 
                  placeholder="+1234567890" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <Button 
                onClick={onSendCode} 
                disabled={loading || !phoneNumber} 
                className="w-full h-12 text-lg font-semibold"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck size={14} className="text-primary" /> OTP Code
                </label>
                <Input 
                  type="number" 
                  placeholder="123456" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="bg-background/50 text-center tracking-widest text-xl font-bold"
                />
              </div>
              <Button 
                onClick={onVerifyCode} 
                disabled={loading || !otp} 
                className="w-full h-12 text-lg font-semibold"
              >
                {loading ? "Verifying..." : "Confirm & Login"}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setStep('phone')} 
                className="w-full text-muted-foreground"
              >
                Change Phone Number
              </Button>
            </div>
          )}
          
          <div className="text-center text-[11px] text-muted-foreground uppercase tracking-widest">
            Safe • Secure • Reliable
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
