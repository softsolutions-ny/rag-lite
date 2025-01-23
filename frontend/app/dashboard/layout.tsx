import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="relative z-10 h-full">
            <AppHeader />
            <main className="flex-1">{children}</main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
