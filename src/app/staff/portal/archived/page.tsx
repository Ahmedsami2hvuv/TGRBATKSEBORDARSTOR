import Link from "next/link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { formatBaghdadDateLabel } from "@/lib/baghdad-archived-day";

export const dynamic = "force-dynamic";

function getBaghdadYmd(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

export default async function StaffArchivedDaysPage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  // 1. جلب كافة أرقام الهواتف المقيمة تاريخياً في كامل قاعدة البيانات
  const allRatedOrders = await prisma.order.findMany({
    where: {
      adminOrderCode: { contains: "RATING_REQUESTED" },
      customerPhone: { not: "" }
    },
    select: { customerPhone: true, secondCustomerPhone: true, alternatePhone: true }
  });

  const ratedLast9Set = new Set<string>();
  for (const ro of allRatedOrders) {
    for (const p of [ro.customerPhone, ro.secondCustomerPhone, ro.alternatePhone]) {
      if (p) {
        const d = p.replace(/\D/g, "");
        if (d.length >= 8) {
          ratedLast9Set.add(d.slice(-9));
        }
      }
    }
  }

  // 2. جلب الطلبات المؤرشفة النشطة غير المقيمة
  const archivedOrders = await prisma.order.findMany({
    where: {
      status: "archived",
      createdAt: { not: null },
      NOT: {
        adminOrderCode: { contains: "RATING_REQUESTED" }
      },
      customerPhone: { not: "" }
    },
    select: {
      id: true,
      createdAt: true,
      customerPhone: true,
      customerLocationUrl: true,
      customerLocationSetByCourierAt: true,
      customer: {
        select: {
          customerLocationUrl: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  // 3. تجميع الأيام وحساب الزبائن المتبقين بدقة (استبعاد المقيمين والمكررين ومن لديهم موقع مرفوع مسبقاً)
  const dayPendingCountMap = new Map<string, number>();
  const daySeenPhonesMap = new Map<string, Set<string>>();

  for (const o of archivedOrders) {
    if (!o.createdAt) continue;

    const hasCustomerLoc = !!(o.customerLocationUrl || o.customer?.customerLocationUrl);
    const hasCourierLoc = Boolean(o.customerLocationSetByCourierAt);

    // إذا كان للزبون موقع مسبقاً ولم يرفعه المندوب، لا يحتاج تقييم
    if (hasCustomerLoc && !hasCourierLoc) {
      continue;
    }

    const pDigits = (o.customerPhone || "").replace(/\D/g, "");
    if (pDigits.length < 8) continue;
    const last9 = pDigits.slice(-9);

    // إذا كان الرقم مقيماً مسبقاً تاريخياً، نستبعده
    if (ratedLast9Set.has(last9)) {
      continue;
    }

    const dayYmd = getBaghdadYmd(new Date(o.createdAt));

    let seenSet = daySeenPhonesMap.get(dayYmd);
    if (!seenSet) {
      seenSet = new Set<string>();
      daySeenPhonesMap.set(dayYmd, seenSet);
    }

    // منع تكرار نفس رقم الزبون في نفس اليوم
    if (seenSet.has(last9)) {
      continue;
    }
    seenSet.add(last9);

    dayPendingCountMap.set(dayYmd, (dayPendingCountMap.get(dayYmd) || 0) + 1);
  }

  // 4. إخفاء أي يوم مكتمل (عدد زبائنه المتبقين = 0) والاحتفاظ فقط بالأيام التي تحتوي على زبائن بانتظار التقييم
  const activeDays = Array.from(dayPendingCountMap.entries())
    .filter(([_, cnt]) => cnt > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, cnt]) => ({ day, cnt }));

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