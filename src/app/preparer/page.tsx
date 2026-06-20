import Link from "next/link";
import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery, buildCompanyPreparerPortalUrl } from "@/lib/company-preparer-portal-link";
import { preparerCourierAssignWhere } from "@/lib/courier-assignable";
import { getPublicAppUrl } from "@/lib/app-url";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { randomBytes } from "crypto";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { loadPreparerPortalOrderTableData } from "@/lib/preparer-portal-order-table-data";
import { prisma } from "@/lib/prisma";
import { PreparerOrdersSection } from "./preparer-orders-client";
import { PreparerSearchTrigger } from "./preparer-search-trigger";
import { getGlobalIcons } from "@/lib/icon-settings";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";

import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { PortalAuthCookieSetter } from "@/components/portal-auth-cookie-setter";
import { calculateAccumulatedSalaryInternal } from "./actions";
import { getIraqTime } from "@/lib/baghdad-time";

// Keep data fresh while allowing fast back/forward navigation cache.
export const revalidate = 10;

function invalidMsg(reason: string) {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط أو تم تسجيل الدخول من جهاز آخر. اطلب رابطاً جديداً.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. يرجى فتح الرابط الأصلي المرسل إليك.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
    default:
      return "تعذّر التحقق.";
  }
}

type Props = {
  searchParams: Promise<{
    p?: string;
    exp?: string;
    s?: string;
    tab?: string;
    q?: string;
  }>;
};

