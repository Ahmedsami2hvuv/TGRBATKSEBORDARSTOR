import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportRegionsButton } from "./import-button";

export const dynamic = "force-dynamic";

export default async function AdminRegionsPage() {
  const regions = await prisma.region.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>

      <div className="flex justify-between items-center">
        <div>
          <h1 className={ad.h1}>المناطق</h1>
          <p className={ad.lead}>إدارة مناطق التوصيل وأسعارها.</p>
        </div>
        {/* الزر الذكي هنا */}
        <ImportRegionsButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((region) => (
          <div key={region.id} className={ad.card}>
            <h3 className="font-bold text-lg">{region.name}</h3>
            <p className="text-gray-600">سعر التوصيل: {region.deliveryPrice.toLocaleString()} د.ع</p>
          </div>
        ))}
      </div>

      {regions.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-500">لا توجد مناطق حالياً. استخدم زر الاستيراد أعلاه لسحب البيانات.</p>
        </div>
      )}
    </div>
  );
}
