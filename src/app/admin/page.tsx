
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@/firebase";
import { 
  LayoutGrid, 
  Megaphone, 
  Users, 
  ChevronRight, 
  Moon, 
  Bell, 
  LogOut,
  Zap,
  Wallet,
  Settings2,
  QrCode,
  Layers,
  Percent,
  Share2,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminHub() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const menuItems = [
    {
      title: "LIVE TRACKER",
      subtitle: "APPROVE & REJECT ORDERS",
      icon: <LayoutGrid size={28} />,
      color: "bg-[#10B981]", 
      path: "/admin/tracker"
    },
    {
      title: "SERVICE MANAGER",
      subtitle: "EDIT PRICES & ADD SERVICES",
      icon: <Layers size={28} />,
      color: "bg-[#3B82F6]", 
      path: "/admin/services"
    },
    {
      title: "DISCOUNT MANAGER",
      subtitle: "SET SINGLE, COMBO & BULK %",
      icon: <Percent size={28} />,
      color: "bg-[#6366F1]", 
      path: "/admin/discounts"
    },
    {
      title: "SOCIAL MEDIA",
      subtitle: "MANAGE EXTERNAL LINKS",
      icon: <Share2 size={28} />,
      color: "bg-[#F43F5E]", 
      path: "/admin/social-settings"
    },
    {
      title: "FUND REQUESTS",
      subtitle: "APPROVE WALLET TOP-UPS",
      icon: <Wallet size={28} />,
      color: "bg-[#F59E0B]", 
      path: "/admin/funds"
    },
    {
      title: "PAYMENT SETTINGS",
      subtitle: "QR & MERCHANT CONFIG",
      icon: <QrCode size={28} />,
      color: "bg-[#EC4899]", 
      path: "/admin/payment-settings"
    },
    {
      title: "API SETTINGS",
      subtitle: "CONNECT SMM PANEL",
      icon: <Settings2 size={28} />,
      color: "bg-[#7C3AED]", 
      path: "/admin/api-settings"
    },
    {
      title: "BROADCAST MSG",
      subtitle: "REAL-TIME ANNOUNCEMENTS",
      icon: <Megaphone size={28} />,
      color: "bg-[#312ECB]", 
      path: "/admin/broadcast"
    },
    {
      title: "ALL USERS",
      subtitle: "DATABASE & CONTACT LIST",
      icon: <Users size={28} />,
      color: "bg-[#1F2937]", 
      path: "/admin/users"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-body transition-colors">
      <header className="bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#312ECB] rounded-xl flex items-center justify-center text-white shadow-lg">
            <Zap className="fill-current" size={20} />
          </div>
          <h1 className="text-xl font-black italic tracking-tighter text-[#312ECB] dark:text-white uppercase">SOCIALBOOST</h1>
        </div>
        <div className="flex items-center gap-5">
          <button 
            onClick={() => router.push("/profile")}
            className="w-10 h-10 rounded-full bg-[#312ECB] flex items-center justify-center text-white font-black text-sm shadow-md hover:scale-110 transition-transform active:scale-95"
          >
            {user.displayName?.[0] || 'A'}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6 pt-12">
        <div className="space-y-1">
          <h2 className="text-[28px] font-black text-[#111B21] dark:text-white tracking-tight">ADMIN PANEL</h2>
          <p className="text-[11px] font-black text-[#312ECB] dark:text-blue-400 uppercase tracking-[0.3em]">Management Hub</p>
        </div>

        <div className="space-y-4">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => router.push(item.path)}
              className={`${item.color} w-full rounded-[2.5rem] p-8 text-white flex items-center justify-between shadow-xl transition-all active:scale-[0.98] group relative overflow-hidden`}
            >
              <div className="flex items-center gap-6 z-10">
                <div className="w-16 h-16 rounded-[1.2rem] bg-white/20 flex items-center justify-center border border-white/10">
                  {item.icon}
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-black tracking-tight">{item.title}</h3>
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1">
                    {item.subtitle}
                  </p>
                </div>
              </div>
              <div className="z-10 bg-white/10 p-2 rounded-full group-hover:translate-x-1 transition-transform">
                <ChevronRight size={24} />
              </div>
              {/* Subtle pattern overlay */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl" />
            </button>
          ))}
        </div>

        <div className="pt-8">
          <Button 
            variant="ghost" 
            onClick={() => auth?.signOut()}
            className="w-full h-14 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-black text-[11px] uppercase tracking-[0.3em] gap-3"
          >
            <LogOut size={18} /> Sign Out Session
          </Button>
        </div>
      </main>
    </div>
  );
}
