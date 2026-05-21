import Link from "next/link";
import { ad } from "@/lib/admin-ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقرير المحلات — أبو الأكبر للتوصيل",
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default function ShopsReportPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href={`${SECRET_ADMIN_PATH}/reports`} className={ad.link}>
          ← التقارير
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href={SECRET_ADMIN_PATH} className={ad.link}>
          الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>تقرير المحلات</h1>
        <p className={`mt-1 ${ad.lead}`}>
          هذا التقرير مُفرَّغ حالياً ليتم إعادة تنظيمه لاحقاً.
        </p>
      </div>
    </div>
  );
}
