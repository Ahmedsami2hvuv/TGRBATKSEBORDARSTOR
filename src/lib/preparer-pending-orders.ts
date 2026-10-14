import { prisma } from "@/lib/prisma";

/**
 * حساب عدد الطلبات والمسودات المعلقة التي تنتظر التجهيز من قبل المجهز في صفحة تجهيز الطلبات
 */
export async function getPendingPreparationOrdersCount(
  preparerId: string,
  submittableShopIds: string[]
): Promise<number> {
  try {
    const [webStoreCount, drafts] = await Promise.all([
      submittableShopIds.length > 0
        ? prisma.order.count({
            where: {
              shopId: { in: submittableShopIds },
              status: "pending",
              submissionSource: "web_store",
              orderType: { not: "دين" },
              submittedByCompanyPreparerId: null,
            },
          })
        : 0,
      prisma.companyPreparerShoppingDraft.findMany({
        where: { preparerId, status: { in: ["draft", "priced"] } },
        select: { sentOrderId: true },
      }),
    ]);

    const sentDraftIds = Array.from(
      new Set(drafts.map((d) => d.sentOrderId).filter(Boolean))
    ) as string[];

    let invalidSentIds = new Set<string>();
    if (sentDraftIds.length > 0) {
      const completedOrders = await prisma.order.findMany({
        where: {
          id: { in: sentDraftIds },
          OR: [
            { status: { not: "pending" } },
            { archivedAt: { not: null } },
          ],
        },
        select: { id: true },
      });
      invalidSentIds = new Set(completedOrders.map((o) => o.id));
    }

    const validDraftsCount = drafts.filter(
      (d) => !d.sentOrderId || !invalidSentIds.has(d.sentOrderId)
    ).length;

    return webStoreCount + validDraftsCount;
  } catch (error) {
    console.error("Failed to get pending preparation orders count:", error);
    return 0;
  }
}
