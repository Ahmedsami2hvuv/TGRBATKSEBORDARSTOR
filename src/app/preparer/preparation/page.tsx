import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerCourierAssignWhere } from "@/lib/courier-assignable";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { loadPreparerPortalOrderTableData } from "@/lib/preparer-portal-order-table-data";
import { prisma } from "@/lib/prisma";
import { PreparerOrdersSection } from "../preparer-orders-client";
import { PreparerSiteOrderDraftClient } from "./preparer-site-order-draft-client";
import { whatsappMeUrl } from "@/lib/whatsapp";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";
import { ModalAwareNavButton } from "@/components/modal-aware-nav-button";
import { archivePreparerShoppingDraftAction, rejectOrderFromPreparerAction } from "../actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; exp?: string; s?: string; pref?: string; q?: string }>;
};

export default async function PreparerPreparationPage({ searchParams }: Props) {
  console.log("Starting PreparerPreparationPage");
  const sp = await searchParams;
  console.log("searchParams:", sp);
  const cookieStore = await cookies();

  // جلب بيانات التوثيق من الرابط أو الكوكيز
  const p = sp.p || (await cookieStore).get("preparer_p")?.value;
  const exp = sp.exp || (await cookieStore).get("preparer_exp")?.value;
  const s = sp.s || (await cookieStore).get("preparer_s")?.value;

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) return <div className="p-8 text-center font-bold">الرابط غير صالح.</div>;

  const [preparerRaw, icons] = await Promise.all([
    prisma.companyPreparer.findFirst({
      where: { id: v.preparerId, active: true },
      include: { shopLinks: { where: { canSubmitOrders: true }, include: { shop: { include: { region: true } } } } },
    }),
    import("@/lib/icon-settings").then(m => m.getGlobalIcons())
  ]);

  if (!preparerRaw) return <div className="p-8 text-center font-bold">الحساب غير متاح.</div>;

  // Nuclear Sanitization for Next.js 15
  function deepSanitize(obj: any, visited = new WeakSet()): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "function") return null;
    if (typeof obj === "bigint") return obj.toString();
    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map((item) => deepSanitize(item, visited));
    if (typeof obj === "object") {
      if (visited.has(obj)) return "[Circular]";
      visited.add(obj);
      // Prisma Decimal / Decimal.js compatibility
      if (obj.constructor && (obj.constructor.name === "Decimal" || obj.constructor.name === "n")) {
        return Number(obj.toString());
      }
      if (obj.d && Array.isArray(obj.d) && typeof obj.s === "number") {
        return Number(obj.toString());
      }
      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          try {
            newObj[key] = deepSanitize(obj[key], visited);
          } catch (error) {
            console.error(`deepSanitize failed on key ${key}:`, error);
            newObj[key] = null;
          }
        }
      }
      visited.delete(obj);
      return newObj;
    }
    return null;
  }

  const preparerId = preparerRaw.id;
  let preparer: any = null;
  let safeIcons: any = null;
  let orderListResetAt: any = null;
  try {
    orderListResetAt = preparerRaw.orderListResetAt;
    preparer = deepSanitize(preparerRaw);
    safeIcons = deepSanitize(icons);
  } catch (e) {
    console.error("Failed to sanitize initial data:", e);
    preparer = { shopLinks: [] };
    safeIcons = {};
    orderListResetAt = null;
  }
  const auth = { p: p!, exp: exp!, s: s! };
  const homeHref = preparerPath("/preparer", auth);
  const shopIds = (preparerRaw.shopLinks || []).map((l: any) => l.shopId);

  let couriers: any[] = [];
  let webStorePending: any[] = [];
  let drafts: any[] = [];
  try {
    [couriers, webStorePending, drafts] = await Promise.all([
      prisma.courier.findMany({
        where: preparerCourierAssignWhere,
        select: { id: true, name: true }
      }),
      prisma.order.findMany({
        where: {
          shopId: { in: shopIds },
          status: "pending",
          submissionSource: "web_store",
          submittedByCompanyPreparerId: null,
        },
        select: { id: true, orderNumber: true, summary: true, customerRegion: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.companyPreparerShoppingDraft.findMany({
        where: { preparerId, status: { in: ["draft", "priced"] } },
        select: {
          id: true,
          titleLine: true,
          status: true,
          createdAt: true,
          customerRegion: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
  } catch (e) {
    console.error("Failed to load initial data:", e);
    couriers = [];
    webStorePending = [];
    drafts = [];
  }

  let orderTable;
  try {
    orderTable = await loadPreparerPortalOrderTableData({
      preparerId,
      shopIds,
      orderListResetAt,
      tab: "all",
      wardFilter: "lower",
      saderFilter: "lower",
      prepFilter: null,
      onlySubmittedByThisPreparer: true,
    });
  } catch (error) {
    console.error("Failed to load preparer portal order table data:", error);
    return (
      <div className="kse-app-inner mx-auto max-w-3xl px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
          <p className="text-lg font-bold text-rose-700">حدث خطأ أثناء تحميل الطلبات</p>
          <p className="mt-3 text-sm text-slate-600">يرجى إعادة المحاولة، وإذا استمرت المشكلة أرسل لنا بيانات الطلب الذي تم إسناده.</p>
        </div>
      </div>
    );
  }

  function safeDeepSanitize(obj: any): any {
    try {
      return deepSanitize(obj);
    } catch (error) {
      console.error("safeDeepSanitize failed:", error);
      return null;
    }
  }

  const sanitizedWebStore = safeDeepSanitize(webStorePending) ?? [];
  const sanitizedDrafts = safeDeepSanitize(drafts) ?? [];
  const safeOrderTableRows = safeDeepSanitize(orderTable?.rows) ?? [];
  const safeSearchFields = safeDeepSanitize(orderTable?.searchFields) ?? [];
  const safeCouriers = safeDeepSanitize(couriers) ?? [];

  try {
    return (
      <div className="kse-app-inner mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <ModalAwareNavButton href={homeHref} className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100">
              ← الطلبات
            </ModalAwareNavButton>
            <FullscreenWalletLauncher href={preparerPath("/preparer/order/new", auth)} className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100" title="طلب يدوي">
              ➕ طلب يدوي
            </FullscreenWalletLauncher>
          </div>
          <ThemeSwitcher />
        </div>

        <section className="kse-glass-dark mb-4 rounded-2xl border border-violet-200/80 p-4 shadow-sm">
          <h2 className="text-base font-black text-violet-950 dark:text-violet-400">خانة طلبات التجهيز</h2>

          {/* عرض طلبات المتجر أولاً لأنها تتطلب تسعيراً فورياً */}
          {sanitizedWebStore.length > 0 && (
            <div className="mb-6 space-y-2">
              <p className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 w-fit">طلبات بانتظار التسعير (من المتجر) 🛒</p>
              {sanitizedWebStore.map((o: any) => (
                <div key={o.id} className="flex gap-2 items-stretch">
                  <FullscreenWalletLauncher
                    href={preparerPath(`/preparer/order/${o.id}`, auth)}
                    className="flex-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/30 p-3 hover:border-amber-400 hover:bg-amber-100/50 transition-all shadow-sm active:scale-[0.99] dark:bg-slate-900 dark:border-amber-900/20"
                    title={`طلب رقم ${o.orderNumber}`}
                  >
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">طلب رقم #{o.orderNumber} - {o.customerRegion?.name || "منطقة غير محددة"}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500 line-clamp-1">{o.summary}</p>
                    </div>
                    <div className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600">
                      تسعير الطلب 💰
                    </div>
                  </FullscreenWalletLauncher>
                  <form action={rejectOrderFromPreparerAction} onSubmit={(e) => { if(!confirm("هل أنت متأكد من رفض هذا الطلب؟")) e.preventDefault(); }}>
                    <input type="hidden" name="p" value={auth.p} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} />
                    <input type="hidden" name="orderId" value={o.id} />
                    <button type="submit" className="h-full rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 hover:bg-rose-100 transition-colors">رفض</button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-1 rounded border border-violet-200 w-fit mb-2">مسودات التجهيز (من الموظفين) 📝</p>
          {sanitizedDrafts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">لا توجد مسودات حالياً.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {sanitizedDrafts.map((d: any) => (
                <div key={d.id} className="flex gap-2 items-stretch">
                  <FullscreenWalletLauncher
                    href={preparerPath(`/preparer/preparation/draft/${d.id}`, auth)}
                    className="flex-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 hover:border-violet-300 hover:bg-violet-50/30 transition-all shadow-sm active:scale-[0.99] dark:bg-slate-900 dark:border-slate-800"
                    title="فتح / تسعير المسودة"
                  >
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{d.titleLine || "—"}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {d.customerRegion?.name || "منطقة غير محددة"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700">
                      فتح / تسعير
                    </div>
                  </FullscreenWalletLauncher>
                  <form action={archivePreparerShoppingDraftAction} onSubmit={(e) => { if(!confirm("هل أنت متأكد من رفض هذه المسودة؟")) e.preventDefault(); }}>
                    <input type="hidden" name="p" value={auth.p} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} />
                    <input type="hidden" name="draftId" value={d.id} />
                    <button type="submit" className="h-full rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 hover:bg-rose-100 transition-colors">رفض</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mx-auto max-w-lg">
          <PreparerSiteOrderDraftClient auth={auth} preparerName={preparer.name} homeHref={homeHref} />
        </div>

        <section className="kse-glass-dark mt-8 overflow-hidden border border-sky-200 shadow-sm dark:border-slate-800">
          <div className="p-3 border-b border-sky-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-sky-900 dark:text-sky-400">الطلبات المرفوعة</h3>
          </div>
          <PreparerOrdersSection allRows={safeOrderTableRows} searchFields={safeSearchFields} auth={auth} tab="all" initialQuery={sp.q || ""} couriersForBulkAssign={safeCouriers} />
        </section>
      </div>
    );
  } catch (error) {
    console.error("Error rendering preparer preparation page:", error);
    return (
      <div className="kse-app-inner mx-auto max-w-3xl px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
          <p className="text-lg font-bold text-rose-700">حدث خطأ أثناء تحميل الصفحة</p>
          <p className="mt-3 text-sm text-slate-600">يرجى إعادة المحاولة، وإذا استمرت المشكلة أخبرنا بالوصف الظاهر لديك.</p>
        </div>
      </div>
    );
  }
}