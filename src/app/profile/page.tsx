
"use client";

import { useState } from "react";
import { updatePassword, signOut, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ChevronLeft, 
  LogOut, 
  Lock, 
  HelpCircle, 
  User as UserIcon,
  CheckCircle2,
  MessageCircle,
  KeyRound,
  Wallet,
  PlusCircle,
  LayoutGrid,
  FileText,
  X,
  ShieldCheck
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFirestore } from "@/firebase";

export default function ProfilePage() {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const ADMIN_ID = "s55uL0f8PmcypR75usVYOLwVs7O2";
  const isActuallyAdmin = user?.email === ADMIN_EMAIL || user?.uid === ADMIN_ID;

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: userData } = useDoc(userDocRef);
  const walletBalance = userData?.balance || 0;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser || !user?.email) return;
    
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords Mismatch" });
      return;
    }

    setIsUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      toast({ title: "Updated!", description: "Password changed successfully." });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#030712] font-body transition-colors">
      <header className="bg-slate-900/90 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50 px-4 py-3 flex items-center justify-between shadow-lg">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[10px] tracking-widest">
          <ChevronLeft size={16} /> BACK
        </button>
        <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Profile Settings</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6 pb-20">
        <Card className="border border-white/5 shadow-2xl bg-slate-900 rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-[#312ECB] text-white p-8 relative overflow-hidden">
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg">
                <UserIcon size={32} />
              </div>
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">{user?.displayName || 'User'}</CardTitle>
                <CardDescription className="text-white/60 text-[11px] font-bold mt-1">{user?.email}</CardDescription>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between bg-emerald-500/10 p-5 rounded-[1.5rem] border border-emerald-500/20 shadow-inner">
              <div>
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Balance</p>
                <p className="text-2xl font-black text-white">₹{walletBalance.toFixed(0)}</p>
              </div>
              <Button onClick={() => router.push('/add-funds')} className="bg-emerald-500 hover:bg-emerald-600 h-10 px-5 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 shadow-lg">
                <PlusCircle size={14} /> Refill
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-[#312ECB] tracking-widest bg-[#312ECB]/10 p-3 rounded-2xl border border-[#312ECB]/20">
              <CheckCircle2 size={14} /> Verified Member
            </div>
          </CardContent>
        </Card>

        {isActuallyAdmin && (
          <Button 
            onClick={() => router.push("/admin")}
            className="w-full h-14 bg-white text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl gap-3 active:scale-95 transition-all"
          >
            <ShieldCheck size={18} /> OPEN ADMIN DASHBOARD
          </Button>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-300 tracking-widest px-2">
            <Lock size={14} className="text-[#312ECB]" /> SECURITY
          </div>
          <Card className="border border-white/5 shadow-xl bg-slate-900 rounded-[2rem] p-6">
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Current Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <Input 
                    type="password" 
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="h-12 bg-slate-950 border-none rounded-xl pl-12 text-sm font-bold text-white shadow-inner focus-visible:ring-1 focus-visible:ring-[#312ECB]/30"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">New Password</Label>
                <Input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className="h-12 bg-slate-950 border-none rounded-xl px-5 text-sm font-bold text-white shadow-inner focus-visible:ring-1 focus-visible:ring-[#312ECB]/30" 
                  placeholder="Min 6 characters" 
                  required 
                />
              </div>
              <Button type="submit" disabled={isUpdating} className="w-full h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95">
                {isUpdating ? "UPDATING..." : "SAVE NEW PASSWORD"}
              </Button>
            </form>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-300 tracking-widest px-2">
            <HelpCircle size={14} className="text-emerald-500" /> SUPPORT & LEGAL
          </div>
          <div className="space-y-3">
            <Button asChild variant="outline" className="w-full h-14 bg-slate-900 border-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest gap-3 shadow-lg active:shadow-inner text-white">
              <a href="https://wa.me/919116399517" target="_blank" rel="noopener noreferrer">
                <MessageCircle size={18} className="text-[#25D366]" /> WHATSAPP SUPPORT
              </a>
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-14 bg-slate-900 border-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest gap-3 shadow-lg active:shadow-inner text-white">
                  <FileText size={18} className="text-blue-500" /> TERMS & CONDITIONS
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[360px] rounded-[2.5rem] border-none shadow-2xl bg-[#030712] p-0 overflow-hidden">
                <div className="p-8 space-y-8 relative">
                  <DialogHeader className="space-y-2 text-center">
                    <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight">Terms & Conditions</DialogTitle>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">SocialBoost Official Guidelines</p>
                  </DialogHeader>

                  <div className="space-y-6">
                    <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <h4 className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">1. Service Usage</h4>
                      <p className="text-[12px] font-bold text-slate-300 leading-relaxed">
                        SocialBoost is an automation tool for social media services. We are not affiliated with Instagram or Meta.
                      </p>
                    </div>

                    <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <h4 className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">2. Account Safety</h4>
                      <p className="text-[12px] font-bold text-slate-300 leading-relaxed">
                        We do not ask for your Instagram password. Ensure your account is <span className="text-red-500 uppercase">Public</span> before ordering any service.
                      </p>
                    </div>

                    <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <h4 className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">3. Refund Policy</h4>
                      <p className="text-[12px] font-bold text-slate-300 leading-relaxed">
                        Once payment is confirmed and order is placed, no refunds will be processed. All sales are final.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 text-center">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic">© 2025 SOCIALBOOST PRO SYSTEM</p>
                  </div>
                  
                  <button onClick={() => router.refresh()} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <div className="pt-6">
          <Button onClick={handleLogout} variant="ghost" className="w-full h-14 text-red-500 hover:text-red-400 font-black text-[10px] uppercase tracking-widest gap-2 bg-red-500/5 rounded-2xl border border-red-500/10">
            <LogOut size={18} /> LOGOUT ACCOUNT
          </Button>
        </div>
      </main>
    </div>
  );
}
