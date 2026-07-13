import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { WaButtonDetailClient } from "./wa-button-detail-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تعديل زر واتساب — KSEBORDARSTOR",
};

export default async function WaButtonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const row = await prisma.mandoubWaButtonSetting.findUnique({
    where: { id },
  });

  if (!row) {
    notFound();
  }

  return (
    <WaButtonDetailClient
      row={{
        id: row.id,
        name: row.name,
        label: row.label,
        iconKey: row.iconKey,
        templateText: row.templateText,
        statusesCsv: row.statusesCsv,
        visibilityScope: row.visibilityScope,
        customerLocationRule: row.customerLocationRule,
        isActive: row.isActive,
        recipient: row.recipient,
      }}
    />
  );
}
