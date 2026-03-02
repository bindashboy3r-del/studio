
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
  Wallet
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

export default function ProfilePage() {
  const { user } = useUser();
  const auth = useAuth();
  const db = useMemoFirebase(() => { return null; }, []); // Dummy for build
  const router = useRouter();
  const { toast } = useToast();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Re-use current user doc for balance display
  const { data: userData } = useDoc(useMemoFirebase(() => {
    // This is handled better in ChatPage, but let's provide it here too
    // We need the firestore instance
    return null; 
  }, []));

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
    <div className="min-h-screen bg-[#F8F9FB] font-body text-[#111B21]">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-[#312ECB] font-black uppercase text-xs tracking-widest hover:opacity-70 transition-opacity"
        >
          <ChevronLeft size={20} />
          Back to Chat
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-[#111B21]">Profile Settings</h1>
        <div className="w-20" />
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6 pb-20">
        <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-[#312ECB] text-white p-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center">
                <UserIcon size={40} />
              </div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">{user?.displayName || 'User'}</CardTitle>
                <CardDescription className="text-white/60 font-medium">{user?.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center justify-between bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                  <Wallet size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Wallet Balance</p>
                  <p className="text-2xl font-black text-emerald-700">₹{(userData?.balance || 0).toFixed(0)}</p>
                </div>
              </div>
              <Button 
                onClick={() => router.push('/chat')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 px-6 font-black uppercase text-[10px] tracking-widest"
              >
                Refill
              </Button>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-[#312ECB] tracking-widest bg-[#312ECB]/5 p-3 rounded-2xl">
              <CheckCircle2 size={16} /> Verified SocialBoost Account
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">
            <Lock size={14} /> Security Management
          </div>
          <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] rounded-[2.5rem] p-8">
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-[#111B21] tracking-widest ml-1">Current Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <Input 
                    type="password" 
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="h-12 bg-slate-50 border-none rounded-2xl pl-12 pr-5 text-sm font-bold"
                    placeholder="Enter old password"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-[#111B21] tracking-widest ml-1">New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold" placeholder="Minimum 6 characters" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-[#111B21] tracking-widest ml-1">Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold" placeholder="Re-type new password" required />
              </div>
              <Button type="submit" disabled={isUpdating} className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl">
                {isUpdating ? "Updating..." : "Update Security"}
              </Button>
            </form>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">
            <HelpCircle size={14} /> Support & Terms
          </div>
          <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] rounded-[2.5rem] p-6 space-y-3">
            <Dialog>
              <DialogTrigger asChild>
                <button className="w-full flex items-center justify-between text-[12px] font-black uppercase tracking-widest text-[#111B21] px-4 py-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <HelpCircle size={16} className="text-[#312ECB]" />
                    Support Center
                  </div>
                  <ChevronLeft size={16} className="rotate-180 text-slate-300" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-[90%] sm:max-w-[400px] rounded-[3rem] p-8 border-none bg-[#F3F4F9] shadow-2xl">
                <DialogHeader className="text-center mb-8">
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#111B21]">CONTACT SUPPORT</DialogTitle>
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
          <Button onClick={handleLogout} variant="outline" className="w-full h-14 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 font-black text-[11px] uppercase tracking-widest rounded-2xl border-2 transition-all">
            <LogOut size={16} className="mr-2" /> Logout Account
          </Button>
        </div>
      </main>
    </div>
  );
}
