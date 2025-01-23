import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="relative flex h-full flex-col">
            <div className="sticky top-0 z-10">
              <AppHeader />
            </div>
            <div className="absolute inset-x-0 bottom-0 top-16 overflow-auto">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
