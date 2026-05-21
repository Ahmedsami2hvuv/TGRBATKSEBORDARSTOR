import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "سجل أرباح المندوبين — أبو الأكبر للتوصيل",
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default async function CouriersHistoryReportPage() {
  const histories = await prisma.courierProfitHistory.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      courier: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
          ← التقارير
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>سجل أرباح المندوبين (بعد التصفير)</h1>
        <p className={`mt-3 ${ad.lead}`}>
          يتم هنا حفظ أرباح المندوبين وعدد طلباتهم في كل مرة يتم فيها تصفير حسابات المندوب من قبل الإدارة. هذا السجل مفيد للتقارير الشهرية ولحفظ الحقوق.
        </p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[48rem] text-right text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3 text-right">المندوب</th>
              <th className="px-4 py-3 text-center">الفترة من</th>
              <th className="px-4 py-3 text-center">الفترة إلى (وقت التصفير)</th>
              <th className="px-4 py-3 text-center">عدد الطلبات</th>
              <th className="px-4 py-3 text-center">إجمالي الأرباح المستحقة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {histories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  لا يوجد سجل تصفير حتى الآن.
                </td>
              </tr>
            ) : (
              histories.map((row) => (
                <tr key={row.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{row.courier?.name || "مندوب محذوف"}</td>
                  <td className="px-4 py-3 text-center text-slate-600" dir="ltr">{formatBaghdadDateTime(row.periodStartAt)}</td>
                  <td className="px-4 py-3 text-center text-slate-600 font-bold" dir="ltr">{formatBaghdadDateTime(row.periodEndAt)}</td>
                  <td className="px-4 py-3 text-center text-slate-700 font-bold">{row.totalOrders}</td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-600">{formatDinarAsAlfWithUnit(row.totalProfitDinar)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
