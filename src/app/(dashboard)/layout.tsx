import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PWAInstallButton } from "@/components/layout/pwa-install";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/* Sidebar: desktop only */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      <SidebarInset>
        <Header />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </SidebarInset>
      {/* Bottom nav: mobile only */}
      <BottomNav />
      {/* PWA install prompt - hidden when already installed or in standalone mode */}
      <PWAInstallButton />
    </SidebarProvider>
  );
}
