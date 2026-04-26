import Link from "next/link";
import { alfAmountToDinarFilter } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import {
  runAdminSuperSearch,
  type AdminSuperSearchParams,
} from "@/lib/admin-super-search";
import { AdminSearchOrdersBulk } from "./admin-search-orders-bulk";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    days?: string;
    status?: string;
    courierId?: string;
    minAmount?: string;
    maxAmount?: string;
  }>;
};

function asNumber(v?: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statusAr(v: string): string {
  switch (v) {
    case "pending":
      return "طلب جديد";
    case "assigned":
      return "بانتظار المندوب";
    case "delivering":
      return "عند المندوب";
    case "delivered":
      return "تم التسليم";
    case "cancelled":
      return "ملغي/مرفوض";
    case "archived":
      return "مؤرشف";
    default:
      return v || "—";
  }
}

export default async function AdminSearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const scope = (sp.scope as AdminSuperSearchParams["scope"]) || "all";
  const minAmountAlf = asNumber(sp.minAmount);
  const maxAmountAlf = asNumber(sp.maxAmount);

  const params: AdminSuperSearchParams = {
    q,
    scope:
      scope === "orders" ||
      scope === "customers" ||
      scope === "shops" ||
      scope === "couriers" ||
      scope === "settings" ||
      scope === "employees" ||
      scope === "preparers"
        ? scope
        : "all",
    days: asNumber(sp.days),
    status: (sp.status ?? "").trim(),
    courierId: (sp.courierId ?? "").trim(),
    minAmount:
      minAmountAlf != null ? alfAmountToDinarFilter(minAmountAlf) : null,
    maxAmount:
      maxAmountAlf != null ? alfAmountToDinarFilter(maxAmountAlf) : null,
  };

  const couriers = await prisma.courier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const result = q ? await runAdminSuperSearch(params) : null;
  const totalCount = result
    ? result.orders.length +
      result.customers.length +
      result.shops.length +
      result.couriers.length +
      result.employees.length +
      result.companyPreparers.length +
      result.regions.length +
      result.settings.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ad.h1}>البحث الخارق</h1>
        <p className={ad.lead}>
          ابحث عن أي تفصيل: رقم طلب، هاتف، ملاحظات الطلب، نوع الطلب، الأقسام، المندوبين، وغيرها.
        </p>
      </div>

      <section className={ad.section}>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className={ad.label}>بحث</span>
            <input
              name="q"
              defaultValue={q}
              className={ad.input}
              placeholder="مثال: كسر / كيك / 077... / تقرير / رقم طلب"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>النطاق</span>
            <select name="scope" className={ad.select} defaultValue={params.scope}>
              <option value="all">الكل</option>
              <option value="orders">الطلبات</option>
              <option value="customers">الزبائن</option>
              <option value="shops">المحلات</option>
              <option value="couriers">المندوبين</option>
              <option value="employees">موظفو المحلات</option>
              <option value="preparers">مجهزو الشركة</option>
              <option value="settings">الإعدادات/الأقسام</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>آخر X يوم</span>
            <input
              name="days"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={params.days ?? ""}
              className={ad.input}
              placeholder="مثال: 30"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>حالة الطلب</span>
            <select name="status" className={ad.select} defaultValue={params.status}>
              <option value="">الكل</option>
              <option value="pending">طلب جديد</option>
              <option value="assigned">بانتظار المندوب</option>
              <option value="delivering">عند المندوب</option>
              <option value="delivered">تم التسليم</option>
              <option value="cancelled">ملغي/مرفوض</option>
              <option value="archived">مؤرشف</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>المندوب</span>
            <select name="courierId" className={ad.select} defaultValue={params.courierId}>
              <option value="">الكل</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>المبلغ من (بالألف)</span>
            <input
              name="minAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={minAmountAlf ?? ""}
              className={ad.input}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>المبلغ إلى (بالألف)</span>
            <input
              name="maxAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              defaultValue={maxAmountAlf ?? ""}
              className={ad.input}
            />
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className={ad.btnPrimary}>
              بحث
            </button>
            <Link href="/admin/search" className={ad.btnDark}>
              تصفير
            </Link>
          </div>
        </form>
      </section>

      {result ? (
        <section className={ad.section}>
          <p className={ad.muted}>عدد النتائج: {totalCount}</p>

          <div className="mt-4 space-y-5">
            <div>
              <h2 className={ad.h2}>الأقسام والإعدادات ({result.settings.length})</h2>
              <div className="mt-2 space-y-2">
                {result.settings.map((s, idx) => (
                  <Link
                    key={`${s.href}-${idx}`}
                    href={s.href}
                    className="block rounded-xl border border-sky-200 bg-white p-3 hover:bg-sky-50"
                  >
                    <p className="font-bold text-slate-900">{s.label}</p>
                    <p className="text-sm text-slate-600">{s.reason}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className={ad.h2}>الطلبات ({result.orders.length})</h2>
              <div className="mt-2">
                <AdminSearchOrdersBulk
                  orders={result.orders.map((o) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    shopName: o.shopName,
                    customerPhone: o.customerPhone,
                    summary: o.summary ?? "",
                    orderType: o.orderType ?? "",
                    totalAmount: o.totalAmount ?? "",
                  }))}
                  couriers={couriers}
                />
              </div>
            </div>

            <div>
              <h2 className={ad.h2}>الزبائن ({result.customers.length})</h2>
              <div className="mt-2 space-y-2">
                {result.customers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/customers`}
                    className="block rounded-xl border border-sky-200 bg-white p-3 hover:bg-sky-50"
                  >
                    <p className="font-bold text-slate-900">
                      {c.name || "بدون اسم"} — {c.phone}
                    </p>
                    <p className="text-sm text-slate-600">
                      المحل: {c.shopName} | المنطقة: {c.regionName || "—"}
                    </p>
                    <p className="text-sm text-slate-700">{c.landmark || "—"}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className={ad.h2}>المحلات ({result.shops.length})</h2>
              <div className="mt-2 space-y-2">
                {result.shops.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/shops/${s.id}/edit`}
                    className="block rounded-xl border border-sky-200 bg-white p-3 hover:bg-sky-50"
                  >
                    <p className="font-bold text-slate-900">{s.name}</p>
                    <p className="text-sm text-slate-600">
                      المالك: {s.ownerName || "—"} | الهاتف: {s.phone || "—"} | المنطقة:{" "}
                      {s.regionName || "—"}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className={ad.h2}>المناطق ({result.regions.length})</h2>
              <div className="mt-2 space-y-2">
                {result.regions.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/regions/${r.id}/edit`}
                    className="block rounded-xl border border-sky-200 bg-white p-3 hover:bg-sky-50"
                  >
                    <p className="font-bold text-slate-900">{r.name}</p>
                    <p className="text-sm text-slate-600">
                      سعر التوصيل: {r.deliveryPrice || "—"}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className={ad.h2}>المندوبون ({result.couriers.length})</h2>
              <div className="mt-2 space-y-2">
                {result.couriers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/couriers`}
                    className="block rounded-xl border border-sky-200 bg-white p-3 hover:bg-sky-50"
                  >
                    <p className="font-bold text-slate-900">
                      {c.name} — {c.phone}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className={ad.h2}>موظفو المحلات ({result.employees.length})</h2>
              <div className="mt-2 space-y-2">
                {result.employees.map((e) => (
                  <Link
                    key={e.id}
                    href={`/admin/shops`}
                    className="block rounded-xl border border-sky-200 bg-white p-3 hover:bg-sky-50"
                  >
                    <p className="font-bold text-slate-900">{e.name}</p>
                    <p className="text-sm text-slate-600">
                      {e.phone} — المحل: {e.shopName}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className={ad.h2}>مجهزو الشركة ({result.companyPreparers.length})</h2>
              <div className="mt-2 space-y-2">
                {result.companyPreparers.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/preparers`}
                    className="block rounded-xl border border-sky-200 bg-white p-3 hover:bg-sky-50"
                  >
                    <p className="font-bold text-slate-900">{p.name}</p>
                    <p className="text-sm text-slate-600">
                      {p.phone || "—"}
                      {p.notes ? ` — ${p.notes}` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </section>
      ) : null}
    </div>
  );
}

