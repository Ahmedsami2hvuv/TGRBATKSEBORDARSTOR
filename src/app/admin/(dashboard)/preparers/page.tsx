import Link from "next/link";
import { buildCompanyPreparerPortalUrl } from "@/lib/company-preparer-portal-link";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { PreparersManager, type PreparerManagerRow } from "./preparers-manager";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المجهزين — أبو الأكبر للتوصيل",
};

export default async function PreparersPage() {
  const [preparers, shops, branches, categories, icons] = await Promise.all([
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
    getGlobalIcons()
  ]);

  const baseUrl = getPublicAppUrl();
  const rows: PreparerManagerRow[] = preparers.map((p) => ({
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
    // تحديث بناء الرابط ليكون رمز المجهزportalToken
    portalUrl: buildCompanyPreparerPortalUrl(p.id, p.portalToken, baseUrl),
    chatDisabled: p.chatDisabled,
    aiDisabled: p.aiDisabled,
    preparerMonthlySalaryResetMode: p.preparerMonthlySalaryResetMode,
    preparerMonthlySalaryResetAt: p.preparerMonthlySalaryResetAt ? p.preparerMonthlySalaryResetAt.toISOString() : null,
    preparerMonthlySalaryResetEveryDays: p.preparerMonthlySalaryResetEveryDays ?? null,
  }));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/admin" className={ad.navButton + " flex items-center gap-2"}>
          <DynamicIcon iconKey="ui_home" config={icons} fallback="←" className="w-4 h-4" />
          الرئيسية
        </Link>
        <Link href="/admin/shops" className={ad.navButton + " flex items-center gap-2"}>
          <DynamicIcon iconKey="ui_shops" config={icons} fallback="🏢" className="w-4 h-4" />
          المحلات
        </Link>
        <Link href="/admin/prep-notices" className={ad.navButton + " flex items-center gap-2"}>
          <DynamicIcon iconKey="ui_notification" config={icons} fallback="🔔" className="w-4 h-4" />
          إشعارات تجهيز المجهزين
        </Link>
      </div>

      <div>
        <h1 className={ad.h1}>المجهزين</h1>
        <p className={`mt-2 max-w-3xl ${ad.lead}`}>
          أضف حسابات فريق المجهزين عندك واربط كل مجهز بالمحلات التي يتابعها. الروابط الآن <strong>دائمة</strong>.
        </p>
      </div>

      <PreparersManager rows={rows} allShops={shops} allBranches={branches} allCategories={categories} icons={icons} />
    </div>
  );
}
