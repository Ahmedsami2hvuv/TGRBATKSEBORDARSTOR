import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { CourierEditForm } from "./courier-edit-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditCourierPage({ params }: Props) {
  const { id } = await params;
  const courier = await prisma.courier.findUnique({ where: { id } });
  if (!courier) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin/couriers" className={ad.link}>
          ← المندوبين
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>تعديل مندوب</h1>
      </div>
      <section className={ad.section}>
        <CourierEditForm
          courierId={courier.id}
          defaultName={courier.name}
          defaultPhone={courier.phone}
          defaultTelegramUserId={courier.telegramUserId ?? ""}
          defaultVehicleType={courier.vehicleType === "bike" ? "bike" : "car"}
          defaultHiddenFromReports={courier.hiddenFromReports}
          defaultBlocked={courier.blocked}
          lastMandoubTotalsResetLabel={
            courier.mandoubTotalsResetAt
              ? courier.mandoubTotalsResetAt.toLocaleString("ar-IQ-u-nu-latn", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : null
          }
          mandoubWalletCarryOverLabel={formatDinarAsAlfWithUnit(
            courier.mandoubWalletCarryOverDinar,
          )}
        />
      </section>
    </div>
  );
}
