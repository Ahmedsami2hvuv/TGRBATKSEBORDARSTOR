import { Metadata } from "next";
import { getOrderCardsDesignerConfig } from "@/lib/order-card-customizer";
import { prisma } from "@/lib/prisma";
import { OrderCardsDesignerClient } from "./order-cards-designer-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "استوديو تصميم كروت الطلبات والأزرار | أبو الأكبر",
};

export default async function OrderCardsDesignerPage() {
  const [config, waButtons] = await Promise.all([
    getOrderCardsDesignerConfig(),
    prisma.mandoubWaButtonSetting.findMany({
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 max-w-6xl">
      <OrderCardsDesignerClient
        initialConfig={config}
        waButtons={waButtons}
      />
    </div>
  );
}
