import type { ReactNode } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";

export const metadata = {
  title: "نظام التقارير — أبو الأكبر للتوصيل",
};

type Props = {
  children: ReactNode;
};

export default async function ReportsLayout({ children }: Props) {

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
          اختر أحد التقارير أدناه للحصول على بيانات اليوم أو تاريخ مخصص. التقارير تعرض تفاصيل الطلبات، المنتجات، الأسعار، والأرباح.
        </p>
      </div>
      <div>{children}</div>
    </div>
  );
}
