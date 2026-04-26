import { prisma } from "@/lib/prisma";

/** المندوب غير موجود أو محظور — لا يُسمح بلوحة /mandoub حتى مع توقيع صحيح. */
export async function isCourierPortalBlocked(courierId: string): Promise<boolean> {
  const c = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { blocked: true },
  });
  return !c || c.blocked;
}
