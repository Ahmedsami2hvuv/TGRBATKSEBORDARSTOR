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
      
      {/* 1. الترويسة الملكية الفاخرة لواجهة المجهز */}
      <header className="rounded-[22px] border-2 border-[#C9A86A] bg-[#FFFEFB] px-3 sm:px-4 py-3 shadow-[0_6px_22px_rgba(201,168,106,0.18)] mb-3.5 select-none">
        {/* السطر الأول: زر الإعدادات + اسم المجهز + زر التحديد السريع + البحث وتسعير المتجر */}
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* اليمين: زر الإعدادات + اسم المجهز + زر تحديد سريع */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
            <Link prefetch={false}
              href={preparerPath("/preparer/settings", baseAuth)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDF6E3] border-[1.5px] border-[#C9A86A] text-lg shadow-[0_2px_8px_rgba(201,168,106,0.15)] transition hover:bg-[#FAF0D7] hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
              title="إعدادات الخلفية والمظهر"
            >
              ⚙️
            </Link>

            {/* كبسولة اسم المجهز الملكية الزمردية */}
            <div className="bg-[#0A3D2E] border-[1.5px] border-[#C9A86A] rounded-xl px-3 py-2 text-white font-black text-sm flex items-center gap-1.5 shadow-[0_2px_8px_rgba(10,61,46,0.25)] shrink-0">
              <span className="text-[#F5D77F] text-xs">👤</span>
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
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-[#C9A86A] bg-[#0A3D2E] text-[#F5D77F] text-lg shadow-[0_2px_8px_rgba(10,61,46,0.25)] transition hover:bg-[#104D3B] hover:scale-105 active:scale-95 cursor-pointer"
                title="تسعير المتجر"
              >
                🏪
              </Link>
            )}
          </div>
        </div>

        {/* السطر الثاني: أزرار العمليات السريعة بتصميم ملكي متناسق في سطر واحد */}
        <div className="flex items-center justify-between gap-1.5 w-full mt-2.5 pt-2.5 border-t border-[#C9A86A]/25">
          {/* 1. زر استلام الراتب */}
          <Link prefetch={false}
            href={preparerPath("/preparer/salary", baseAuth)}
            className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center gap-1 rounded-xl border-[1.5px] border-[#C9A86A] bg-gradient-to-b from-[#FFFDF7] to-[#FDF6E3] text-[#8B6A2A] shadow-[0_2px_6px_rgba(201,168,106,0.12)] transition hover:scale-105 active:scale-95 cursor-pointer px-1"
            title="استلام الراتب"
          >
            <span className="text-base sm:text-lg shrink-0">💸</span>
            <span className="text-[10px] sm:text-[11px] font-black bg-[#F5E6BE] px-1 py-0.5 rounded-md text-[#6D4C1D] leading-none font-mono truncate">
              {withdrawableSalaryStr}
            </span>
          </Link>

          {/* 2. زر الديون */}
          <FullscreenWalletLauncher
            href={preparerPath("/preparer/debts", baseAuth)}
            className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center rounded-xl border-[1.5px] border-[#E11D48]/50 bg-gradient-to-b from-[#FEF2F2] to-[#FEE2E2] text-[#991B1B] shadow-[0_2px_6px_rgba(225,29,72,0.12)] hover:bg-rose-100 transition hover:scale-105 active:scale-95 cursor-pointer"
            title="الديون"
          >
            <span className="text-base sm:text-lg">💳</span>
          </FullscreenWalletLauncher>

          {/* 3. زر تجهيز الطلبات */}
          {canSubmitAny && (
            <FullscreenWalletLauncher
              href={preparerPath("/preparer/preparation", baseAuth)}
              className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center rounded-xl border-[1.5px] border-[#7C3AED]/50 bg-gradient-to-b from-[#F5F3FF] to-[#EDE9FE] text-[#5B21B6] shadow-[0_2px_6px_rgba(124,58,237,0.12)] hover:bg-violet-100 transition hover:scale-105 active:scale-95 cursor-pointer"
              title="تجهيز الطلبات"
            >
              <span className="text-base sm:text-lg">📦</span>
            </FullscreenWalletLauncher>
          )}

          {/* 4. زر طلب جديد */}
          {canSubmitAny && (
            <FullscreenWalletLauncher
              href={preparerPath("/preparer/order/new", baseAuth)}
              className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center rounded-xl border-[1.5px] border-[#059669]/50 bg-gradient-to-b from-[#ECFDF5] to-[#D1FAE5] text-[#065F46] shadow-[0_2px_6px_rgba(5,150,105,0.12)] hover:bg-emerald-100 transition hover:scale-105 active:scale-95 cursor-pointer"
              title="طلب جديد"
            >
              <span className="text-base sm:text-lg">➕</span>
            </FullscreenWalletLauncher>
          )}

          {/* 5. زر محفظتي */}
          <FullscreenWalletLauncher
            href={preparerPath("/preparer/wallet", baseAuth)}
            className="flex-1 min-w-0 h-9 sm:h-10 flex items-center justify-center gap-1 rounded-xl border-[1.5px] border-[#C9A86A] bg-gradient-to-b from-[#FFFDF7] to-[#FDF6E3] text-[#8B6A2A] shadow-[0_2px_6px_rgba(201,168,106,0.12)] hover:scale-105 active:scale-95 transition cursor-pointer px-1"
            title="محفظتي"
          >
            <span className="text-base sm:text-lg shrink-0">💰</span>
            <span className="text-[10px] sm:text-[11px] font-black bg-[#F5E6BE] px-1 py-0.5 rounded-md text-[#6D4C1D] leading-none font-mono truncate">
              {walletRemainStr}
            </span>
          </FullscreenWalletLauncher>
        </div>
      </header>

      {/* 2. قسم جدول الطلبات الملكي */}
      <section className="rounded-[22px] border-2 border-[#C9A86A] bg-[#FFFEFB] shadow-[0_6px_22px_rgba(201,168,106,0.12)] overflow-hidden p-2 sm:p-3">
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
