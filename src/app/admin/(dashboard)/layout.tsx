import { prisma } from "@/lib/prisma";
import { AdminShell } from "./admin-shell";

/** لا نُولّد الصفحات ثابتاً أثناء `next build` — Prisma/قاعدة البيانات غير متاحة في بيئة بناء Docker (مثل Railway). */
export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pendingInitialCount = await prisma.order.count({ where: { status: "pending" } });
  return <AdminShell pendingInitialCount={pendingInitialCount}>{children}</AdminShell>;
}
