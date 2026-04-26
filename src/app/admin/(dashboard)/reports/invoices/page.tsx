import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatYMDLocal } from "@/lib/report-dates";
import InvoiceReportSearch from "./InvoiceReportSearch";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقارير الفواتير — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ day?: string; q?: string; type?: string }>;
};

type InvoiceReportRow = {
  id: string;
  source: "order" | "given" | "received" | "transfer";
  sourceLabel: string;
  typeLabel: string;
  amountDinar: number;
  orderNumber?: number;
  orderId?: string;
  courierName: string;
  partyName: string;
  kind: string;
  status: string;
  direction: "in" | "out" | "neutral";
  deleted?: boolean;
  rowColorClass: string;
  amountColorClass: string;
  dateLabel: string;
  timeLabel: string;
  details: string;
  searchText: string;
};

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default async function InvoiceReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const dayParam = sp.day;

  const today = new Date();
  const defaultDay = formatYMDLocal(today);
  const selectedDayIso = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : defaultDay;
  const parts = selectedDayIso.split("-").map(Number);
  const selectedDayDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const from = new Date(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate(), 0, 0, 0, 0);
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);

  const dayList = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return formatYMDLocal(d);
  });

  const [orderEvents, courierEntries, employeeEntries, walletTransfers] = await Promise.all([
    prisma.orderCourierMoneyEvent.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        order: {
          include: {
            shop: { select: { name: true } },
            customerRegion: { select: { name: true } },
            courier: { select: { name: true } },
          },
        },
        courier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.courierWalletMiscEntry.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { courier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employeeWalletMiscEntry.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.walletPeerTransfer.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        fromCourier: { select: { name: true } },
        toCourier: { select: { name: true } },
        fromEmployee: { select: { name: true } },
        toEmployee: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: InvoiceReportRow[] = [];

  const orderKindLabels: Record<string, string> = {
    pickup_out: "صادر",
    delivery_in: "وارد",
    order_in: "وارد",
    order_out: "صادر",
  };

  const orderKindsToShow = new Set(["order_in", "order_out", "pickup_out", "delivery_in"]);

  for (const ev of orderEvents.filter((ev) => orderKindsToShow.has(ev.kind))) {
    const amount = Number(ev.amountDinar);
    const order = ev.order;
    const createdAt = ev.createdAt;
    const courierName = ev.courier?.name ?? order.courier?.name ?? "غير معروف";
    const orderNumber = order.orderNumber;
    const sourceLabel = "فواتير الطلبات";
    const typeLabel = orderKindLabels[ev.kind] ?? `فاتورة طلب (${ev.kind})`;
    const details = `${order.shop.name} — ${order.customerRegion?.name ?? "منطقة غير معروفة"}`;
    const dateLabel = formatYMDLocal(createdAt);
    const timeLabel = formatTime(createdAt);
    const isIncomingOrder = ev.kind === "order_in" || ev.kind === "delivery_in";
    const searchText = [
      String(orderNumber),
      courierName,
      sourceLabel,
      typeLabel,
      details,
      dateLabel,
      timeLabel,
      ev.kind,
      String(amount),
    ]
      .join(" ")
      .toLowerCase();

    const deleted = ev.deletedAt != null;
    rows.push({
      id: `oe:${ev.id}`,
      source: "order",
      sourceLabel,
      typeLabel,
      amountDinar: amount,
      orderNumber,
      orderId: order.id,
      courierName,
      partyName: order.shop.name,
      kind: ev.kind,
      status: deleted ? "ملغاة" : "مرتبطة بطلب",
      direction: deleted ? "neutral" : isIncomingOrder ? "in" : "out",
      deleted,
      rowColorClass: deleted ? "bg-slate-100" : isIncomingOrder ? "bg-rose-50" : "bg-emerald-50",
      amountColorClass: deleted ? "text-slate-500" : isIncomingOrder ? "text-rose-700" : "text-emerald-700",
      dateLabel,
      timeLabel,
      details: deleted ? `${details} (ملغاة)` : details,
      searchText,
    });
  }

  for (const entry of courierEntries) {
    const amount = Number(entry.amountDinar);
    const createdAt = entry.createdAt;
    const incoming = entry.direction === "take";
    const typeLabel = incoming ? "وارد" : "صادر";
    const details = entry.label;
    const dateLabel = formatYMDLocal(createdAt);
    const timeLabel = formatTime(createdAt);
    const courierName = entry.courier.name;
    const searchText = [typeLabel, courierName, details, dateLabel, timeLabel, String(amount)].join(" ").toLowerCase();

    const deleted = entry.deletedAt != null;
    rows.push({
      id: `cm:${entry.id}`,
      source: entry.direction === "give" ? "given" : "received",
      sourceLabel: entry.direction === "give" ? "فواتير أعطيت" : "فواتير أخذت",
      typeLabel,
      amountDinar: amount,
      courierName,
      partyName: courierName,
      kind: entry.direction,
      status: deleted ? "ملغاة" : "سجل يدوي",
      direction: deleted ? "neutral" : incoming ? "in" : "out",
      deleted,
      rowColorClass: deleted ? "bg-slate-100" : incoming ? "bg-rose-50" : "bg-emerald-50",
      amountColorClass: deleted ? "text-slate-500" : incoming ? "text-rose-700" : "text-emerald-700",
      dateLabel,
      timeLabel,
      details: deleted ? `${details} (ملغاة)` : details,
      searchText,
    });
  }

  for (const entry of employeeEntries) {
    const amount = Number(entry.amountDinar);
    const createdAt = entry.createdAt;
    const incoming = entry.direction === "take";
    const typeLabel = incoming ? "وارد" : "صادر";
    const personName = entry.employee.name;
    const details = entry.label;
    const dateLabel = formatYMDLocal(createdAt);
    const timeLabel = formatTime(createdAt);
    const searchText = [typeLabel, personName, details, dateLabel, timeLabel, String(amount)].join(" ").toLowerCase();

    const deleted = entry.deletedAt != null;
    rows.push({
      id: `em:${entry.id}`,
      source: entry.direction === "give" ? "given" : "received",
      sourceLabel: entry.direction === "give" ? "فواتير أعطيت" : "فواتير أخذت",
      typeLabel,
      amountDinar: amount,
      courierName: personName,
      partyName: personName,
      kind: entry.direction,
      status: deleted ? "ملغاة" : "سجل مجز",
      direction: deleted ? "neutral" : incoming ? "in" : "out",
      deleted,
      rowColorClass: deleted ? "bg-slate-100" : incoming ? "bg-rose-50" : "bg-emerald-50",
      amountColorClass: deleted ? "text-slate-500" : incoming ? "text-rose-700" : "text-emerald-700",
      dateLabel,
      timeLabel,
      details: deleted ? `${details} (ملغاة)` : details,
      searchText,
    });
  }

  for (const transfer of walletTransfers) {
    const amount = Number(transfer.amountDinar);
    const createdAt = transfer.createdAt;
    const fromName = transfer.fromCourier?.name ?? transfer.fromEmployee?.name ?? (transfer.fromKind === "admin" ? "أدمن" : "غير معروف");
    const toName = transfer.toCourier?.name ?? transfer.toEmployee?.name ?? (transfer.toKind === "admin" ? "أدمن" : "غير معروف");
    const typeLabel = `تحويل ${transfer.status === "accepted" ? "مقبول" : transfer.status === "rejected" ? "مرفوض" : "معلق"}`;
    const details = `من ${fromName} إلى ${toName}`;
    const dateLabel = formatYMDLocal(createdAt);
    const timeLabel = formatTime(createdAt);
    const searchText = [typeLabel, fromName, toName, details, transfer.status, dateLabel, timeLabel, String(amount)].join(" ").toLowerCase();

    rows.push({
      id: `wt:${transfer.id}`,
      source: "transfer",
      sourceLabel: "تحويلات",
      typeLabel,
      amountDinar: amount,
      courierName: fromName !== "أدمن" ? fromName : toName,
      partyName: details,
      kind: transfer.status,
      status: transfer.status,
      direction: "neutral",
      rowColorClass: "bg-sky-50",
      amountColorClass: "text-sky-700",
      dateLabel,
      timeLabel,
      details,
      searchText,
    });
  }

  const activeRows = rows.filter((row) => !row.deleted);
  const totalInvoices = activeRows.length;
  const deletedInvoices = rows.length - activeRows.length;
  const totalAmount = activeRows.reduce((sum, row) => sum + row.amountDinar, 0);

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/reports" className={ad.link}>
          ← التقارير
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>تقارير الفواتير</h1>
        <p className={`mt-3 ${ad.lead}`}>
          عرض جميع الفواتير المرتبطة بالطلبات، الإعطاء، الأخذ، والتحويلات في يوم واحد مع بحث سريع.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">اختر اليوم</h2>
          {dayList.map((day) => (
            <Link
              key={day}
              href={{
                pathname: "/admin/reports/invoices",
                query: {
                  day,
                  q: sp.q ? sp.q : undefined,
                },
              }}
              className={`block rounded-2xl px-4 py-3 text-sm font-bold transition-all ${day === selectedDayIso ? "bg-slate-900 text-white shadow-lg scale-[1.02]" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {day}
            </Link>
          ))}
        </div>

        <div className="space-y-5">
          <div className={`${ad.section} rounded-3xl border border-slate-200 bg-white p-6 shadow-sm`}> 
            <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto] lg:grid-cols-[220px_1fr_auto] items-end">
              <label className="flex flex-col gap-2">
                <span className={ad.label}>اليوم</span>
                <input
                  type="date"
                  name="day"
                  defaultValue={selectedDayIso}
                  className={ad.input}
                />
              </label>
              <button type="submit" className={ad.btnPrimary}>
                تحديث
              </button>
            </form>
          </div>

          <InvoiceReportSearch rows={rows} initialQuery={sp.q ?? ""} selectedDayIso={selectedDayIso} />
        </div>
      </div>
    </div>
  );
}
