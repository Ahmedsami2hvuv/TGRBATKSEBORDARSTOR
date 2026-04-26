import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { CustomerProfileEditForm } from "../../customer-profile-edit-form";
import { CustomerProfileDeleteForm } from "../../customer-profile-delete-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تعديل تفاصيل زبون — أبو الأكبر للتوصيل",
};

export default async function EditCustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, regions] = await Promise.all([
    prisma.customerPhoneProfile.findUnique({
      where: { id },
    }),
    prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!profile) {
    notFound();
  }

  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin/customers/profiles" className={ad.link}>
          ← تفاصيل الزبائن المرجعية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>تعديل تفاصيل الزبون</h1>
        <p className={`mt-1 ${ad.lead}`}>
          الرقم ثابت؛ يمكنك تغيير المنطقة، اللوكيشن، الملاحظات، والصورة.
        </p>
      </div>
      <section className={ad.section}>
        <CustomerProfileEditForm
          profileId={profile.id}
          defaultPhone={profile.phone}
          defaultRegionId={profile.regionId}
          defaultLocationUrl={profile.locationUrl}
          defaultLandmark={profile.landmark}
          defaultAlternatePhone={profile.alternatePhone ?? ""}
          defaultNotes={profile.notes}
          defaultPhotoUrl={profile.photoUrl}
          regions={regionOptions}
        />
        <CustomerProfileDeleteForm id={profile.id} />
      </section>
    </div>
  );
}
