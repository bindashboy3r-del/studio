
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
  ShieldCheck,
  LayoutGrid
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
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-slate-950 font-body transition-colors">
      <header className="bg-white dark:bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 sticky top-0 z-50">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-[#312ECB] font-black uppercase text-[9px] tracking-widest">
          <ChevronLeft size={14} /> Back
        </button>
        <h1 className="text-[9px] font-black uppercase tracking-[0.2em]">Profile Settings</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4 pb-10">
        <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[1.2rem] overflow-hidden">
          <CardHeader className="bg-[#312ECB] text-white p-6 relative overflow-hidden">
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                <UserIcon size={28} />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">{user?.displayName || 'User'}</CardTitle>
                <CardDescription className="text-white/60 text-[10px] font-bold">{user?.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900">
              <div>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Balance</p>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">₹{walletBalance.toFixed(0)}</p>
              </div>
              <Button onClick={() => router.push('/add-funds')} className="bg-emerald-500 h-9 px-4 rounded-lg font-black uppercase text-[8px] tracking-widest gap-1.5 shadow-md">
                <PlusCircle size={12} /> Refill
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[8px] font-black uppercase text-[#312ECB] tracking-widest bg-[#312ECB]/5 p-2 rounded-xl">
              <CheckCircle2 size={12} /> Verified Account
            </div>
          </CardContent>
        </Card>

        {isActuallyAdmin && (
          <Button 
            onClick={() => router.push("/admin")}
            className="w-full h-12 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black text-[9px] uppercase tracking-[0.2em] rounded-xl shadow-lg gap-2"
          >
            <LayoutGrid size={14} /> Open Admin Dashboard
          </Button>
        )}

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[8px] font-black uppercase text-slate-400 tracking-widest px-1">
            <Lock size={12} /> Security
          </div>
          <Card className="border-none shadow-sm dark:bg-slate-900 rounded-[1.2rem] p-5">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">Current Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                  <Input 
                    type="password" 
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-9 text-xs font-bold"
                    placeholder="Old password"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-1">New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs font-bold" placeholder="Min 6 chars" required />
              </div>
              <Button type="submit" disabled={isUpdating} className="w-full h-11 bg-[#312ECB] text-white font-black text-[9px] uppercase tracking-widest rounded-lg shadow-md">
                {isUpdating ? "UPDATING..." : "SAVE SECURITY"}
              </Button>
            </form>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[8px] font-black uppercase text-slate-400 tracking-widest px-1">
            <HelpCircle size={12} /> Support
          </div>
          <Button asChild variant="outline" className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl font-black text-[9px] uppercase tracking-widest gap-2 shadow-sm">
            <a href="https://wa.me/919116399517" target="_blank" rel="noopener noreferrer"><MessageCircle size={14} className="text-[#25D366]" /> WhatsApp Support</a>
          </Button>
        </section>

        <div className="pt-4">
          <Button onClick={handleLogout} variant="ghost" className="w-full h-12 text-red-500 font-black text-[9px] uppercase tracking-widest gap-2">
            <LogOut size={14} /> Logout Account
          </Button>
        </div>
      </main>
    </div>
  );
}
