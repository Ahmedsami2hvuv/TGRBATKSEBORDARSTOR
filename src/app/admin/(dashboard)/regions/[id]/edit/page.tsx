import Link from "next/link";
import { notFound } from "next/navigation";
import { dinarDecimalToAlfInputString } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { RegionEditForm } from "./edit-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditRegionPage({ params }: Props) {
  const { id } = await params;
  const region = await prisma.region.findUnique({ where: { id } });
  if (!region) {
    notFound();
  }

  const priceStr = dinarDecimalToAlfInputString(region.deliveryPrice);

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin/regions" className={ad.link}>
          ← العودة للمناطق
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>تعديل المنطقة</h1>
        <p className={`mt-1 ${ad.lead}`}>{region.name}</p>
      </div>
      <section className={ad.section}>
        <RegionEditForm
          id={region.id}
          defaultName={region.name}
          defaultPrice={priceStr}
        />
      </section>
    </div>
  );
}
