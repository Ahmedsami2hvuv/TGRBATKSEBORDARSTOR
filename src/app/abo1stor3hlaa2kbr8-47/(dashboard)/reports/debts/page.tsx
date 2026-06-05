import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { AdminDebtsWidget } from "../../admin-debts-widget";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export const metadata = {
  title: "ديون المحلات — أبو الأكبر للتوصيل",
};

export default function DebtsReportPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
          ← التقارير
        </Link>
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={ad.h1}>إدارة ديون المحلات</h1>
          <p className={`mt-3 ${ad.lead}`}>
            متابعة المبالغ المعلقة التي بذمة المجهزين للمحلات وتسديدها.
          </p>
        </div>
        <Link
          href={`${SECRET_ADMIN_PATH}/preparers`}
          className="shrink-0 rounded-2xl bg-white border border-slate-200 px-5 py-3 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 max-w-fit active:scale-95"
        >
          <span>👤</span>
          تفاصيل الديون حسب المجهز
        </Link>
      </div>

      <div className="max-w-4xl">
        <AdminDebtsWidget inline={true} />
      </div>
    </div>
  );
}
