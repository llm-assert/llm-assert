import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/queries/get-auth-user";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BillingAlertBanner } from "@/components/billing/billing-alert-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const dashboardUser = {
    email: user.email ?? "",
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar user={dashboardUser} />
        <SidebarInset id="main-content">
          <Suspense fallback={null}>
            <BillingAlertBanner />
          </Suspense>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
