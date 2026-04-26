import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { CourierForm } from "../courier-form";

export const metadata = {
  title: "مندوب جديد — أبو الأكبر للتوصيل",
};

export default function NewCourierPage() {
  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin/couriers" className={ad.link}>
          ← المندوبين
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>إضافة مندوب توصيل</h1>
        <p className={`mt-1 ${ad.lead}`}>
          المندوبون <strong className="text-amber-800">لا يُضافون من صفحة المحل</strong> —
          كيان مستقل عن موظفي رفع الطلبات للزبائن.
        </p>
      </div>
      <section className={ad.section}>
        <CourierForm />
      </section>
    </div>
  );
}
