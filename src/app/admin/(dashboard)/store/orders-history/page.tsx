import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    minOrders?: string;
  }>;
};

type StoreCartItem = {
  name?: string;
  line?: string;
  quantity?: number;
  qty?: number;
  price?: number | string;
  productId?: string;
  supplierId?: string | null;
};

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

function parseItems(data: unknown): StoreCartItem[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.webStoreCart)) return obj.webStoreCart as StoreCartItem[];
  if (Array.isArray(obj.products)) return obj.products as StoreCartItem[];
  return [];
}

function countSections(items: StoreCartItem[]): number {
  const keys = new Set<string>();
  for (const item of items) {
    const key = String(item.supplierId || item.productId || item.name || item.line || "").trim();
    if (key) keys.add(key);
  }
  return keys.size;
}

function computeTotal(items: StoreCartItem[]): number {
  let total = 0;
  for (const item of items) {
    const qty = Math.max(1, toNum(item.quantity ?? item.qty ?? 1));
    const price = toNum(item.price);
    total += price * qty;
  }
  return total;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ar-IQ");
}

function formatMoneyAlfLike(n: number): string {
  return `${formatNumber(n)}`;
}

function safeOrderNumber(data: unknown): string {
  if (!data || typeof data !== "object") return "—";
  const v = toNum((data as Record<string, unknown>).reservedOrderNumber);
  return v > 0 ? String(Math.trunc(v)) : "—";
}

export default async function StoreOrdersHistoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const minOrders = Math.max(1, toNum(sp.minOrders || 1));
  const storeSetting = await prisma.uISystemSetting.findUnique({
    where: { target_section: { target: "customer", section: "store_general" } },
  });
  const storeConfig = (storeSetting?.config as Record<string, unknown> | null) || {};
  const excelExportEnabled = storeConfig.export_store_orders_excel_enabled !== false;

  const drafts = await prisma.companyPreparerShoppingDraft.findMany({
    where: {
      OR: [
        { titleLine: { contains: "المتجر", mode: "insensitive" } },
        { titleLine: { contains: "Store", mode: "insensitive" } },
      ],
    },
    include: {
      customerRegion: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const rows = drafts.map((d) => {
    const items = parseItems(d.data);
    const total = computeTotal(items);
    const orderNo = safeOrderNumber(d.data);
    const phone = normalizePhone(d.customerPhone || "");
    const dateLabel = formatBaghdadDateTime(d.createdAt, { dateStyle: "short", timeStyle: "short" });

    return {
      id: d.id,
      orderNumber: orderNo,
      regionName: d.customerRegion?.name || "—",
      customerPhone: phone || "—",
      sectionsCount: countSections(items),
      totalAmount: total,
      createdAt: d.createdAt,
      dateLabel,
    };
  });

  const customerOrderCounts = new Map<string, number>();
  for (const row of rows) {
    const key = row.customerPhone.trim();
    if (!key || key === "—") continue;
    customerOrderCounts.set(key, (customerOrderCounts.get(key) ?? 0) + 1);
  }

  let filtered = rows.filter((r) => (customerOrderCounts.get(r.customerPhone) ?? 0) >= minOrders);

  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter((r) => {
      const hay = [
        r.orderNumber,
        r.regionName,
        r.customerPhone,
        String(r.totalAmount),
        formatMoneyAlfLike(r.totalAmount),
        r.dateLabel,
        r.createdAt.toISOString().slice(0, 10),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">سجل طلبات المتجر</h1>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
            عرض الطلبات بالتسلسل مع البحث وعدد الطلبات لكل زبون
          </p>
        </div>
        <div className="flex items-center gap-2">
          {excelExportEnabled ? (
            <a
              href={`/api/admin/store/orders-history/export?q=${encodeURIComponent(q)}&minOrders=${encodeURIComponent(String(minOrders))}`}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
            >
              تصدير Excel
            </a>
          ) : (
            <span className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">
              تصدير Excel متوقف من الإعدادات
            </span>
          )}
          <Link href="/admin/store" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">
            الرجوع إلى المتجر
          </Link>
        </div>
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <input
          name="q"
          defaultValue={q}
          placeholder="بحث: منطقة / رقم طلب / رقم زبون / سعر / تاريخ"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950"
        />
        <select
          name="minOrders"
          defaultValue={String(minOrders)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="1">كل الزبائن (1+ طلب)</option>
          <option value="2">الزبائن 2+ طلب</option>
          <option value="3">الزبائن 3+ طلب</option>
          <option value="5">الزبائن 5+ طلب</option>
          <option value="10">الزبائن 10+ طلب</option>
        </select>
        <button type="submit" className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700">
          تطبيق البحث والفلتر
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr className="text-slate-700 dark:text-slate-200">
              <th className="px-4 py-3 font-black">رقم الطلب</th>
              <th className="px-4 py-3 font-black">اسم المنطقة</th>
              <th className="px-4 py-3 font-black">رقم الزبون</th>
              <th className="px-4 py-3 font-black">عدد الأقسام</th>
              <th className="px-4 py-3 font-black">سعر الطلب الكلي</th>
              <th className="px-4 py-3 font-black">تاريخ الطلب</th>
              <th className="px-4 py-3 font-black">عدد طلبات الزبون</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center font-bold text-slate-400">
                  لا توجد نتائج مطابقة.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{r.orderNumber}</td>
                  <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{r.regionName}</td>
                  <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{r.customerPhone}</td>
                  <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{formatNumber(r.sectionsCount)}</td>
                  <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{formatMoneyAlfLike(r.totalAmount)}</td>
                  <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{r.dateLabel}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      {formatNumber(customerOrderCounts.get(r.customerPhone) ?? 0)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
