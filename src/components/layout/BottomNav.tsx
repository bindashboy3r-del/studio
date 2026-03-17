
"use client";

import { useRouter, usePathname } from "next/navigation";
import { Home, ShoppingCart, History, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', path: '/chat', icon: <Home size={22} /> },
    { label: 'Order', path: '/new-order', icon: <ShoppingCart size={22} /> },
    { label: 'History', path: '/orders', icon: <History size={22} /> },
    { label: 'Funds', path: '/add-funds', icon: <Wallet size={22} /> },
    { label: 'Profile', path: '/profile', icon: <User size={22} /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#030712]/90 backdrop-blur-2xl border-t border-white/5 px-4 pb-safe">
      <div className="max-w-md mx-auto flex justify-between items-center h-20">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 w-16 transition-all duration-300",
                isActive ? "text-[#312ECB] scale-110" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all",
                isActive ? "bg-[#312ECB]/10 shadow-lg" : "bg-transparent"
              )}>
                {item.icon}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-1 h-1 bg-[#312ECB] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
