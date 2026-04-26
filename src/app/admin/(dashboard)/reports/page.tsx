import Link from "next/link";
import { ad } from "@/lib/admin-ui";

export const metadata = {
  title: "نظام التقارير — أبو الأكبر للتوصيل",
};

export default function ReportsHubPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>نظام التقارير</h1>
        <p className={`mt-3 ${ad.lead}`}>
          جميع تقارير التجهيز الحالية مجمعة في خانة تقرير التجهيز. يمكن لاحقاً إضافة أقسام جديدة للتقارير مثل تقرير المندوبين وغيرها.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/reports/preparation"
          className="group block cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
          role="button"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">تقارير التجهيز اليومية</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                عرض أيام التقرير العام مرتبة يومًا يومًا، مع تفاصيل تقرير التجهيز لكل يوم.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-2xl text-white shadow-lg">
              →
            </div>
          </div>
        </Link>

        <Link
          href="/admin/reports/invoices"
          className="group block cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
          role="button"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">تقارير الفواتير</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                عرض الفواتير اليومية للطلبات، الإعطاء، الأخذ والتحويلات مع بحث سريع في نفس اليوم.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-2xl text-white shadow-lg">
              🧾
            </div>
          </div>
        </Link>

        <Link
          href="/admin/reports/couriers"
          className="group block cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
          role="button"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">أرباح المندوبين</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                جدول أرباح المندوبين اليومي مع صافي الشركة بعد خصم الإكراميات.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-2xl text-white shadow-lg">
              💰
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
