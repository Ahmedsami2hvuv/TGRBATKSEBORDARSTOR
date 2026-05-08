import { prisma } from "@/lib/prisma";

const RETENTION_HOURS = 48; // يومين
const MIN_RUN_GAP_MS = 10 * 60 * 1000; // لا نكرر التنظيف أكثر من كل 10 دقائق داخل نفس العملية

let lastCleanupRunAt = 0;

/**
 * حذف رسائل الدردشة الأقدم من مدة الاحتفاظ من قاعدة البيانات نفسها.
 * يعمل بشكل خفيف عند استدعاء API الدردشة.
 */
export async function runPortalChatRetentionCleanup(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupRunAt < MIN_RUN_GAP_MS) return;
  lastCleanupRunAt = now;

  const cutoff = new Date(now - RETENTION_HOURS * 60 * 60 * 1000);

  const affectedThreads = await prisma.portalChatMessage.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { threadId: true },
    distinct: ["threadId"],
    take: 500,
  });

  await prisma.portalChatMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  const threadIds = affectedThreads.map((t) => t.threadId);
  if (threadIds.length === 0) return;

  for (const threadId of threadIds) {
    const latest = await prisma.portalChatMessage.findFirst({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    await prisma.portalChatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: latest?.createdAt ?? null },
    });
  }
}
