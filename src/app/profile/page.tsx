"use client";

import { useState } from "react";
import { updatePassword, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@/firebase";
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
  X
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
  const router = useRouter();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.currentUser) return;
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords Mismatch", description: "New password and confirmation do not match." });
      return;
    }

    setIsUpdating(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast({ title: "Success", description: "Your password has been updated successfully." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Update Failed", 
        description: error.message || "Failed to update password. You may need to login again for security." 
      });
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
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-[#312ECB] font-black uppercase text-xs tracking-widest hover:opacity-70 transition-opacity"
        >
          <ChevronLeft size={20} />
          Back to Chat
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-[#111B21]">Profile Settings</h1>
        <div className="w-20" /> {/* Spacer */}
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-8 pb-20">
        {/* User Card */}
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
          <CardContent className="p-8 pt-6">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-[#312ECB] tracking-widest bg-[#312ECB]/5 p-3 rounded-2xl">
              <CheckCircle2 size={16} /> Verified Account
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">
            <Lock size={14} /> Security Management
          </div>
          <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] rounded-[2.5rem] p-8">
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-[#111B21] tracking-widest ml-1">New Password</Label>
                <Input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-[#111B21] tracking-widest ml-1">Confirm New Password</Label>
                <Input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold shadow-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isUpdating}
                className="w-full h-14 bg-[#312ECB] hover:bg-[#2825A6] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-[0_12px_24px_rgba(49,46,203,0.15)]"
              >
                {isUpdating ? "Processing..." : "Update Security"}
              </Button>
            </form>
          </Card>
        </section>

        {/* Support & Terms */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-2">
            <HelpCircle size={14} /> Support & Terms
          </div>
          <Card className="border-none shadow-[0_10px_40px_rgba(0,0,0,0.03)] rounded-[2.5rem] p-6 space-y-3">
            
            {/* Support Dialog (Contact Options) */}
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
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#111B21]">
                    CONTACT SUPPORT
                  </DialogTitle>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    HOW CAN WE HELP YOU TODAY?
                  </p>
                </DialogHeader>

                <div className="space-y-4">
                  <Button 
                    asChild
                    className="w-full h-14 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-lg border-none"
                  >
                    <a href="https://www.instagram.com/social_boost.bot?igsh=MWg4OXI2N2E0Ynltdg==" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3">
                      <Instagram size={20} />
                      Instagram Support
                    </a>
                  </Button>

                  <Button 
                    asChild
                    className="w-full h-14 bg-[#25D366] hover:bg-[#20bd5b] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-lg border-none"
                  >
                    <a href="https://wa.me/919116399517" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3">
                      <MessageCircle size={20} />
                      WhatsApp Support
                    </a>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Terms & Conditions Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <button className="w-full flex items-center justify-between text-[12px] font-black uppercase tracking-widest text-[#111B21] px-4 py-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-[#312ECB]" />
                    Terms & Conditions
                  </div>
                  <ChevronLeft size={16} className="rotate-180 text-slate-300" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-[90%] sm:max-w-[400px] rounded-[3rem] p-8 border-none bg-[#F3F4F9] shadow-2xl">
                <DialogHeader className="text-center mb-8">
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight text-[#111B21]">
                    TERMS & CONDITIONS
                  </DialogTitle>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    SOCIALBOOST OFFICIAL GUIDELINES
                  </p>
                </DialogHeader>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black text-[#312ECB] uppercase tracking-widest">
                      1. SERVICE USAGE
                    </h3>
                    <p className="text-[13px] font-semibold text-slate-600 leading-relaxed">
                      SocialBoost is an automation tool for social media services. We are not affiliated with Instagram.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black text-[#312ECB] uppercase tracking-widest">
                      2. ACCOUNT SAFETY
                    </h3>
                    <p className="text-[13px] font-semibold text-slate-600 leading-relaxed">
                      We do not ask for your Instagram password. Ensure your account is PUBLIC before ordering.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black text-[#312ECB] uppercase tracking-widest">
                      3. REFUND POLICY
                    </h3>
                    <p className="text-[13px] font-semibold text-slate-600 leading-relaxed">
                      Once payment is confirmed, no refunds will be processed as order is final.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </Card>
        </section>

        {/* Logout */}
        <div className="pt-4">
          <Button 
            onClick={handleLogout}
            variant="outline" 
            className="w-full h-14 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 font-black text-[11px] uppercase tracking-widest rounded-2xl border-2 transition-all"
          >
            <LogOut size={16} className="mr-2" /> 
            Logout Account
          </Button>
        </div>

        {/* Branding Footer */}
        <div className="text-center pt-8">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
            v2.4.0 • Secured by SocialBoost Systems
          </p>
        </div>
      </main>
    </div>
  );
}
