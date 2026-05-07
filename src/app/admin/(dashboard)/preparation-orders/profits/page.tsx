import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { normalizeAdminShopName } from "@/lib/admin-order-from-admin-constants";
import { ALF_PER_DINAR, formatDinarAsAlf } from "@/lib/money-alf";
import { parseDateRangeFromSearchParams } from "@/lib/report-dates";

export const dynamic = "force-dynamic";

type JsonRow = {
  sumSellAlf?: number;
  sumBuyAlf?: number;
  extraAlf?: number;
  deliveryAlf?: number;
};

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function PreparationProfitsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { from, to, fromInput, toInput } = parseDateRangeFromSearchParams(sp);

  const ordersRaw = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      submittedByCompanyPreparerId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    include: {
      shop: { select: { name: true } },
      submittedByCompanyPreparer: { select: { name: true } },
    },
  });

  const orders = ordersRaw.filter((o) => o.preparerShoppingJson != null);

  let totalProfitAlf = 0;
  const rows = orders.map((o) => {
    const j = o.preparerShoppingJson as JsonRow | null;
    const sell = typeof j?.sumSellAlf === "number" ? j.sumSellAlf : 0;
    const buy = typeof j?.sumBuyAlf === "number" ? j.sumBuyAlf : 0;
    const extra = typeof j?.extraAlf === "number" ? j.extraAlf : 0;
    const profitAlf = sell - buy + extra;
    totalProfitAlf += profitAlf;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      shopName: normalizeAdminShopName(o.shop.name),
      preparerName: o.submittedByCompanyPreparer?.name?.trim() || "—",
      profitAlf,
      createdAt: o.createdAt,
    };
  });

  const totalDinar = totalProfitAlf * ALF_PER_DINAR;

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/preparation-orders" className={ad.link}>
          ← تجهيز الطلبات
        </Link>
      </p>
      <h1 className={ad.h1}>أرباح طلبات التجهيز (تقديري)</h1>
      <p className={ad.lead}>
        الربح ≈ مجموع (سعر للزبون − شراء) + إضافة التجهيز لكل طلب يحتوي بيانات JSON. التوصيل يُحسب في إجمالي الطلب
        وليس هنا بالتفصيل.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={ad.label}>من</span>
          <input type="date" name="from" defaultValue={fromInput} className={ad.input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={ad.label}>إلى</span>
          <input type="date" name="to" defaultValue={toInput} className={ad.input} />
        </label>
        <button type="submit" className={ad.btnPrimary}>
          تطبيق
        </button>
      </form>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-slate-900">
        <p className="text-sm font-bold">الربح التقديري الكلي : {totalProfitAlf.toFixed(2)}</p>
        <p className="text-xs text-slate-600">≈ {formatDinarAsAlf(totalDinar)} دينار</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-start font-bold">رقم</th>
              <th className="px-3 py-2 text-start font-bold">محل</th>
              <th className="px-3 py-2 text-start font-bold">مجهز</th>
              <th className="px-3 py-2 text-start font-bold">ربح </th>
              <th className="px-3 py-2 text-start font-bold">تاريخ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono">#{r.orderNumber}</td>
                <td className="px-3 py-2">{r.shopName}</td>
                <td className="px-3 py-2">{r.preparerName}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{r.profitAlf.toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {r.createdAt.toLocaleString("ar-IQ-u-nu-latn", { dateStyle: "short", timeStyle: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
