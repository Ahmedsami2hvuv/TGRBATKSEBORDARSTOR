import Link from "next/link";
import { cookies } from "next/headers";
import type { DelegatePortalVerifyReason } from "@/lib/delegate-link";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { fetchMandoubMoneySumsForCourier, fetchOrderOnlyMoneySumsForCourier } from "@/lib/mandoub-courier-event-totals";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";
import {
  findMandoubOrderForCourier,
  mandoubOrderDetailInclude,
} from "@/lib/mandoub-order-queries";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { MandoubMoneySummarySection } from "../../mandoub-money-summary-section";
import { OrderDetailSection } from "../../order-detail-section";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MandoubPresenceToggle } from "../../mandoub-presence-toggle";
import { getUISettings } from "@/lib/ui-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تفاصيل الطلب — المندوب",
};

function invalidLinkMessage(reason: DelegatePortalVerifyReason): string {
  switch (reason) {
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. يرجى فتح الرابط الأصلي المرسل إليك.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل. تواصل مع الإدارة.";
  }
}

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{
    c?: string;
    exp?: string;
    s?: string;
    tab?: string;
    q?: string;
    loc?: string;
  }>;
};

export default async function MandoubOrderDetailPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;
  const cookieStore = await cookies();

  // محاولة القراءة من الرابط أو الكوكيز
  const c = sp.c || cookieStore.get("mandoub_c")?.value;
  const s = sp.s || cookieStore.get("mandoub_s")?.value;
  const exp = sp.exp || cookieStore.get("mandoub_exp")?.value;

  const v = verifyDelegatePortalQuery(c, exp, s);

  if (!v.ok) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">لا يمكن فتح الطلب</p>
            <p className="mt-2 text-sm text-slate-600">{invalidLinkMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const courier = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { id: true, name: true, phone: true, blocked: true, mandoubTotalsResetAt: true, vehicleType: true, availableForAssignment: true },
  });
  if (!courier || courier.blocked) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-800">الحساب معطل</p>
          </div>
        </div>
      </div>
    );
  }

  const baseAuth = { c: c!, exp: exp || "", s: s! };
  const baseQuery = new URLSearchParams();
  if (baseAuth.c) baseQuery.set("c", baseAuth.c);
  if (baseAuth.exp) baseQuery.set("exp", baseAuth.exp);
  if (baseAuth.s) baseQuery.set("s", baseAuth.s);

  const order = await findMandoubOrderForCourier(orderId, v.courierId);

  if (!order) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-amber-300 p-8 text-center">
            <p className="text-lg font-bold text-amber-900">الطلب غير موجود أو غير مسند إليك</p>
            <Link href={`/mandoub?${baseQuery.toString()}`} className="mt-4 inline-block font-bold text-sky-800 underline">
              العودة للطلبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const customerPhoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
  const customerPhoneProfile =
    customerPhoneNorm && order.customerRegionId
      ? await prisma.customerPhoneProfile.findUnique({
          where: {
            phone_regionId: {
              phone: customerPhoneNorm,
              regionId: order.customerRegionId,
            },
          },
          select: {
            photoUrl: true,
            locationUrl: true,
            landmark: true,
            alternatePhone: true,
          },
        })
      : null;

  const moneySums = await fetchOrderOnlyMoneySumsForCourier(v.courierId, courier.mandoubTotalsResetAt);
  const activeOrdersForTotals = await prisma.order.findMany({
    where: {
      status: { in: ["assigned", "delivering", "delivered"] },
      OR: [{ assignedCourierId: v.courierId }, { courierEarningForCourierId: v.courierId }],
    },
    include: mandoubOrderDetailInclude,
  });

  const orderMetrics = computeMandoubTotalsForCourier(
    activeOrdersForTotals.map(o => ({...o, moneyEvents: o.moneyEvents.map(e => ({...e, courierId: e.courierId ?? undefined}))})),
    v.courierId,
    courier.mandoubTotalsResetAt
  );

  // جلب إعدادات الستايل لقسم تفاصيل الطلب
  const uiSettings = await getUISettings("mandoub", "order_details");

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-base leading-relaxed text-slate-800">
      <div className="kse-app-inner mx-auto max-w-6xl px-3 py-4 pb-24 text-base sm:px-4 sm:text-lg">
        <header className="kse-glass-dark mb-3 flex items-center gap-2 border border-sky-200/90 px-3 py-2.5 shadow-sm">
          <Link href={`/mandoub?${baseQuery.toString()}`} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-[#00f3ff]">{courier.name}</p>
            <p className="text-[10px] font-bold text-slate-500 sm:text-xs">{courier.phone}</p>
          </div>
          <ThemeSwitcher />
          <MandoubPresenceToggle auth={baseAuth} availableForAssignment={courier.availableForAssignment} />
          <Link href={`/mandoub/wallet?${baseQuery.toString()}`} className="inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-violet-500 bg-violet-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-violet-700 sm:px-4 sm:text-base">المحفظة</Link>
        </header>

        <MandoubMoneySummarySection
          totalsBaseline={courier.mandoubTotalsResetAt}
          sumDeliveryInDinar={Number(moneySums.sumDeliveryIn)}
          sumPickupOutDinar={Number(moneySums.sumPickupOut)}
          remainingNetDinar={Number(moneySums.remainingNet)}
          sumEarningsDinar={Number(orderMetrics.sumEarnings)}
          courierVehicleType={courier.vehicleType}
          hrefWalletLedger={(l) => `/mandoub/wallet?${baseQuery.toString()}${l !== 'all' ? '&ledger=' + l : ''}`}
          hideTitle hideResetText
        />

        <OrderDetailSection
          order={order}
          closeHref={`/mandoub?${baseQuery.toString()}`}
          auth={baseAuth}
          nextUrl={`/mandoub/order/${orderId}?${baseQuery.toString()}`}
          viewerCourierId={v.courierId}
          phoneProfile={customerPhoneProfile ?? undefined}
          uiSettings={uiSettings}
        />
      </div>
    </div>
  );
}
