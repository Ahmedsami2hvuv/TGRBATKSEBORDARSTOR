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
import { PreparerQuickSelectTrigger } from "./preparer-quick-select-trigger";
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
    <div className="mx-auto max-w-6xl px-2 py-2.5 pb-24 text-base leading-relaxed sm:px-4 sm:py-4 sm:text-lg" dir="rtl">
      <PortalAuthCookieSetter auth={baseAuth} />
      
      {/* 1. الترويسة العلوية لواجهة المجهز بنمط وصلي */}
      <header className="rounded-[22px] border border-[#D0DDFB] bg-white px-3 sm:px-4 py-3 shadow-sm mb-3.5 select-none">
        {/* السطر الأول: زر الإعدادات + اسم المجهز + زر التحديد السريع + البحث وتسعير المتجر */}
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* اليمين: زر الإعدادات + اسم المجهز + زر تحديد سريع */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
            <Link prefetch={false}
              href={preparerPath("/preparer/settings", baseAuth)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF3FF] border border-[#D0DDFB] text-[#0B2E8C] shadow-xs transition hover:bg-[#DCE7FC] hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
              title="إعدادات المظهر"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>

            {/* كبسولة اسم المجهز بنمط وصلي الكحلي والأصفر */}
            <div className="bg-[#0B2E8C] border border-[#0B2E8C] rounded-xl px-3 py-2 text-white font-black text-sm flex items-center gap-2 shadow-xs shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFC107" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="truncate max-w-[120px] sm:max-w-none">{safePreparer.name || "المجهز"}</span>
            </div>

            {/* زر التحديد السريع بجانب اسم المجهز مباشرة */}
            <PreparerQuickSelectTrigger icons={safeIcons} />
          </div>

          {/* اليسار: البحث وتسعير المتجر */}
          <div className="flex items-center gap-2 mr-auto shrink-0">
            <PreparerSearchTrigger icons={safeIcons} />
            {canSubmitAny && canPriceStore && (
              <Link prefetch={false}
                href={preparerPath("/preparer/store-pricing", baseAuth)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D0DDFB] bg-[#EEF3FF] text-[#0B2E8C] shadow-xs transition hover:bg-[#DCE7FC] hover:scale-105 active:scale-95 cursor-pointer"
                title="تسعير المتجر"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
                  <path d="M2 7h20" />
                  <path d="M22 7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* السطر الثاني: أزرار العمليات السريعة بتصميم وصلي متناسق بدون إيموجيات */}
        <div className="flex items-center justify-between gap-1.5 w-full mt-2.5 pt-2.5 border-t border-[#D0DDFB]">
          {/* 1. زر استلام الراتب */}
          <Link prefetch={false}
            href={preparerPath("/preparer/salary", baseAuth)}
            className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center gap-1.5 rounded-xl border border-[#D0DDFB] bg-white text-[#0B2E8C] shadow-xs transition hover:bg-[#EEF3FF] hover:scale-105 active:scale-95 cursor-pointer px-1"
            title="استلام الراتب"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B2E8C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <rect width="20" height="12" x="2" y="6" rx="2" />
              <circle cx="12" cy="12" r="2" />
              <path d="M6 12h.01M18 12h.01" />
            </svg>
            <span className="text-[10px] sm:text-[11px] font-black bg-[#EEF3FF] px-1.5 py-0.5 rounded-md text-[#0B2E8C] leading-none font-mono truncate">
              {withdrawableSalaryStr}
            </span>
          </Link>

          {/* 2. زر الديون */}
          <FullscreenWalletLauncher
            href={preparerPath("/preparer/debts", baseAuth)}
            className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] text-[#E11D48] shadow-xs hover:bg-rose-100 transition hover:scale-105 active:scale-95 cursor-pointer"
            title="الديون"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </FullscreenWalletLauncher>

          {/* 3. زر تجهيز الطلبات */}
          {canSubmitAny && (
            <FullscreenWalletLauncher
              href={preparerPath("/preparer/preparation", baseAuth)}
              className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED] shadow-xs hover:bg-violet-100 transition hover:scale-105 active:scale-95 cursor-pointer"
              title="تجهيز الطلبات"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m7.5 4.27 9 5.15" />
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
            </FullscreenWalletLauncher>
          )}

          {/* 4. زر طلب جديد */}
          {canSubmitAny && (
            <FullscreenWalletLauncher
              href={preparerPath("/preparer/order/new", baseAuth)}
              className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] text-[#059669] shadow-xs hover:bg-emerald-100 transition hover:scale-105 active:scale-95 cursor-pointer"
              title="طلب جديد"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </FullscreenWalletLauncher>
          )}

          {/* 5. زر محفظتي */}
          <FullscreenWalletLauncher
            href={preparerPath("/preparer/wallet", baseAuth)}
            className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center gap-1.5 rounded-xl border border-[#D0DDFB] bg-white text-[#0B2E8C] shadow-xs hover:bg-[#EEF3FF] hover:scale-105 active:scale-95 transition cursor-pointer px-1"
            title="محفظتي"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFC107" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
            <span className="text-[10px] sm:text-[11px] font-black bg-[#EEF3FF] px-1.5 py-0.5 rounded-md text-[#0B2E8C] leading-none font-mono truncate">
              {walletRemainStr}
            </span>
          </FullscreenWalletLauncher>
        </div>
      </header>

      {/* 2. قسم جدول الطلبات بنمط وصلي */}
      <section className="rounded-[22px] border border-[#D0DDFB] bg-white shadow-sm overflow-hidden p-2 sm:p-3">
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
