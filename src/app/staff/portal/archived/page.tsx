import Link from "next/link";
import { Prisma } from "@prisma/client";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { formatBaghdadDateLabel } from "@/lib/baghdad-archived-day";

export const dynamic = "force-dynamic";

export default async function StaffArchivedDaysPage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  let activeDays: Array<{ day: string; cnt: number }> = [];

  try {
    const rows = await prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>(
      Prisma.sql`
        SELECT
          to_char(
            (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Baghdad')::date,
            'YYYY-MM-DD'
          ) AS day,
          COUNT(DISTINCT RIGHT(regexp_replace(o."customerPhone", '\D', '', 'g'), 9))::bigint AS cnt
        FROM "Order" o
        LEFT JOIN "Customer" c ON o."customerId" = c."id"
        WHERE o.status = 'archived'
          AND o."createdAt" IS NOT NULL
          AND o."customerPhone" IS NOT NULL
          AND length(regexp_replace(o."customerPhone", '\D', '', 'g')) >= 8
          AND (o."adminOrderCode" IS NULL OR o."adminOrderCode" NOT LIKE '%RATING_REQUESTED%')
          AND (
            (
              (o."customerLocationUrl" IS NULL OR trim(o."customerLocationUrl") = '')
              AND (c."customerLocationUrl" IS NULL OR trim(c."customerLocationUrl") = '')
            )
            OR o."customerLocationSetByCourierAt" IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM "Order" ro
            WHERE ro."adminOrderCode" LIKE '%RATING_REQUESTED%'
              AND (
                (ro."customerPhone" IS NOT NULL AND length(regexp_replace(ro."customerPhone", '\D', '', 'g')) >= 8 AND RIGHT(regexp_replace(ro."customerPhone", '\D', '', 'g'), 9) = RIGHT(regexp_replace(o."customerPhone", '\D', '', 'g'), 9))
                OR (ro."secondCustomerPhone" IS NOT NULL AND length(regexp_replace(ro."secondCustomerPhone", '\D', '', 'g')) >= 8 AND RIGHT(regexp_replace(ro."secondCustomerPhone", '\D', '', 'g'), 9) = RIGHT(regexp_replace(o."customerPhone", '\D', '', 'g'), 9))
                OR (ro."alternatePhone" IS NOT NULL AND length(regexp_replace(ro."alternatePhone", '\D', '', 'g')) >= 8 AND RIGHT(regexp_replace(ro."alternatePhone", '\D', '', 'g'), 9) = RIGHT(regexp_replace(o."customerPhone", '\D', '', 'g'), 9))
              )
          )
        GROUP BY 1
        HAVING COUNT(DISTINCT RIGHT(regexp_replace(o."customerPhone", '\D', '', 'g'), 9)) > 0
        ORDER BY 1 DESC
      `,
    );

    activeDays = rows.map((r) => ({
      day: r.day,
      cnt: Number(r.cnt),
    }));
  } catch (err) {
    console.error("Error loading staff archived days:", err);
  }

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 text-slate-800" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <p className="text-sm">
          <Link href={`/staff/portal?${authQ}`} className="font-bold text-sky-700 hover:underline">
            ← الرجوع إلى البوابة
          </Link>
        </p>

        <div>
          <h1 className="text-2xl font-black text-slate-900">الطلبات المؤرشفة</h1>
          <p className="mt-2 text-sm text-slate-600">
            أيام الطلبات المؤرشفة التي تحتوي على <strong className="text-sky-900">زبائن بانتظار إرسال التقييم</strong> (تختفي الأيام المكتملة تلقائياً).
          </p>
        </div>

        {activeDays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 p-12 text-center space-y-3">
            <span className="text-4xl block">🎉</span>
            <p className="text-slate-900 font-black text-lg">اكتملت جميع طلبات التقييم بنجاح!</p>
            <p className="text-emerald-800 font-bold text-sm">تم إرسال طلب التقييم لكافة الزبائن في جميع الأيام المؤرشفة ولا توجد أي أيام متبقية.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeDays.map((r) => {
              const day = r.day;
              const cnt = r.cnt;
              return (
                <li key={day}>
                  <Link
                    href={`/staff/portal/archived/${encodeURIComponent(day)}?${authQ}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-white px-5 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-50/80 hover:shadow-md"
                  >
                    <span className="min-w-0 text-right leading-snug">{formatBaghdadDateLabel(day)}</span>
                    <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-900 tabular-nums">
                      {cnt} طلب
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}