import Link from "next/link";
import { buildCompanyPreparerPortalUrl } from "@/lib/company-preparer-portal-link";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { PreparersManager, type PreparerManagerRow } from "./preparers-manager";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المجهزين — أبو الأكبر للتوصيل",
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default async function PreparersPage() {
  const [preparers, shops, branches, categories, icons, debtOrders] = await Promise.all([
    prisma.companyPreparer.findMany({
      where: {
        NOT: { notes: { contains: "[SUPPLIER]" } }
      },
      orderBy: { createdAt: "desc" },
      include: {
        shopLinks: {
          include: { shop: { select: { id: true, name: true } } },
          orderBy: { assignedAt: "desc" },
        },
        authorizedBranches: {
          select: { id: true, categoryId: true }
        }
      },
    }),
    prisma.shop.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.storeBranch.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
      select: { id: true, name: true }
    }),
    prisma.storeCategory.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
      select: { id: true, name: true }
    }),
    getGlobalIcons(),
    prisma.order.findMany({
      where: {
        preparerDebtHidden: false,
        status: { notIn: ["cancelled"] },
        orderSubtotal: { gt: 0 },
      },
      select: {
        id: true,
        shopId: true,
        orderSubtotal: true,
        moneyEvents: {
          where: { kind: MONEY_KIND_PICKUP, deletedAt: null },
          select: { amountDinar: true }
        }
      }
    })
  ]);

  // Calculate debts per shop
  const shopDebtsMap: Record<string, number> = {};
  let globalTotalDebts = 0;

  debtOrders.forEach(order => {
    const totalPaid = order.moneyEvents.reduce((sum, e) => sum + Number(e.amountDinar), 0);
    const subtotal = Number(order.orderSubtotal || 0);
    const debt = subtotal - totalPaid;

    if (debt > 0) {
      shopDebtsMap[order.shopId] = (shopDebtsMap[order.shopId] || 0) + debt;
      globalTotalDebts += debt;
    }
  });

  const baseUrl = getPublicAppUrl();
  const rows: PreparerManagerRow[] = preparers.map((p) => {
    // Total debts for this preparer = sum of debts of all shops they are linked to
    const preparerTotalDebts = p.shopLinks.reduce((sum, link) => {
      return sum + (shopDebtsMap[link.shopId] || 0);
    }, 0);

    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      telegramUserId: p.telegramUserId ?? "",
      notes: p.notes,
      active: p.active,
      linkedShopIds: p.shopLinks.map((l) => l.shopId),
      canSubmitShopIds: p.shopLinks.filter((l) => l.canSubmitOrders).map((l) => l.shopId),
      authorizedBranchIds: p.authorizedBranches.map(b => b.id),
      authorizedCategoryIds: [...new Set(p.authorizedBranches.map(b => (b as any).categoryId).filter(Boolean))],
      linkedShops: p.shopLinks.map((l) => ({ id: l.shop.id, name: l.shop.name })),
      portalUrl: buildCompanyPreparerPortalUrl(p.id, p.portalToken, baseUrl),
      chatDisabled: p.chatDisabled,
      aiDisabled: p.aiDisabled,
      preparerMonthlySalaryResetMode: p.preparerMonthlySalaryResetMode,
      preparerMonthlySalaryResetAt: p.preparerMonthlySalaryResetAt ? p.preparerMonthlySalaryResetAt.toISOString() : null,
      preparerMonthlySalaryResetEveryDays: p.preparerMonthlySalaryResetEveryDays ?? null,
      totalDebtsAmount: preparerTotalDebts,
    };
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href={SECRET_ADMIN_PATH} className={ad.navButton + " flex items-center gap-2"}>
          <DynamicIcon iconKey="ui_home" config={icons} fallback="←" className="w-4 h-4" />
          الرئيسية
        </Link>
        <Link href={`${SECRET_ADMIN_PATH}/shops`} className={ad.navButton + " flex items-center gap-2"}>
          <DynamicIcon iconKey="ui_shops" config={icons} fallback="🏢" className="w-4 h-4" />
          المحلات
        </Link>
        <Link href={`${SECRET_ADMIN_PATH}/prep-notices`} className={ad.navButton + " flex items-center gap-2"}>
          <DynamicIcon iconKey="ui_notification" config={icons} fallback="🔔" className="w-4 h-4" />
          إشعارات تجهيز المجهزين
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className={ad.h1}>المجهزين</h1>
          <p className={`mt-2 max-w-3xl ${ad.lead}`}>
            أضف حسابات فريق المجهزين عندك واربط كل مجهز بالمحلات التي يتابعها. الروابط الآن <strong>دائمة</strong>.
          </p>
        </div>

        {globalTotalDebts > 0 && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
             <div className="h-10 w-10 rounded-full bg-rose-600 flex items-center justify-center text-white font-black">!</div>
             <div>
                <p className="text-xs font-bold text-rose-500">إجمالي ديون المحلات (غير المخفية)</p>
                <p className="text-xl font-black text-rose-700 tabular-nums">{formatDinarAsAlfWithUnit(globalTotalDebts)}</p>
             </div>
          </div>
        )}
      </div>

      <PreparersManager rows={rows} allShops={shops} allBranches={branches} allCategories={categories} icons={icons} />
    </div>
  );
}
