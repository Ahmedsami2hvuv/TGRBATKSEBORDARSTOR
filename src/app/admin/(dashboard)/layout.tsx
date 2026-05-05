import { prisma } from "@/lib/prisma";
import { AdminShell } from "./admin-shell";

/** لا نُولّد الصفحات ثابتاً أثناء `next build` — Prisma/قاعدة البيانات غير متاحة في بيئة بناء Docker (مثل Railway). */
export const dynamic = "force-dynamic";

import { PortalLocationHeartbeat } from "@/components/portal-location-heartbeat";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let pendingInitialCount = 0;
  try {
    pendingInitialCount = await prisma.order.count({ where: { status: "pending" } });
  } catch (error) {
    console.warn("[AdminDashboardLayout] Failed to read pending orders count:", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return (
    <AdminShell pendingInitialCount={pendingInitialCount}>{children}</AdminShell>
  );
}
