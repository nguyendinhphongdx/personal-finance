"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Separator } from "@/components/ui/separator";

export function Header() {
  return (
    <header className="flex h-14 items-center gap-2 border-b px-4 shrink-0">
      <SidebarTrigger className="cursor-pointer" />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}
