import { AdminShell } from "./admin-shell";

/** لا نُولّد الصفحات ثابتاً أثناء `next build` — Prisma/قاعدة البيانات غير متاحة في بيئة بناء Docker (مثل Railway). */
export const dynamic = "force-dynamic";

import { PortalLocationHeartbeat } from "@/components/portal-location-heartbeat";

import { getCurrentSessionIsAccountant } from "@/lib/admin-session";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAccountant = await getCurrentSessionIsAccountant();
  return <AdminShell pendingInitialCount={0} isAccountant={isAccountant}>{children}</AdminShell>;
}
