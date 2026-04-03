import { DashboardHeader } from "@/components/dashboard-header";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[{ label: "Projects", href: "/" }, { label: "Settings" }]}
      />
      <div className="flex-1 p-4">{children}</div>
    </>
  );
}
