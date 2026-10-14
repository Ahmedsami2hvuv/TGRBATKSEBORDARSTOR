import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const steps: Record<string, any> = {};

  // 1. فك الاتصالات المعلقة التي تجعل السيرفر Unhealthy
  try {
    const terminated = await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid()
        AND state IN ('idle in transaction', 'idle in transaction (aborted)')
        AND state_change < current_timestamp - INTERVAL '1 minute';
    `);
    steps.terminatedStuckConnections = terminated;
  } catch (e: any) {
    steps.terminateError = e?.message;
  }

  // 2. إرسال إشعار تحديث المخطط لتنشيط PostgREST وحل خطأ PGRST002
  try {
    await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema';`);
    steps.notifyPgrst = "SUCCESS";
  } catch (e: any) {
    steps.notifyError = e?.message;
  }

  // 3. فحص استعلام سريع للتأكد من صحة الاتصال
  try {
    const test = await prisma.$queryRawUnsafe(`SELECT 1 as alive;`);
    steps.dbAlive = test;
  } catch (e: any) {
    steps.dbAliveError = e?.message;
  }

  return NextResponse.json({
    success: true,
    steps,
    timestamp: new Date().toISOString()
  });
}
