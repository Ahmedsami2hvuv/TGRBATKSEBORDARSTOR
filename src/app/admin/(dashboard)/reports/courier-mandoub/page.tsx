import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { Decimal } from "@prisma/client/runtime/library";
import {
  computeMoneySumsFromCourierEvents,
  mergeMiscWalletIntoSums,
} from "@/lib/mandoub-courier-event-totals";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "لوحة المندوب (منذ التصفير) — أبو الأكبر للتوصيل",
};

function vehicleAr(v: string) {
  if (v === "bike") return "دراجة";
  if (v === "car") return "سيارة";
  return v;
}

export default async function CourierMandoubSinceResetReportPage() {
  const couriers = await prisma.courier.findMany({
    where: { blocked: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      vehicleType: true,
      mandoubTotalsResetAt: true,
    },
  });

  const ids = couriers.map((c) => c.id);
  const orders =
    ids.length === 0
      ? []
      : await prisma.order.findMany({
          where: {
            assignedCourierId: { in: ids },
            status: { in: ["assigned", "delivering", "delivered", "archived"] },
          },
          select: {
            assignedCourierId: true,
            status: true,
            updatedAt: true,
            courierEarningDinar: true,
            courierEarningForCourierId: true,
            moneyEvents: {
              orderBy: { createdAt: "asc" },
              select: {
                kind: true,
                amountDinar: true,
                deletedAt: true,
                createdAt: true,
                courierId: true,
              },
            },
          },
        });

  const byCourier = new Map<string, typeof orders>();
  for (const o of orders) {
    const cid = o.assignedCourierId;
    if (!cid) continue;
    if (!byCourier.has(cid)) byCourier.set(cid, []);
    byCourier.get(cid)!.push(o);
  }

  const allEvents =
    ids.length === 0
      ? []
      : await prisma.orderCourierMoneyEvent.findMany({
          where: { deletedAt: null, courierId: { in: ids } },
          select: {
            courierId: true,
            kind: true,
            amountDinar: true,
            createdAt: true,
          },
        });

  const allMisc =
    ids.length === 0
      ? []
      : await prisma.courierWalletMiscEntry.findMany({
          where: { deletedAt: null, courierId: { in: ids } },
          select: {
            courierId: true,
            direction: true,
            amountDinar: true,
            createdAt: true,
            label: true,
          },
        });

  const miscByCourier = new Map<
    string,
    Array<{
      direction: (typeof allMisc)[number]["direction"];
      amountDinar: (typeof allMisc)[number]["amountDinar"];
      createdAt: Date;
    }>
  >();
  for (const m of allMisc) {
    if (!miscByCourier.has(m.courierId)) miscByCourier.set(m.courierId, []);
    miscByCourier.get(m.courierId)!.push({
      direction: m.direction,
      amountDinar: m.amountDinar,
      createdAt: m.createdAt,
    });
  }

  type Row = {
    courierId: string;
    name: string;
    phone: string;
    vehicleType: string;
    resetAt: Date | null;
    money: ReturnType<typeof computeMoneySumsFromCourierEvents>;
    metrics: ReturnType<typeof computeMandoubTotalsForCourier>;
    tipSum: Decimal;
  };

  const rows: Row[] = couriers.map((c) => {
    const list = byCourier.get(c.id) ?? [];
    const listNorm = list.map((o) => ({
      ...o,
      moneyEvents: o.moneyEvents.map((e) => ({
        ...e,
        courierId: e.courierId ?? undefined,
      })),
    }));

    const miscForThis = allMisc.filter(m => m.courierId === c.id);
    let tipSum = new Decimal(0);
    for (const m of miscForThis) {
      if (m.label.includes("[إكرامية]") && (!c.mandoubTotalsResetAt || m.createdAt > c.mandoubTotalsResetAt)) {
        tipSum = tipSum.plus(m.amountDinar);
      }
    }

    return {
      courierId: c.id,
      name: c.name,
      phone: c.phone,
      vehicleType: c.vehicleType,
      resetAt: c.mandoubTotalsResetAt,
      money: mergeMiscWalletIntoSums(
        computeMoneySumsFromCourierEvents(
          allEvents,
          c.id,
          c.mandoubTotalsResetAt,
        ),
        miscByCourier.get(c.id) ?? [],
        c.mandoubTotalsResetAt,
      ),
      metrics: computeMandoubTotalsForCourier(listNorm, c.id, c.mandoubTotalsResetAt, true),
      tipSum,
    };
  });

  let grandWard = new Decimal(0);
  let grandSader = new Decimal(0);
  let grandRemain = new Decimal(0);
  let grandEarn = new Decimal(0);
  for (const r of rows) {
    grandWard = grandWard.plus(r.money.sumDeliveryIn);
    grandSader = grandSader.plus(r.money.sumPickupOut);
    grandRemain = grandRemain.plus(r.money.remainingNet);
    grandEarn = grandEarn.plus(r.metrics.sumEarnings).plus(r.tipSum);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/reports" className={ad.link}>
          ← التقارير
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin" className={ad.link}>
          الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>لوحة المندوب — منذ آخر تصفير</h1>
        <p className={`mt-1 ${ad.lead}`}>
          نفس <strong className="text-sky-900">الوارد، الصادر، المتبقي، وأرباحي</strong> الظاهرة في صفحة
          كل مندوب، محسوبة من حركات الأموال بعد تاريخ <strong className="text-sky-900">آخر تصفير</strong>{" "}
          (أو من بداية التشغيل إن لم يُجرَ تصفير). لتصفير الفترة للمندوب استخدم{" "}
          <strong className="text-sky-900">تعديل المندوب ← تصفير</strong> من الإعدادات.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-sky-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[72rem] border-collapse text-sm" dir="rtl">
          <thead>
            <tr className="border-b border-sky-200 bg-sky-50/90 text-sky-950">
              <th className="px-3 py-3 text-right font-bold">المندوب</th>
              <th className="px-3 py-3 text-center font-bold">آخر تصفير</th>
              <th className="px-3 py-3 text-center font-bold text-red-900">الوارد (أخذ)</th>
              <th className="px-3 py-3 text-center font-bold text-emerald-900">الصادر (أعطى)</th>
              <th className="px-3 py-3 text-center font-bold">المتبقي</th>
              <th className="px-3 py-3 text-center font-bold">أرباحي (أجور+إكراميات)</th>
              <th className="px-3 py-3 text-center font-bold">طلبات بحالة</th>
              <th className="px-3 py-3 text-center font-bold">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  لا يوجد مندوبون غير محظورين.
                </td>
              </tr>
            ) : (
              <>
                {rows.map((r) => (
                  <tr
                    key={r.courierId}
                    className="border-b border-sky-100 transition hover:bg-sky-50/50"
                  >
                    <td className="px-3 py-2.5 align-top">
                      <span className="font-bold text-slate-900">{r.name}</span>
                      <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                        {r.phone}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {vehicleAr(r.vehicleType)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs leading-relaxed text-slate-700">
                      {r.resetAt ? (
                        <span className="tabular-nums">
                          {r.resetAt.toLocaleString("ar-IQ-u-nu-latn", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      ) : (
                        <span className="text-slate-400">— (كل السجل)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-red-900 sm:text-sm">
                      {formatDinarAsAlfWithUnit(r.money.sumDeliveryIn)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-emerald-900 sm:text-sm">
                      {formatDinarAsAlfWithUnit(r.money.sumPickupOut)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-orange-900 sm:text-sm">
                      {formatDinarAsAlfWithUnit(r.money.remainingNet)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-amber-900 sm:text-sm">
                      {formatDinarAsAlfWithUnit(r.metrics.sumEarnings.plus(r.tipSum))}
                    </td>
                    <td className="px-3 py-2.5 text-center text-[11px] leading-relaxed text-slate-800 sm:text-xs">
                      بانتظار: <strong className="tabular-nums">{r.metrics.ordersAssigned}</strong>{" · "}
                      عند المندوب: <strong className="tabular-nums">{r.metrics.ordersDelivering}</strong>{" · "}
                      مُسلَّم: <strong className="tabular-nums">{r.metrics.ordersDelivered}</strong>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Link
                        href={`/admin/couriers/${r.courierId}/edit`}
                        className="text-sm font-bold text-sky-800 underline decoration-sky-300 underline-offset-2 hover:text-sky-950"
                      >
                        تعديل / تصفير
                      </Link>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-sky-300 bg-sky-100/60 font-bold text-sky-950">
                  <td className="px-3 py-3 text-right">المجموع (كل المندوبين)</td>
                  <td className="px-3 py-3 text-center text-xs font-normal text-slate-600">
                    —
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-sm tabular-nums">
                    {formatDinarAsAlfWithUnit(grandWard)}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-sm tabular-nums">
                    {formatDinarAsAlfWithUnit(grandSader)}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-sm tabular-nums">
                    {formatDinarAsAlfWithUnit(grandRemain)}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-sm tabular-nums">
                    {formatDinarAsAlfWithUnit(grandEarn)}
                  </td>
                  <td className="px-3 py-3 text-center text-xs font-normal text-slate-600" colSpan={2}>
                    —
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
