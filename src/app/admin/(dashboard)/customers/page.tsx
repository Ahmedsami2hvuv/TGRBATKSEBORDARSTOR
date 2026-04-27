import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportCustomersButton } from "./import-customers-button";
import { ImageSyncButton } from "./image-sync-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const customersCount = await prisma.customer.count();

  // حساب عدد الصور التي تحتاج مزامنة (تبدأ بـ http ولا تحتوي على r2.dev)
  const pendingImagesCount = await prisma.customer.count({
    where: {
      customerDoorPhotoUrl: {
        contains: "http",
        not: { contains: "r2.dev" }
      }
    }
  });

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div className="flex justify-between items-start">
        <div>
          <h1 className={ad.h1}>بيانات الزبائن</h1>
          <p className={ad.lead}>إجمالي المسجلين: {customersCount.toLocaleString()}</p>
          {pendingImagesCount > 0 && (
            <p className="text-sm text-orange-600 font-bold mt-2 animate-pulse">
              ⚠️ يوجد {pendingImagesCount} صورة تحتاج للتأمين (نقل لـ R2)
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {pendingImagesCount > 0 && <ImageSyncButton pendingCount={pendingImagesCount} />}
          <ImportCustomersButton />
        </div>
      </div>

      <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-gray-300 shadow-sm">
        <div className="max-w-md mx-auto space-y-4">
          <div className="text-4xl">👥</div>
          <h2 className="text-xl font-bold text-gray-700">إدارة قاعدة بيانات الزبائن</h2>
          <p className="text-gray-500">
            يمكنك سحب البيانات من القاعدة القديمة ثم استخدام زر "تأمين الصور" لنقل صور الأبواب فعلياً إلى سيرفرك الجديد لضمان عدم ضياعها.
          </p>
        </div>
      </div>
    </div>
  );
}
