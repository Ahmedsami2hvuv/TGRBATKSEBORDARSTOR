import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerCourierAssignWhere } from "@/lib/courier-assignable";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { loadPreparerPortalOrderTableData } from "@/lib/preparer-portal-order-table-data";
import { serializePrisma } from "@/lib/serialize-prisma";
import { PreparerOrdersSection } from "../preparer-orders-client";
import { PreparerSiteOrderDraftClient } from "./preparer-site-order-draft-client";
import { whatsappMeUrl } from "@/lib/whatsapp";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";
import { ModalAwareNavButton } from "@/components/modal-aware-nav-button";

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

  const preparerId = preparerRaw.id;
  const auth = { p: p!, exp: exp!, s: s! };
  const homeHref = preparerPath("/preparer", auth);
  const shopIds = (preparerRaw.shopLinks || []).map((l: any) => l.shopId);
  const orderListResetAt = preparerRaw.orderListResetAt;

  const [couriers, webStorePending, drafts] = await Promise.all([
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

  const orderTable = await loadPreparerPortalOrderTableData({
    preparerId,
    shopIds,
    orderListResetAt,
    tab: "all",
    wardFilter: "lower",
    saderFilter: "lower",
    prepFilter: null,
    onlySubmittedByThisPreparer: true,
  });

  // Serialization for Next.js 15
  const safePreparer = serializePrisma(preparerRaw);
  const safeIcons = serializePrisma(icons);
  const safeWebStore = serializePrisma(webStorePending);
  const safeDrafts = serializePrisma(drafts);
  const safeOrderTableRows = serializePrisma(orderTable?.rows || []);
  const safeSearchFields = serializePrisma(orderTable?.searchFields || []);
  const safeCouriers = serializePrisma(couriers);

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
        {safeWebStore.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 w-fit">طلبات بانتظار التسعير (من المتجر) 🛒</p>
            {safeWebStore.map((o: any) => (
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
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-1 rounded border border-violet-200 w-fit mb-2">مسودات التجهيز (من الموظفين) 📝</p>
        {safeDrafts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">لا توجد مسودات حالياً.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {safeDrafts.map((d: any) => (
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
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-lg">
        <PreparerSiteOrderDraftClient auth={auth} preparerName={safePreparer.name} homeHref={homeHref} />
      </div>

      <section className="kse-glass-dark mt-8 overflow-hidden border border-sky-200 shadow-sm dark:border-slate-800">
        <div className="p-3 border-b border-sky-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-sky-900 dark:text-sky-400">الطلبات المرفوعة</h3>
        </div>
        <PreparerOrdersSection allRows={safeOrderTableRows} searchFields={safeSearchFields} auth={auth} tab="all" initialQuery={sp.q || ""} couriersForBulkAssign={safeCouriers} />
      </section>
    </div>
  );
}