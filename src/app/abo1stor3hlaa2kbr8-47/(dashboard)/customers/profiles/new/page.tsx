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
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/abo1stor3hlaa2kbr8-47/customers" className={ad.link}>
          ← رجوع لبيانات الزبائن
        </Link>
        <Link href="/abo1stor3hlaa2kbr8-47/customers/profiles/import-legacy-kse" className={ad.link}>
          استيراد دفعي من طلبات الموقع القديم (KSE)
        </Link>
      </div>

      <div className={`${ad.section} max-w-2xl mx-auto shadow-lg border-t-4 border-sky-500`}>
        <CustomerProfileUpsertForm regions={regionOptions} />
      </div>

      <div className="text-center text-xs text-slate-400">
        سيتم تحديث البيانات تلقائياً إذا كان الرقم مسجلاً مسبقاً في نفس المنطقة.
      </div>
    </div>
  );
}
