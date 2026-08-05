import Link from "next/link";
import { cookies } from "next/headers";
import type { DelegatePortalVerifyReason } from "@/lib/delegate-link";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { fetchMandoubMoneySumsForCourier, fetchOrderOnlyMoneySumsForCourier } from "@/lib/mandoub-courier-event-totals";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";
import { haversineMeters } from "@/lib/geo-distance";
import { mandoubOrderDetailInclude } from "@/lib/mandoub-order-queries";
import { extractLatLngFromLocationInputSmart } from "@/lib/order-location";
import { computeSmartHint } from "@/lib/smart-hint-logic";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { MandoubMoneySummarySection } from "../../mandoub-money-summary-section";
import { OrderDetailSection } from "../../order-detail-section";
import { MandoubPresenceToggle } from "../../mandoub-presence-toggle";
import { getUISettings } from "@/lib/ui-settings";
import { getGlobalIcons } from "@/lib/icon-settings";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";
import { MandoubOrderAdminUpdatePoller } from "../../mandoub-order-admin-update-poller";

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

function cleanSnapshotString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
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
    view?: string;
  }>;
};

export default async function MandoubOrderDetailPage({ params, searchParams }: Props) {
  try {
    const { orderId } = await params;
    const sp = await searchParams;
    const modalOnly = sp.view === "modal";
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
    select: {
      id: true,
      name: true,
      phone: true,
      blocked: true,
      mandoubTotalsResetAt: true,
      vehicleType: true,
      availableForAssignment: true,
      showDoorBtn: true,
      showLocationBtn: true,
      showCallBtn: true,
      showWhatsAppBtn: true,
      showNotesBtn: true,
      showVoiceNotesBtn: true,
      showMoneyBoxes: true,
    },
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

  const [order, waButtonsRaw] = await Promise.all([
    findMandoubOrderForCourier(orderId, v.courierId),
    prisma.mandoubWaButtonSetting.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (order) {
    const doubleStaff = (order.routeMode === "double" || !!order.secondCustomerPhone) && order.submissionSource === "staff_portal";
    const prepJson = order.preparerShoppingJson as any;
    const staffProfit = (doubleStaff && prepJson && typeof prepJson === "object" && typeof prepJson.staffProfit === "number") ? prepJson.staffProfit : 0;
    if (staffProfit > 0 && order.orderSubtotal != null) {
      order.orderSubtotal = new Decimal(Number(order.orderSubtotal) - staffProfit);
    }
  }

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

  // تحويل الطلب إلى JSON لضمان التوافق مع Next.js 15 (Serialization safety)
  const safeOrder = JSON.parse(JSON.stringify(order)) as typeof order;

  const customerPhoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
  let customerPhoneProfile = null;
  if (customerPhoneNorm && order.customerRegionId) {
    customerPhoneProfile = await prisma.customerPhoneProfile.findUnique({
      where: {
        phone_regionId: {
          phone: customerPhoneNorm,
          regionId: order.customerRegionId,
        },
      },
      select: {
        id: true,
        photoUrl: true,
        locationUrl: true,
        landmark: true,
        alternatePhone: true,
      },
    });
  }

  const secondPhoneNorm = order.secondCustomerPhone
    ? normalizeIraqMobileLocal11(order.secondCustomerPhone)
    : null;
  let secondPhoneProfile = null;
  if (secondPhoneNorm && order.secondCustomerRegionId) {
    secondPhoneProfile = await prisma.customerPhoneProfile.findUnique({
      where: {
        phone_regionId: {
          phone: secondPhoneNorm,
          regionId: order.secondCustomerRegionId,
        },
      },
      select: {
        id: true,
        photoUrl: true,
        locationUrl: true,
        landmark: true,
        alternatePhone: true,
      },
    });
  }

  const [smartHintLine, secondSmartHintLine] = await Promise.all([
    computeSmartHint(order.id, "primary"),
    order.routeMode === "double" ? computeSmartHint(order.id, "secondary") : Promise.resolve("—"),
  ]);

  const routeHistoryRows = await prisma.courierLocationPoint.findMany({
    where: { courierId: v.courierId },
    orderBy: { recordedAt: "desc" },
    take: 48,
  });
  const routeHistory = routeHistoryRows
    .map((item) => ({ lat: item.latitude, lng: item.longitude, recordedAt: item.recordedAt.toISOString() }))
    .reverse();

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
  const [uiSettings, icons] = await Promise.all([
    getUISettings("mandoub", "order_details"),
    getGlobalIcons()
  ]);

    return (
      <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-base leading-relaxed text-slate-800">
        <div className="kse-app-inner mx-auto max-w-6xl px-3 py-4 pb-24 text-base sm:px-4 sm:text-lg">
          {!modalOnly ? (
            <>
              <header className="kse-glass-dark mb-3 flex items-center gap-2 border border-sky-200/90 px-3 py-2.5 shadow-sm">
                <Link href={`/mandoub?${baseQuery.toString()}`} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
                  <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-slate-900 sm:text-lg dark:text-[#00f3ff]">{courier.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 sm:text-xs">{courier.phone}</p>
                </div>
                <Link
                  href={`/mandoub/settings?${baseQuery.toString()}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-[#00f3ff]/30 text-lg shadow-sm transition hover:scale-105"
                  title="الإعدادات"
                >
                  ⚙️
                </Link>
                <MandoubPresenceToggle auth={baseAuth} availableForAssignment={courier.availableForAssignment} />
                <FullscreenWalletLauncher
                  href={`/mandoub/wallet?${baseQuery.toString()}`}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-violet-500 bg-violet-600 px-3 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-violet-700 sm:px-4 sm:text-base"
                  title="محفظة المندوب"
                >
                  المحفظة
                </FullscreenWalletLauncher>
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
            </>
          ) : null}

          <MandoubOrderAdminUpdatePoller
            orderId={safeOrder.id}
            initialUpdatedAtIso={new Date(safeOrder.updatedAt).toISOString()}
            initialSnapshot={{
              status: cleanSnapshotString(safeOrder.status),
              totalAmount: safeOrder.totalAmount != null ? String(safeOrder.totalAmount) : "",
              deliveryPrice: safeOrder.deliveryPrice != null ? String(safeOrder.deliveryPrice) : "",
              summary: cleanSnapshotString(safeOrder.summary),
              orderType: cleanSnapshotString(safeOrder.orderType),
              customerLocationUrl: cleanSnapshotString(safeOrder.customerLocationUrl),
              customerLandmark: cleanSnapshotString(safeOrder.customerLandmark),
              customerDoorPhotoUrl: cleanSnapshotString(safeOrder.customerDoorPhotoUrl),
              adminVoiceNoteUrl: cleanSnapshotString(safeOrder.adminVoiceNoteUrl),
              shopDoorPhotoUrl: cleanSnapshotString(safeOrder.shopDoorPhotoUrl),
              secondCustomerPhone: cleanSnapshotString(safeOrder.secondCustomerPhone),
              secondCustomerLocationUrl: cleanSnapshotString(safeOrder.secondCustomerLocationUrl),
              secondCustomerLandmark: cleanSnapshotString(safeOrder.secondCustomerLandmark),
              secondCustomerDoorPhotoUrl: cleanSnapshotString(safeOrder.secondCustomerDoorPhotoUrl),
            }}
            auth={baseAuth}
          />
          <OrderDetailSection
            order={safeOrder}
            closeHref={`/mandoub?${baseQuery.toString()}`}
            auth={baseAuth}
            nextUrl={`/mandoub/order/${orderId}?${baseQuery.toString()}${modalOnly ? "&view=modal" : ""}`}
            viewerCourierId={v.courierId}
            courierName={courier.name}
            phoneProfile={customerPhoneProfile ?? undefined}
            secondPhoneProfile={secondPhoneProfile ?? undefined}
            customWaButtons={JSON.parse(JSON.stringify(waButtonsRaw))}
            smartHintLine={smartHintLine || "—"}
            secondSmartHintLine={secondSmartHintLine || "—"}
            uiSettings={uiSettings}
            icons={icons}
            routeHistory={routeHistory}
            courierSettings={{
              showDoorBtn: true,
              showLocationBtn: true,
              showCallBtn: true,
              showWhatsAppBtn: true,
              showNotesBtn: true,
              showVoiceNotesBtn: true,
              showMoneyBoxes: true,
            }}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[MandoubOrderDetailPage] Unexpected render error", error);
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذر فتح صفحة الطلب حالياً</p>
            <p className="mt-2 text-sm text-slate-600">
              صارت مشكلة داخلية مؤقتة. أعد تحميل الصفحة، وإذا استمرت تواصل مع الإدارة.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
