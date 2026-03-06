
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@/firebase";
import { 
  LayoutGrid, 
  Megaphone, 
  Users, 
  LogOut,
  Wallet,
  Layers,
  QrCode,
  Settings2,
  Share2,
  Percent,
  ShieldCheck,
  ChevronRight,
  Ticket
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminHub() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) router.push("/admin/login");
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="w-8 h-8 border-4 border-[#312ECB] border-t-transparent rounded-full animate-spin" /></div>;

  const menuItems = [
    { title: "Live Tracker", icon: <LayoutGrid size={20} />, color: "bg-emerald-500", path: "/admin/tracker", desc: "Monitor orders" },
    { title: "SMM Services", icon: <Layers size={20} />, color: "bg-blue-500", path: "/admin/services", desc: "Manage catalog" },
    { title: "Fund Approvals", icon: <Wallet size={20} />, color: "bg-amber-500", path: "/admin/funds", desc: "Verify payments" },
    { title: "Redeem Codes", icon: <Ticket size={20} />, color: "bg-orange-500", path: "/admin/redeem", desc: "Create vouchers" },
    { title: "Broadcasts", icon: <Megaphone size={20} />, color: "bg-[#312ECB]", path: "/admin/broadcast", desc: "Announcements" },
    { title: "Users List", icon: <Users size={20} />, color: "bg-slate-700", path: "/admin/users", desc: "Database access" },
    { title: "Payments", icon: <QrCode size={20} />, color: "bg-pink-500", path: "/admin/payment-settings", desc: "QR & UPI Setup" },
    { title: "API Config", icon: <Settings2 size={20} />, color: "bg-purple-600", path: "/admin/api-settings", desc: "Connect Panels" },
    { title: "Social Links", icon: <Share2 size={20} />, color: "bg-rose-500", path: "/admin/social-settings", desc: "External Links" },
    { title: "Offers", icon: <Percent size={20} />, color: "bg-indigo-600", path: "/admin/discounts", desc: "Global Discounts" }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 font-body transition-colors pb-20">
      <header className="glass-header px-6 py-4 flex items-center justify-between shadow-3d-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#312ECB] rounded-2xl flex items-center justify-center text-white shadow-3d"><ShieldCheck size={22} /></div>
          <div>
            <h1 className="text-lg font-black italic tracking-tighter text-[#312ECB] dark:text-white uppercase">ADMIN HUB</h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Management Console</p>
          </div>
        </div>
        <button onClick={() => router.push("/profile")} className="w-10 h-10 rounded-2xl bg-[#312ECB]/10 dark:bg-white/5 flex items-center justify-center text-[#312ECB] dark:text-white font-black text-sm transition-all active:shadow-3d-pressed border border-[#312ECB]/10 shadow-3d-sm">{user.displayName?.[0] || 'A'}</button>
      </header>

      <main className="max-w-xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => router.push(item.path)}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 text-left flex flex-col gap-4 shadow-3d border border-slate-50 dark:border-slate-800 transition-all active:shadow-3d-pressed group relative overflow-hidden"
            >
              <div className={`${item.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-3d-sm group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              <div>
                <h2 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-tight">{item.title}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{item.desc}</p>
              </div>
              <ChevronRight className="absolute bottom-5 right-5 text-slate-200 dark:text-slate-700 group-hover:text-[#312ECB] transition-colors" size={16} />
            </button>
          ))}
        </div>

        <div className="pt-6">
          <Button 
            variant="ghost" 
            onClick={() => auth?.signOut()}
            className="w-full h-14 rounded-3xl text-slate-400 dark:text-slate-500 hover:text-red-500 font-black text-[11px] uppercase tracking-[0.2em] gap-3 border-none bg-white dark:bg-slate-900 shadow-3d active:shadow-3d-pressed transition-all"
          >
            <LogOut size={16} /> Close Management Session
          </Button>
        </div>
      </main>
    </div>
  );
}
