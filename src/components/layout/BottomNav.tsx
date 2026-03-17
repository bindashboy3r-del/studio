
"use client";

import { useRouter, usePathname } from "next/navigation";
import { Home, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', path: '/chat', icon: <Home size={22} /> },
    { label: 'Funds', path: '/add-funds', icon: <Wallet size={22} /> },
    { label: 'Profile', path: '/profile', icon: <User size={22} /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#030712]/90 backdrop-blur-2xl border-t border-white/5 px-4 pb-safe">
      <div className="max-w-md mx-auto flex justify-around items-center h-20">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 w-20 transition-all duration-300 relative",
                isActive ? "text-[#312ECB] scale-110" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all",
                isActive ? "bg-[#312ECB]/10 shadow-lg" : "bg-transparent"
              )}>
                {item.icon}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-2 w-1.5 h-1.5 bg-[#312ECB] rounded-full shadow-[0_0_10px_#312ECB]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
