import Link from "next/link";
import { ad } from "@/lib/admin-ui";

export const metadata = {
  title: "نظام التقارير — تحت المراجعة",
};

export default function ReportsPlaceholderPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>نظام التقارير مغلق مؤقتاً</h1>
        <p className={`mt-3 ${ad.lead}`}>
          تم تفريغ قسم التقارير الحالي ليُعاد تنظيمه لاحقاً. لا توجد بيانات أو روابط للتقارير في هذه الصفحة حالياً.
        </p>
      </div>
    </div>
  );
}
