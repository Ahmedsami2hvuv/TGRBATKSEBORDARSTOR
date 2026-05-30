import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatBaghdadDateLabel } from "@/lib/baghdad-archived-day";

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
    const where: Prisma.OrderWhereInput = {
      status: "archived",
    };
    const asNum = parseInt(q, 10);
    if (!Number.isNaN(asNum) && String(asNum) === q) {
      where.orderNumber = asNum;
    } else {
      where.OR = [
        { customerPhone: { contains: q } },
        { shop: { name: { contains: q, mode: "insensitive" } } },
        { summary: { contains: q, mode: "insensitive" } },
      ];
    }

    searchResults = await prisma.order.findMany({
      where,
      take: 50,
      orderBy: { archivedAt: "desc" },
      include: { shop: { select: { name: true } } },
    });
  }

  const rows = await prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>(
    Prisma.sql`
      SELECT
        to_char(
          (o."archivedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Baghdad')::date,
          'YYYY-MM-DD'
        ) AS day,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      WHERE o.status = 'archived'
        AND o."archivedAt" IS NOT NULL
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
            ابحث عن طلب مؤرشف برقم الطلب أو الهاتف، أو تصفح حسب يوم الأرشفة.
          </p>
        </div>

        <form className="flex-1 max-w-md w-full">
          <input
            name="q"
            defaultValue={q}
            placeholder="بحث سريع في الأرشيف (رقم طلب أو هاتف)..."
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
