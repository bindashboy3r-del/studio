
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@/firebase";
import { 
  LayoutGrid, 
  Megaphone, 
  Users, 
  ChevronRight, 
  LogOut,
  Zap,
  Wallet,
  Layers,
  QrCode,
  Settings2,
  Share2,
  Percent,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminHub() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
    const ADMIN_ID = "s55uL0f8PmcypR75usVYOLwVs7O2";
    if (!isUserLoading && (!user || (user.email !== ADMIN_EMAIL && user.uid !== ADMIN_ID))) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-6 h-6 border-4 border-[#312ECB] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const menuItems = [
    { title: "TRACKER", icon: <LayoutGrid size={18} />, color: "bg-emerald-500", path: "/admin/tracker" },
    { title: "SERVICES", icon: <Layers size={18} />, color: "bg-blue-500", path: "/admin/services" },
    { title: "FUNDS", icon: <Wallet size={18} />, color: "bg-amber-500", path: "/admin/funds" },
    { title: "BROADCAST", icon: <Megaphone size={18} />, color: "bg-[#312ECB]", path: "/admin/broadcast" },
    { title: "USERS", icon: <Users size={18} />, color: "bg-slate-700", path: "/admin/users" },
    { title: "PAYMENTS", icon: <QrCode size={18} />, color: "bg-pink-500", path: "/admin/payment-settings" },
    { title: "API CONFIG", icon: <Settings2 size={18} />, color: "bg-purple-600", path: "/admin/api-settings" },
    { title: "SOCIAL", icon: <Share2 size={18} />, color: "bg-rose-500", path: "/admin/social-settings" },
    { title: "OFFERS", icon: <Percent size={18} />, color: "bg-indigo-600", path: "/admin/discounts" }
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-slate-950 font-body transition-colors pb-10">
      <header className="bg-white dark:bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#312ECB] rounded-lg flex items-center justify-center text-white shadow-md">
            <ShieldCheck size={18} />
          </div>
          <h1 className="text-sm font-black italic tracking-tighter text-[#312ECB] dark:text-white uppercase">ADMIN HUB</h1>
        </div>
        <button 
          onClick={() => router.push("/profile")}
          className="w-8 h-8 rounded-full bg-[#312ECB] flex items-center justify-center text-white font-black text-[10px] shadow-sm active:scale-95 transition-transform"
        >
          {user.displayName?.[0] || 'A'}
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-[18px] font-black text-[#111B21] dark:text-white tracking-tight uppercase">Dashboard</h2>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Management Console</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => router.push(item.path)}
              className={`${item.color} rounded-[1.2rem] p-4 text-white flex flex-col items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.96] relative overflow-hidden`}
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                {item.icon}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest">{item.title}</span>
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full -mr-6 -mt-6 blur-2xl" />
            </button>
          ))}
        </div>

        <div className="pt-4">
          <Button 
            variant="ghost" 
            onClick={() => auth?.signOut()}
            className="w-full h-12 rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 font-black text-[9px] uppercase tracking-[0.3em] gap-2"
          >
            <LogOut size={14} /> End Session
          </Button>
        </div>
      </main>
    </div>
  );
}
