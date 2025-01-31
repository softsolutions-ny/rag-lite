import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { ThreadLoadingProvider } from "@/lib/store/thread-loading-context";

// Dynamically import AppSidebar with no SSR
const DynamicAppSidebar = dynamic(
  () => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
  { ssr: false }
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      <SidebarProvider>
        <ThreadLoadingProvider>
          <Suspense
            fallback={
              <div className="w-64 bg-background animate-pulse">
                <div className="h-screen" />
              </div>
            }
          >
            <DynamicAppSidebar />
          </Suspense>
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
        </ThreadLoadingProvider>
      </SidebarProvider>
    </div>
  );
}
