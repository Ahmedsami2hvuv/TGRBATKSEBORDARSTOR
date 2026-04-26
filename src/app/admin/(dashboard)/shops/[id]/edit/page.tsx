import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ShopEditForm } from "./edit-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditShopPage({ params }: Props) {
  const { id } = await params;
  const [shop, regions] = await Promise.all([
    prisma.shop.findUnique({ where: { id } }),
    prisma.region.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!shop) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin/shops" className={ad.link}>
          ← العودة للمحلات
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>تعديل المحل</h1>
        <p className={`mt-1 ${ad.lead}`}>{shop.name}</p>
      </div>
      <section className={ad.section}>
        <p className={`text-sm ${ad.muted}`}>
          <strong className="text-sky-800">رابط إدخال الطلب للعميل</strong> لا يُنشأ من
          هنا — لكل موظف رابط خاص من صفحة{" "}
          <Link href={`/admin/shops/${shop.id}/employees`} className={ad.link}>
            موظفو المحل
          </Link>
          . رابط <strong className="text-amber-800">المندوب</strong> يُرسل من نفس
          الصفحة مع واتساب.
        </p>
        <div className="mt-6">
          <ShopEditForm
            id={shop.id}
            defaultName={shop.name}
            defaultOwnerName={shop.ownerName}
            defaultPhotoUrl={shop.photoUrl}
            defaultPhone={shop.phone}
            defaultUrl={shop.locationUrl}
            defaultRegionId={shop.regionId}
            regions={regions.map((r) => ({ id: r.id, name: r.name }))}
          />
        </div>
      </section>
    </div>
  );
}
