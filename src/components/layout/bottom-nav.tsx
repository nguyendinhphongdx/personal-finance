"use client";

import { LayoutDashboard, ArrowLeftRight, Building2, Settings, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui.store";

const leftItems = [
  { title: "Tổng quan", href: "/", icon: LayoutDashboard },
  { title: "Thu chi", href: "/transactions", icon: ArrowLeftRight },
];

const rightItems = [
  { title: "Cho thuê", href: "/rental", icon: Building2 },
  { title: "Cài đặt", href: "/settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const setTransactionDialogOpen = useUIStore((s) => s.setTransactionDialogOpen);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      <div className="relative h-20">
        {/* SVG background with concave notch */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 400 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 L140,0 Q158,0 166,18 Q178,46 200,46 Q222,46 234,18 Q242,0 260,0 L400,0 L400,80 L0,80 Z"
            className="fill-background"
          />
          <path
            d="M0,0 L140,0 Q158,0 166,18 Q178,46 200,46 Q222,46 234,18 Q242,0 260,0"
            className="stroke-border fill-none"
            strokeWidth="0.6"
          />
        </svg>

        {/* FAB button - sitting inside the notch */}
        <button
          onClick={() => {
            if (pathname === "/transactions") {
              setTransactionDialogOpen(true);
            } else {
              setTransactionDialogOpen(true);
              router.push("/transactions");
            }
          }}
          className="absolute left-1/2 -translate-x-1/2 -top-2 z-10 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center cursor-pointer hover:brightness-110 transition-all active:scale-95"
        >
          <Plus className="h-7 w-7 stroke-[2.5]" />
        </button>

        {/* Nav items */}
        <nav className="absolute inset-0 flex items-center justify-around px-4 pt-2">
          {leftItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer transition-colors",
                isActive(item.href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive(item.href) && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          ))}

          <div className="w-20" />

          {rightItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer transition-colors",
                isActive(item.href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive(item.href) && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="h-[env(safe-area-inset-bottom)] bg-background" />
    </div>
  );
}
