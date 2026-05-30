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
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className={ad.h1}>الطلبات المؤرشفة</h1>
          <p className={ad.lead}>
            ابحث عن طلب مؤرشف برقم الطلب أو الهاتف، أو تصفح حسب يوم الأرشفة.
          </p>
        </div>

        <form className="relative flex-1 max-w-md w-full group">
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            name="q"
            defaultValue={q}
            placeholder="بحث سريع في الأرشيف (رقم طلب أو هاتف)..."
            className={`${ad.input} w-full pr-11`}
          />
        </form>
      </div>

      {q ? (
        <section className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <h2 className={ad.h2}>نتائج البحث في الأرشيف ({searchResults.length})</h2>
          {searchResults.length === 0 ? (
            <div className={ad.section}>
              <p className="text-center text-slate-500 font-medium py-4">لم يتم العثور على طلبات مؤرشفة تطابق "{q}"</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {searchResults.map((o) => (
                <Link
                  key={o.id}
                  href={`${SECRET_ADMIN_PATH}/orders/${o.id}`}
                  className={`${ad.card} group flex items-center justify-between gap-4 p-4 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-indigo-600 tabular-nums">#{o.orderNumber}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="font-bold text-slate-900 truncate">{o.shop.name}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 truncate">
                      {o.customerPhone} <span className="mx-1 text-slate-300">•</span> {o.summary?.slice(0, 60)}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">أُرشف في</p>
                    <p className="text-sm font-black text-slate-700 tabular-nums">
                      {o.archivedAt ? new Date(o.archivedAt).toLocaleDateString("ar-IQ") : "—"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="pt-4 border-t border-slate-100">
            <h2 className={ad.h2}>تصفح حسب اليوم</h2>
          </div>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div className={`${ad.section} border-dashed border-indigo-200 bg-indigo-50/30 flex flex-col items-center justify-center py-12`}>
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="font-bold text-slate-600">لا توجد طلبات مؤرشفة بعد.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((r) => {
            const day = r.day;
            const cnt = Number(r.cnt);
            return (
              <li key={day}>
                <Link
                  href={`${SECRET_ADMIN_PATH}/orders/archived/${encodeURIComponent(day)}`}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="min-w-0">
                    <span className="block text-sm font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">
                      {formatBaghdadDateLabel(day)}
                    </span>
                  </div>
                  <span className="shrink-0 flex items-center justify-center min-w-[2.5rem] h-8 rounded-xl bg-slate-100 px-2 text-xs font-black text-slate-700 tabular-nums group-hover:bg-indigo-600 group-hover:text-white transition-all">
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