export default async function PreparerHomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const iconsPromise = getGlobalIcons();

  // 1. محاولة جلب البيانات من الرابط (الأولوية للرابط)
  let p = sp.p;
  let s = sp.s;
  let exp = sp.exp;

  // 2. إذا لم تكن في الرابط، نجلبها من الكوكيز
  if (!p || !s || !exp) {
    p = p || cookieStore.get("preparer_p")?.value;
    s = s || cookieStore.get("preparer_s")?.value;
    exp = exp || cookieStore.get("preparer_exp")?.value;
  }

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
          <p className="text-lg font-bold text-rose-700">لا يمكن فتح حساب المجهز</p>
          <p className="mt-2 text-sm text-slate-600">{invalidMsg(v.reason)}</p>
          <p className="mt-4 text-xs text-slate-400 font-bold">تأكد من فتح الرابط الأصلي وليس نسخة مختصرة.</p>
        </div>
      </div>
    );
  }

  // حفظ p/exp/s يتم في المكون العميل PortalAuthCookieSetter لأن Server Components لا تستطيع تعديل الكوكيز أثناء العرض.

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: {
      shopLinks: { include: { shop: true } },
      authorizedBranches: { select: { id: true } }
    }
  });

  if (!preparer || preparer.portalToken !== v.token) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-800">الحساب غير متاح أو الرمز غير صحيح</p>
        </div>
      </div>
    );
  }

  const baseAuth = { p: p!, exp: exp || "", s: s! };
  const walletHref = preparerPath("/preparer/wallet", baseAuth);
  const preparationHref = preparerPath("/preparer/preparation", baseAuth);
  const shopIds = preparer.shopLinks.map((l) => l.shopId);
  const canSubmitAny = preparer.shopLinks.some((l) => l.canSubmitOrders);
  const canPriceStore = preparer.authorizedBranches.length > 0;
  const orderListResetAt = preparer.orderListResetAt;

  const [couriersForBulkAssign, walletTotals, stats, icons] = await Promise.all([
    prisma.courier.findMany({
      where: preparerCourierAssignWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getPreparerMoneyTotals(preparer.id),
    calculateAccumulatedSalaryInternal(preparer.id),
    iconsPromise,
  ]);

  let tableRows: any[] = [];
  let searchFields: any[] = [];
  try {
    const orderTable = await loadPreparerPortalOrderTableData({
      preparerId: preparer.id,
      shopIds,
      orderListResetAt,
      tab: "all",
      wardFilter: "lower",
      saderFilter: "higher",
      prepFilter: null,
      onlySubmittedByThisPreparer: false,
    });
    tableRows = orderTable.rows;
    searchFields = orderTable.searchFields;
  } catch (error) {
    console.error("Failed to load preparer portal order table data:", error);
  }

  const walletRemainStr = formatDinarAsAlfWithUnit(walletTotals?.remain ?? 0);

  // حساب الراتب المتاح للسحب لكي يظهر من الخارج
  const iraqNow = getIraqTime(new Date());
  const nowMinutes = iraqNow.hours * 60 + iraqNow.minutes;
  const withdrawalStr = (preparer as any).salaryWithdrawalTime || "20:00";
  const [wH, wM] = withdrawalStr.split(":").map(Number);
  const withdrawalMinutes = wH * 60 + wM;

  const isBeforeWithdrawalTime = (preparer as any).bypassWithdrawalTime ? false : nowMinutes < withdrawalMinutes;
  const withdrawableSalary = isBeforeWithdrawalTime ? Math.max(0, stats.accumulatedSalary - stats.todaySalary) : stats.accumulatedSalary;
  
  const { Decimal } = await import("@prisma/client/runtime/library");
  const withdrawableSalaryStr = formatDinarAsAlfWithUnit(new Decimal(withdrawableSalary));

  // دالة التطهير العميق للتعامل مع BigInt و Decimal و Date في Next.js 15
  function deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "function") return null;
    if (typeof obj === "bigint") return obj.toString();
    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    if (typeof obj === "object") {
      if (obj.constructor && (obj.constructor.name === "Decimal" || obj.constructor.name === "n")) return Number(obj.toString());
      if (Object.hasOwn(obj, 'd') && Object.hasOwn(obj, 's') && Object.hasOwn(obj, 'e')) return Number(obj.toString());
      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = deepSanitize(obj[key]);
      }
      return newObj;
    }
    return null;
  }

  function safeDeepSanitize(obj: any): any {
    try {
      return deepSanitize(obj);
    } catch (error) {
      console.error("safeDeepSanitize failed:", error);
      return null;
    }
  }

  const safeTableRows = safeDeepSanitize(tableRows) ?? [];
  const safeSearchFields = safeDeepSanitize(searchFields) ?? [];
  const safeCouriers = safeDeepSanitize(couriersForBulkAssign) ?? [];
  const safeIcons = safeDeepSanitize(icons);
  const safePreparer = safeDeepSanitize(preparer) ?? { shopLinks: [], authorizedBranches: [], availableForAssignment: false, name: "" };

  return (
    <div className="kse-app-inner mx-auto max-w-6xl px-2 py-2 pb-24 text-base leading-relaxed sm:px-4 sm:py-4 sm:text-lg">
      <PortalAuthCookieSetter auth={baseAuth} />
      <header className="kse-glass-dark mb-2 flex flex-wrap items-center gap-2 border border-emerald-200/90 px-3 py-2.5 shadow-sm sm:mb-3 sm:px-4">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <Link prefetch={false}
            href={preparerPath("/preparer/settings", baseAuth)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-[#00f3ff]/30 text-lg shadow-sm transition hover:scale-105"
            title="إعدادات الخلفية والمظهر"
          >
            ⚙️
          </Link>
          <p className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-slate-100">{safePreparer.name}</p>
          <div className="mr-auto flex items-center gap-2">
            <PreparerSearchTrigger icons={safeIcons} />
            {canSubmitAny && canPriceStore && (
              <Link prefetch={false}
                href={preparerPath("/preparer/store-pricing", baseAuth)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-250 dark:hover:bg-emerald-900/50"
                title="تسعير المتجر"
              >
                🏪
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 w-full mt-2">
          {/* زر استلام الراتب */}
          <Link prefetch={false}
            href={preparerPath("/preparer/salary", baseAuth)}
            className="flex-1 min-w-[4.5rem] h-11 flex items-center justify-center gap-1 rounded-xl border-2 border-sky-200 bg-sky-50 text-sky-650 shadow-sm transition hover:bg-sky-100 hover:scale-105 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-800"
            title="استلام الراتب"
          >
            <span className="text-xl">💸</span>
            <span className="text-[10px] font-black bg-sky-100 px-1.5 py-0.5 rounded-lg text-sky-900 leading-none">
              {withdrawableSalaryStr}
            </span>
          </Link>

          {/* زر الديون */}
          <FullscreenWalletLauncher
            href={preparerPath("/preparer/debts", baseAuth)}
            className="flex-1 min-w-[3.5rem] h-11 flex items-center justify-center rounded-xl border-2 border-rose-500 bg-rose-600 text-white shadow-sm hover:bg-rose-700 transition hover:scale-105"
            title="الديون"
          >
            <span className="text-xl">💳</span>
          </FullscreenWalletLauncher>

          {/* زر تجهيز الطلبات */}
          {canSubmitAny && (
            <FullscreenWalletLauncher
              href={preparerPath("/preparer/preparation", baseAuth)}
              className="flex-1 min-w-[3.5rem] h-11 flex items-center justify-center rounded-xl border-2 border-violet-500 bg-violet-600 text-white shadow-sm hover:bg-violet-700 transition hover:scale-105"
              title="تجهيز الطلبات"
            >
              <span className="text-xl">📦</span>
            </FullscreenWalletLauncher>
          )}

          {/* زر طلب جديد */}
          {canSubmitAny && (
            <FullscreenWalletLauncher
              href={preparerPath("/preparer/order/new", baseAuth)}
              className="flex-1 min-w-[3.5rem] h-11 flex items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-600 text-white shadow-sm hover:bg-sky-700 transition hover:scale-105"
              title="طلب جديد"
            >
              <span className="text-xl">➕</span>
            </FullscreenWalletLauncher>
          )}

          {/* زر محفظتي */}
          <FullscreenWalletLauncher
            href={preparerPath("/preparer/wallet", baseAuth)}
            className="flex-1 min-w-[4.5rem] h-11 flex items-center justify-center gap-1 rounded-xl border-2 border-violet-400 bg-violet-50 text-violet-955 shadow-sm hover:bg-violet-100 transition hover:scale-105"
            title="محفظتي"
          >
            <span className="text-xl">💰</span>
            <span className="text-[10px] font-black bg-violet-100 px-1.5 py-0.5 rounded-lg text-violet-900 leading-none">
              {walletRemainStr}
            </span>
          </FullscreenWalletLauncher>
        </div>
      </header>
      <section className="kse-glass-dark overflow-hidden border border-sky-200 shadow-sm dark:border-slate-800">
        <PreparerOrdersSection
          allRows={safeTableRows}
          searchFields={safeSearchFields}
          auth={baseAuth}
          tab="all"
          initialQuery={(sp.q ?? "").trim()}
          couriersForBulkAssign={safeCouriers}
          icons={safeIcons}
        />
      </section>
    </div>
  );
}
