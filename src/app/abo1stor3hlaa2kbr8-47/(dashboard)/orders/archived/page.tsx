import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatBaghdadDateLabel } from "@/lib/baghdad-archived-day";
import { normalizeArabicSearchText } from "@/lib/region-name-normalize";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الطلبات المؤرشفة — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ArchivedOrdersIndexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  // إذا كان هناك بحث، نأتي بالطلبات مباشرة بدل الأيام
  let searchResults: any[] = [];
  if (q) {
    const qNorm = normalizeArabicSearchText(q);
    const asNum = parseInt(q, 10);
    const isNum = !Number.isNaN(asNum) && String(asNum) === q;

    const candidateOrders = await prisma.order.findMany({
      where: { status: "archived" },
      take: 300,
      orderBy: { archivedAt: "desc" },
      include: {
        shop: { include: { region: true } },
        customerRegion: true,
        secondCustomerRegion: true,
        courier: true,
        customer: true,
      },
    });

    searchResults = candidateOrders
      .filter((o) => {
        if (isNum && o.orderNumber === asNum) return true;

        const searchableParts = [
          o.customerRegion?.name || "",
          o.secondCustomerRegion?.name || "",
          o.shop?.region?.name || "",
          o.shop?.name || "",
          o.courier?.name || "",
          o.customer?.name || "",
          o.customerPhone || "",
          o.alternatePhone || "",
          o.secondCustomerPhone || "",
          o.customerLandmark || "",
          o.secondCustomerLandmark || "",
          o.summary || "",
          o.orderType || "",
          o.orderNoteTime || "",
          String(o.orderNumber),
        ];

        const combinedText = searchableParts.join(" ");
        return normalizeArabicSearchText(combinedText).includes(qNorm);
      })
      .slice(0, 50);
  }

  const rows = await prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>(
    Prisma.sql`
      SELECT
        to_char(
          (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Baghdad')::date,
          'YYYY-MM-DD'
        ) AS day,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      WHERE o.status = 'archived'
        AND o."createdAt" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 DESC
    `,
  );

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href={SECRET_ADMIN_PATH} className={ad.link}>
          ← الرئيسية
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href={`${SECRET_ADMIN_PATH}/orders/tracking`} className={ad.link}>
          تتبع الطلبات
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={ad.h1}>الطلبات المؤرشفة</h1>
          <p className={`mt-1 ${ad.lead}`}>
            ابحث عن طلب مؤرشف بـ (المنطقة، المحل، المندوب، رقم الطلب، الهاتف) أو تصفح حسب اليوم.
          </p>
        </div>

        <form className="flex-1 max-w-md w-full">
          <input
            name="q"
            defaultValue={q}
            placeholder="بحث سريع في الأرشيف (منطقة، محل، رقم طلب، هاتف)..."
            className={ad.input}
          />
        </form>
      </div>

      {q ? (
        <section className="space-y-3">
          <h2 className={ad.h2}>نتائج البحث في الأرشيف ({searchResults.length})</h2>
          {searchResults.length === 0 ? (
            <div className={ad.section}>
              <p className="text-center text-slate-500">لم يتم العثور على طلبات مؤرشفة تطابق "{q}"</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {searchResults.map((o) => (
                <Link
                  key={o.id}
                  href={`${SECRET_ADMIN_PATH}/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-sky-200 bg-white p-4 shadow-sm hover:bg-sky-50"
                >
                  <div>
                    <span className="font-black text-sky-700">#{o.orderNumber}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="font-bold text-slate-800">{o.shop.name}</span>
                    <p className="text-xs text-slate-500">{o.customerPhone} — {o.summary?.slice(0, 50)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-slate-400">أُرشف في:</p>
                    <p className="text-xs font-bold text-slate-600">
                      {o.archivedAt ? new Date(o.archivedAt).toLocaleDateString("ar-IQ") : "—"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <hr className="my-6 border-slate-200" />
          <h2 className={ad.h2}>تصفح حسب اليوم</h2>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div className={`${ad.section} border-dashed border-violet-200 bg-violet-50/40`}>
          <p className="text-center text-slate-600">لا توجد طلبات مؤرشفة بعد.</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const day = r.day;
            const cnt = Number(r.cnt);
            return (
              <li key={day}>
                <Link
                  href={`${SECRET_ADMIN_PATH}/orders/archived/${encodeURIComponent(day)}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-50/80"
                >
                  <span className="min-w-0 text-right leading-snug">{formatBaghdadDateLabel(day)}</span>
                  <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-extrabold text-violet-900 tabular-nums">
                    {cnt}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
