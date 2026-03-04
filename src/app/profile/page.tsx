
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
  FileText, 
  User as UserIcon,
  CheckCircle2,
  MessageCircle,
  Instagram,
  X,
  KeyRound,
  Wallet,
  PlusCircle,
  Settings2,
  QrCode,
  Share2,
  Percent,
  ShieldCheck,
  Zap
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

  // Admin Identification
  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const isActuallyAdmin = user?.email === ADMIN_EMAIL;

  // User Profile Listener for Balance
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
      toast({ variant: "destructive", title: "Passwords Mismatch", description: "New password and confirmation do not match." });
      return;
    }

    setIsUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      toast({ title: "Success", description: "Your password has been updated successfully." });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
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
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-slate-950 font-body text-[#111B21] dark:text-white transition-colors">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-[#312ECB] dark:text-blue-400 font-black uppercase text-xs tracking-widest hover:opacity-70 transition-opacity"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-[#111B21] dark:text-white">Profile Settings</h1>
        <div className="w-20" />
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6 pb-20">
        {/* Profile Card */}
        <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-[#312ECB] text-white p-8 relative overflow-hidden">
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center">
                <UserIcon size={40} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">{user?.displayName || 'User'}</CardTitle>
                <CardDescription className="text-white/60 font-medium">{user?.email}</CardDescription>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-[2rem] border border-emerald-100 dark:border-emerald-900">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                  <Wallet size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Wallet Balance</p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">₹{walletBalance.toFixed(0)}</p>
                </div>
              </div>
              <Button 
                onClick={() => router.push('/add-funds')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 px-6 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg"
              >
                <PlusCircle size={14} /> Refill
              </Button>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-[#312ECB] dark:text-blue-400 tracking-widest bg-[#312ECB]/5 dark:bg-blue-400/5 p-3 rounded-2xl">
              <CheckCircle2 size={16} /> Verified SocialBoost Account
            </div>
          </CardContent>
        </Card>

        {/* Admin Management Section - Centralized */}
        {isActuallyAdmin && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-pink-600 tracking-[0.2em] px-2">
              <ShieldCheck size={14} /> Admin Management
            </div>
            <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] dark:bg-slate-900 rounded-[2.5rem] p-6">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => router.push("/admin/payment-settings")}
                  className="flex flex-col items-center gap-3 p-5 bg-pink-50 dark:bg-pink-900/10 rounded-3xl border border-pink-100 dark:border-pink-900/30 hover:scale-[1.02] transition-transform active:scale-95"
                >
                  <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <QrCode size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400 tracking-widest">Payments</span>
                </button>

                <button 
                  onClick={() => router.push("/admin/gateway-settings")}
                  className="flex flex-col items-center gap-3 p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 hover:scale-[1.02] transition-transform active:scale-95"
                >
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Zap size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">Gateway</span>
                </button>

                <button 
                  onClick={() => router.push("/admin/api-settings")}
                  className="flex flex-col items-center gap-3 p-5 bg-purple-50 dark:bg-purple-900/10 rounded-3xl border border-purple-100 dark:border-purple-900/30 hover:scale-[1.02] transition-transform active:scale-95"
                >
                  <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Settings2 size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-widest">API Config</span>
                </button>

                <button 
                  onClick={() => router.push("/admin/social-settings")}
                  className="flex flex-col items-center gap-3 p-5 bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-100 dark:border-rose-900/30 hover:scale-[1.02] transition-transform active:scale-95"
                >
                  <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <Share2 size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-widest">Social</span>
                </button>

                <button 
                  onClick={() => router.push("/admin/discounts")}
                  className="flex flex-col items-center gap-3 p-5 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 hover:scale-[1.02] transition-transform active:scale-95 col-span-2"
                >
                  <div className="w-full flex items-center justify-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <Percent size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">Discount Manager</span>
                  </div>
                </button>
              </div>
            </Card>
          </section>
        )}

        {/* Security Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">
            <Lock size={14} /> Security Management
          </div>
          <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] dark:bg-slate-900 rounded-[2.5rem] p-8">
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-[#111B21] dark:text-slate-300 tracking-widest ml-1">Current Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <Input 
                    type="password" 
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-5 text-sm font-bold text-slate-800 dark:text-white"
                    placeholder="Enter old password"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-[#111B21] dark:text-slate-300 tracking-widest ml-1">New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 text-sm font-bold text-slate-800 dark:text-white" placeholder="Minimum 6 characters" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-[#111B21] dark:text-slate-300 tracking-widest ml-1">Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 text-sm font-bold text-slate-800 dark:text-white" placeholder="Re-type new password" required />
              </div>
              <Button type="submit" disabled={isUpdating} className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">
                {isUpdating ? "Updating..." : "Update Security"}
              </Button>
            </form>
          </Card>
        </section>

        {/* Support Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">
            <HelpCircle size={14} /> Support & Terms
          </div>
          <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] dark:bg-slate-900 rounded-[2.5rem] p-6 space-y-3">
            <Dialog>
              <DialogTrigger asChild>
                <button className="w-full flex items-center justify-between text-[12px] font-black uppercase tracking-widest text-[#111B21] dark:text-white px-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <HelpCircle size={16} className="text-[#312ECB] dark:text-blue-400" />
                    Support Center
                  </div>
                  <ChevronLeft size={16} className="rotate-180 text-slate-300" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-[90%] sm:max-w-[400px] rounded-[3rem] p-8 border-none bg-[#F3F4F9] dark:bg-slate-900 shadow-2xl">
                <DialogHeader className="text-center mb-8">
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#111B21] dark:text-white">CONTACT SUPPORT</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Button asChild className="w-full h-14 bg-[#25D366] hover:bg-[#20bd5b] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-lg border-none">
                    <a href="https://wa.me/919116399517" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3"><MessageCircle size={20} /> WhatsApp Support</a>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </Card>
        </section>

        <div className="pt-4">
          <Button onClick={handleLogout} variant="outline" className="w-full h-14 border-red-100 dark:border-red-950/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-black text-[11px] uppercase tracking-widest rounded-2xl border-2 transition-all">
            <LogOut size={16} className="mr-2" /> Logout Account
          </Button>
        </div>
      </main>
    </div>
  );
}
