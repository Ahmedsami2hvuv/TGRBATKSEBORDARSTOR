import Link from "next/link";
import { ad } from "@/lib/admin-ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير عام — معاملات المحافظ — أبو الأكبر للتوصيل",
};

export default function GeneralWalletReportPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/reports" className={ad.link}>
          ← التقارير
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin" className={ad.link}>
          الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>تقرير عام — معاملات المحافظ</h1>
        <p className={`mt-1 ${ad.lead}`}>
          هذا التقرير مُفرَّغ حالياً ليتم إعادة تنظيمه لاحقاً.
        </p>
      </div>
    </div>
  );
}
