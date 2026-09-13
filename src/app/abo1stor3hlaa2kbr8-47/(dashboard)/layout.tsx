import { AdminShell } from "./admin-shell";

/** لا نُولّد الصفحات ثابتاً أثناء `next build` — Prisma/قاعدة البيانات غير متاحة في بيئة بناء Docker (مثل Railway). */
export const dynamic = "force-dynamic";

import { getCurrentSessionIsAccountant } from "@/lib/admin-session";
import { getSidebarConfig } from "@/lib/sidebar-settings-server";
import { PullToRefresh } from "@/components/pull-to-refresh";
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAccountant = await getCurrentSessionIsAccountant();
  const sidebarConfig = await getSidebarConfig();
  return (
    <>
      <PullToRefresh />
      <AdminShell pendingInitialCount={0} isAccountant={isAccountant} initialSidebarConfig={sidebarConfig}>
        {children}
      </AdminShell>
    </>
  );
}
