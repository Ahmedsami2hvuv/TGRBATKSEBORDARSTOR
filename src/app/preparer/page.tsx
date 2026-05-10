import Link from "next/link";
import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerCourierAssignWhere } from "@/lib/courier-assignable";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { loadPreparerPortalOrderTableData } from "@/lib/preparer-portal-order-table-data";
import { prisma } from "@/lib/prisma";
import { PreparerOrdersSection } from "./preparer-orders-client";
import { PreparerPresenceToggle } from "./preparer-presence-toggle";
import { PreparerWalletLink } from "./preparer-wallet-link";
import { PreparerSearchTrigger } from "./preparer-search-trigger";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getGlobalIcons } from "@/lib/icon-settings";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";
import { PreparerNotificationPoller } from "./preparer-notification-poller";
import { getPreparerMoneyTotals } from "@/lib/preparer-combined-wallet-totals";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

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

  // حفظ p/exp/s يتم في middleware (src/proxy.ts) — لا نستخدم cookies().set هنا لأن Server Components لا تدعم تعديل الكوكيز أثناء العرض.

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

  const [{ rows: tableRows, searchFields }, couriersForBulkAssign, walletTotals, icons] =
    await Promise.all([
      loadPreparerPortalOrderTableData({
        preparerId: preparer.id,
        shopIds,
        orderListResetAt,
        tab: "all",
        wardFilter: "lower",
        saderFilter: "higher",
        prepFilter: null,
        onlySubmittedByThisPreparer: false,
      }),
      prisma.courier.findMany({
        where: preparerCourierAssignWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      getPreparerMoneyTotals(preparer.id),
      iconsPromise,
    ]);

  const walletRemainStr = formatDinarAsAlfWithUnit(walletTotals?.remain ?? 0);

  // دالة التطهير العميق للتعامل مع BigInt و Decimal و Date
  const makeSafe = (obj: any) => {
    if (!obj) return obj;
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (typeof value === 'bigint') return value.toString();
      return value;
    }));
  };

  const safeTableRows = makeSafe(tableRows);
  const safeSearchFields = makeSafe(searchFields);
  const safeCouriers = makeSafe(couriersForBulkAssign);

  return (
    <div className="kse-app-inner mx-auto max-w-6xl px-2 py-2 pb-24 text-base leading-relaxed sm:px-4 sm:py-4 sm:text-lg">
      <header className="kse-glass-dark mb-2 flex flex-wrap items-center gap-2 border border-emerald-200/90 px-3 py-2.5 shadow-sm sm:mb-3 sm:px-4">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <ThemeSwitcher />
          <p className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-slate-100">{preparer.name}</p>
          <PreparerSearchTrigger icons={icons} />
        </div>
        <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          <PreparerPresenceToggle auth={baseAuth} availableForAssignment={preparer.availableForAssignment} icons={icons} />
          {canSubmitAny && (
            <>
              <FullscreenWalletLauncher
                href={preparerPath("/preparer/preparation", baseAuth)}
                className="inline-flex items-center justify-center rounded-xl border-2 border-violet-500 bg-violet-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-violet-700 sm:px-4 sm:text-base"
                title="تجهيز الطلبات"
              >
                تجهيز الطلبات
              </FullscreenWalletLauncher>
              {canPriceStore && (
                <Link href={preparerPath("/preparer/store-pricing", baseAuth)} className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-500 bg-emerald-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-emerald-700 sm:px-4 sm:text-base">تسعير المتجر</Link>
              )}
              <FullscreenWalletLauncher
                href={preparerPath("/preparer/order/new", baseAuth)}
                className="inline-flex items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-sky-700 sm:px-4 sm:text-base"
                title="طلب جديد"
              >
                طلب جديد
              </FullscreenWalletLauncher>
            </>
          )}
          <PreparerWalletLink auth={baseAuth} icons={icons} walletRemainStr={walletRemainStr} />
        </div>
      </header>
      <PreparerNotificationPoller auth={baseAuth} openUrl={preparationHref} />
      <section className="kse-glass-dark overflow-hidden border border-sky-200 shadow-sm dark:border-slate-800">
        <div className="p-3 border-b border-sky-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-sky-900 dark:text-sky-400">قائمة الطلبات</h3>
        </div>
        <PreparerOrdersSection
          allRows={safeTableRows}
          searchFields={safeSearchFields}
          auth={baseAuth}
          tab="all"
          initialQuery={(sp.q ?? "").trim()}
          couriersForBulkAssign={safeCouriers}
          icons={icons}
        />
      </section>
    </div>
  );
}
