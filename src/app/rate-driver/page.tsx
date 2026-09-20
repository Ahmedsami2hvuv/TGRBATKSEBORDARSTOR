import React from "react";
import { prisma } from "@/lib/prisma";
import { RateDriverClient } from "./rate-driver-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقييم مندوب التوصيل — رأيك يهمنا",
  description: "تقييم خدمة توصيل الطلب وأسلوب المندوب وسرعة الوصول",
};

interface Props {
  searchParams: Promise<{
    order?: string;
    o?: string;
  }>;
}

export default async function RateDriverPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const orderParam = resolvedSearchParams.order || resolvedSearchParams.o || "";

  if (!orderParam) {
    return <RateDriverClient orderData={null} />;
  }

  const orderNum = parseInt(orderParam, 10);
  const isNum = !isNaN(orderNum) && String(orderNum) === orderParam.trim();

  let order: any = null;
  try {
    order = await prisma.order.findFirst({
      where: isNum
        ? { OR: [{ id: orderParam }, { orderNumber: orderNum }] }
        : { id: orderParam },
      select: {
        id: true,
        orderNumber: true,
        customerPhone: true,
        customerLandmark: true,
        customerRegion: {
          select: { name: true },
        },
        shop: {
          select: { id: true, name: true, phone: true },
        },
        courier: {
          select: { id: true, name: true, phone: true },
        },
      },
    });
  } catch (err) {
    console.error("RateDriverPage find order error:", err);
  }

  if (!order) {
    return <RateDriverClient orderData={null} />;
  }

  const orderData = {
    id: order.id,
    orderNumber: order.orderNumber,
    customerPhone: order.customerPhone,
    customerRegion: order.customerRegion?.name || "منطقتكم الكريمة",
    customerLandmark: order.customerLandmark || "",
    shopName: order.shop?.name || "المتجر",
    courierId: order.courier?.id || null,
    courierName: order.courier?.name || "مندوب التوصيل",
  };

  // دائماً نفتح النموذج — الزبون يقدر يقيم في أي وقت بدون قيود
  return (
    <RateDriverClient
      orderData={orderData}
      alreadyRated={false}
    />
  );
}

