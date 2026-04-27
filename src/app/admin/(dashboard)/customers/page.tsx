import Link from "next/link";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportCustomersButton } from "./import-customers-button";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const totalItems = await prisma.customerPhoneProfile.count();

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={ad.h1}>بيانات الزبائن</h1>
          <p className={ad.lead}>إجمالي المسجلين: {totalItems.toLocaleString()}</p>
        </div>
        <ImportCustomersButton />
      </div>

      <div className="bg-white p-8 text-center rounded-lg border border-dashed border-gray-300">
        <p className="text-gray-500 italic">استخدم زر الاستيراد أعلاه لسحب بيانات الزبائن من القاعدة القديمة.</p>
      </div>
    </div>
  );
}
