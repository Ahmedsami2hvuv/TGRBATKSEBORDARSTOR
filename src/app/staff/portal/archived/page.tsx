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

  // تجميع الطلبات المؤرشفة حسب الأيام (نفس كود الإدارة بالضبط)
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
            الطلبات المؤرشفة مجمعة حسب <strong className="text-sky-900">يوم الأرشفة</strong> (بتوقيت بغداد).
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">
            <p className="text-slate-600 font-bold">لا توجد طلبات مؤرشفة بعد.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => {
              const day = r.day;
              const cnt = Number(r.cnt);
              return (
                <li key={day}>
                  <Link
                    href={`/staff/portal/archived/${encodeURIComponent(day)}?${authQ}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-white px-5 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-50/80"
                  >
                    <span className="min-w-0 text-right leading-snug">{formatBaghdadDateLabel(day)}</span>
                    <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-900 tabular-nums">
                      {cnt}
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