import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializePrisma } from "@/lib/serialize-prisma";
import { getGlobalIcons } from "@/lib/icon-settings";
import { PriceClient } from "./price-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderPricingPage({ params }: Props) {
  const { orderId } = await params;

  // 1. جلب المسودات أولاً للتأكد إذا كان المعرف لمسودة تجهيز
  let draft = await prisma.companyPreparerShoppingDraft.findUnique({
    where: { id: orderId },
    include: {
      preparer: { select: { id: true, name: true } },
      customerRegion: { select: { id: true, name: true, deliveryPrice: true } }
    }
  });

  let order = null;
  let isDraft = false;
  let initialData = null;
  let orderNumber = "";
  let rawDeliveryPriceDinar: number | null = null;
  let orderSummary: string | null = null;

  if (draft) {
    isDraft = true;
    initialData = draft.data || {};
    orderNumber = draft.titleLine || "مسودة تجهيز";
    rawDeliveryPriceDinar = draft.customerRegion?.deliveryPrice != null ? Number(draft.customerRegion.deliveryPrice) : null;
  } else {
    // 2. إذا لم يكن مسودة، فهو بالتأكيد طلب حقيقي
    order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      notFound();
    }

    isDraft = false;
    initialData = order.preparerShoppingJson || {};
    orderNumber = order.orderNumber ? String(order.orderNumber) : "طلب عادي";
    rawDeliveryPriceDinar = order.deliveryPrice != null ? Number(order.deliveryPrice) : null;
    orderSummary = order.summary;
  }

  // 3. جلب البيانات المساعدة بالتوازي
  const [preparers, couriers, storeProducts, icons] = await Promise.all([
    prisma.companyPreparer.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.courier.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.storeProduct.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        salePrice: true,
        hasVariants: true,
        variants: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            salePrice: true,
          }
        }
      }
    }),
    getGlobalIcons()
  ]);

  // 4. تطهير البيانات وتمريرها للمكون العميل
  const safeInitialData = serializePrisma(initialData);
  const safePreparers = serializePrisma(preparers);
  const safeCouriers = serializePrisma(couriers);
  const safeStoreProducts = serializePrisma(storeProducts);
  const safeIcons = serializePrisma(icons);

  return (
    <PriceClient
      orderId={orderId}
      orderNumber={orderNumber}
      isDraft={isDraft}
      initialData={safeInitialData}
      preparers={safePreparers}
      couriers={safeCouriers}
      storeProducts={safeStoreProducts}
      icons={safeIcons}
      rawDeliveryPriceDinar={rawDeliveryPriceDinar}
      orderSummary={orderSummary}
    />
  );
}
