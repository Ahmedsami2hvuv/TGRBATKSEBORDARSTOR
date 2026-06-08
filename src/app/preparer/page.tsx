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
import { SalaryWithdrawalButton } from "./salary-withdrawal-button";
import { PreparerWalletLink } from "./preparer-wallet-link";
import { PreparerSearchTrigger } from "./preparer-search-trigger";
import { getGlobalIcons } from "@/lib/icon-settings";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";
import { PreparerNotificationPoller } from "./preparer-notification-poller";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { PortalAuthCookieSetter } from "@/components/portal-auth-cookie-setter";

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

  const [couriersForBulkAssign, walletTotals, icons] = await Promise.all([
    prisma.courier.findMany({
      where: preparerCourierAssignWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getPreparerMoneyTotals(preparer.id),
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

  const botToken = await getBotTokenByPurpose("preparer");
  const botInfo = botToken ? await fetch(`https://api.telegram.org/bot${botToken}/getMe`).then(r => r.json()).catch(() => null) : null;
  const botUsername = botInfo?.result?.username;

  let telegramLink = null;
  if (botUsername && preparer) {
    const preparerPortalUrl = buildCompanyPreparerPortalUrl(preparer.id, preparer.portalToken, getPublicAppUrl());
    const botStartParam = `pl_${randomBytes(8).toString("hex")}`;
    try {
      await prisma.schemaPlaceholder.create({
        data: {
          id: botStartParam,
          note: preparerPortalUrl,
        },
      });
    } catch (err) {
      console.error("[PreparerPage] Failed to create telegram placeholder", err);
    }
    telegramLink = `https://t.me/${botUsername}?start=${botStartParam}`;
  }

  // Periodic cleanup of old placeholders (5% of requests)
  if (Math.random() < 0.05) {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    prisma.schemaPlaceholder.deleteMany({
      where: { id: { startsWith: "pl_" }, createdAt: { lt: twoDaysAgo } }
    }).catch(() => {});
  }

  return (
    <div className="kse-app-inner mx-auto max-w-6xl px-2 py-2 pb-24 text-base leading-relaxed sm:px-4 sm:py-4 sm:text-lg">
      <PortalAuthCookieSetter auth={baseAuth} />
      <header className="kse-glass-dark mb-2 flex flex-wrap items-center gap-2 border border-emerald-200/90 px-3 py-2.5 shadow-sm sm:mb-3 sm:px-4">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <Link
            href={preparerPath("/preparer/settings", baseAuth)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-[#00f3ff]/30 text-lg shadow-sm transition hover:scale-105"
            title="إعدادات الخلفية والمظهر"
          >
            ⚙️
          </Link>
          {telegramLink && (
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#229ED9] text-white shadow-sm ring-1 ring-[#1b8bc2] transition hover:bg-[#1b8bc2]"
              title="فتح بوت التليجرام"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.88.03-.24.36-.48.99-.73 3.88-1.69 6.47-2.8 7.77-3.33 3.7-1.51 4.47-1.77 4.97-1.78.11 0 .36.03.52.16.14.12.18.28.19.45.01.06.01.12 0 .19z" />
              </svg>
            </a>
          )}
          <p className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-slate-100">{safePreparer.name}</p>
          <PreparerSearchTrigger icons={safeIcons} />
        </div>
        <div className="grid w-full shrink-0 grid-cols-2 gap-2">
          {/* العمود الأيمن (استلام الراتب + المحفظة والديون) */}
          <div className="flex flex-col gap-2 w-full">
            <SalaryWithdrawalButton auth={baseAuth} preparerName={safePreparer.name} />
            <div className="flex gap-2 w-full">
              <div className="flex-1 min-w-0">
                <PreparerWalletLink auth={baseAuth} icons={safeIcons} walletRemainStr={walletRemainStr} />
              </div>
              <FullscreenWalletLauncher
                href={preparerPath("/preparer/debts", baseAuth)}
                className="w-1/3 shrink-0 inline-flex items-center justify-center rounded-xl border-2 border-rose-500 bg-rose-600 px-2 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-rose-700 transition"
                title="الديون"
              >
                الديون
              </FullscreenWalletLauncher>
            </div>
          </div>

          {/* العمود الأيسر (تجهيز الطلبات + طلب جديد وتسعير المتجر) */}
          <div className="flex flex-col gap-2 w-full">
            {canSubmitAny && (
              <FullscreenWalletLauncher
                href={preparerPath("/preparer/preparation", baseAuth)}
                className="inline-flex items-center justify-center rounded-xl border-2 border-violet-500 bg-violet-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-violet-700 w-full"
                title="تجهيز الطلبات"
              >
                تجهيز الطلبات
              </FullscreenWalletLauncher>
            )}
            
            <div className="flex flex-col gap-2 w-full">
              {canSubmitAny && (
                <FullscreenWalletLauncher
                  href={preparerPath("/preparer/order/new", baseAuth)}
                  className="inline-flex items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-sky-700 w-full"
                  title="طلب جديد"
                >
                  طلب جديد
                </FullscreenWalletLauncher>
              )}
              {canSubmitAny && canPriceStore && (
                <Link
                  href={preparerPath("/preparer/store-pricing", baseAuth)}
                  className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-500 bg-emerald-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-emerald-700 w-full"
                >
                  تسعير المتجر
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      <PreparerNotificationPoller auth={baseAuth} openUrl={preparationHref} />
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
