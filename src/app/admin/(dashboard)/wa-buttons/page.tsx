import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { WaButtonsManager } from "./wa-buttons-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إعدادات واتساب — KSEBORDARSTOR",
};

export default async function WaButtonsPage() {
  const rows = await prisma.mandoubWaButtonSetting.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className={ad.h1}>إعدادات واتساب للمندوب</h1>
        <p className={ad.lead}>
          أنشئ أزراراً للمندوب (الظهور والحالات) ثم عرّف نصوص الرسائل من زر «النماذج». فتح واتساب
          للزبون فقط.
        </p>
      </div>

      <section className={ad.section}>
        <WaButtonsManager
          rows={rows.map((r) => ({
            id: r.id,
            name: r.name,
            label: r.label,
            iconKey: r.iconKey,
            templateText: r.templateText,
            statusesCsv: r.statusesCsv,
            visibilityScope: r.visibilityScope,
          customerLocationRule: r.customerLocationRule as
            | "any"
            | "exists"
            | "missing"
            | "courier_gps",
            isActive: r.isActive,
          }))}
        />
      </section>
    </div>
  );
}

