import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AdminPreparationClient } from "./admin-preparation-client";

export const dynamic = "force-dynamic";

export default async function AdminNewPreparationDraftPage() {
  const companyPreparers = await prisma.companyPreparer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true, availableForAssignment: true },
  });

  const preparersList = companyPreparers.map((p) => ({
    id: p.id,
    name: p.name,
    available: p.active && p.availableForAssignment,
  }));

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/orders/pending" className={ad.link}>
          ← الطلبات الجديدة
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>إضافة طلب للتجهيز</h1>
        <p className={`mt-1 ${ad.lead}`}>
          الصق رسالة تحتوي تفاصيل الطلب (عنوان الزبون، رقم الهاتف، المنتجات، الكمية، الملاحظات) ليتم تحليلها وإرسالها كمسودة للمجهزين.
        </p>
      </div>

      <div className="mx-auto max-w-4xl pt-4">
        <AdminPreparationClient preparers={preparersList} />
      </div>
    </div>
  );
}
