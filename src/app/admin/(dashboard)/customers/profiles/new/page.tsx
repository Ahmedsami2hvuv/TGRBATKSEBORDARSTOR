import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { CustomerProfileUpsertForm } from "../customer-profile-upsert-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إضافة زبون مرجعي جديد — أبو الأكبر للتوصيل",
};

export default async function NewCustomerProfilePage() {
  const regions = await prisma.region.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/customers" className={ad.link}>
          ← رجوع لبيانات الزبائن
        </Link>
      </div>

      <div className={`${ad.section} max-w-2xl mx-auto shadow-lg border-t-4 border-sky-500`}>
        <div className="mb-6 border-b border-slate-100 pb-4">
          <h1 className={ad.h1}>إضافة زبون مرجعي جديد</h1>
          <p className="mt-2 text-sm text-slate-500">
            ألصق رسالة الزبون كاملة ثم أرفق صورة الباب واضغط حفظ. سيحفظ النظام البيانات تلقائياً من النص.
          </p>
        </div>

        <CustomerProfileUpsertForm regions={regionOptions} />
      </div>

      <div className="text-center text-xs text-slate-400">
        سيتم تحديث البيانات تلقائياً إذا كان الرقم مسجلاً مسبقاً في نفس المنطقة.
      </div>
    </div>
  );
}
