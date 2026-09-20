import React from "react";
import { prisma } from "@/lib/prisma";
import { ClientFeedbacksView } from "./client-feedbacks-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "التقييمات — لوحة الإدارة",
  description: "تقييمات العملاء والأكشاك وتقييمات المندوبين من قبل الزبائن",
};

export default async function ClientFeedbacksPage() {
  // 1. جلب تقييمات العملاء (أصحاب الأكشاك)
  let clientFeedbacks: any[] = [];
  try {
    clientFeedbacks = await prisma.clientFeedback.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        shop: {
          select: { id: true, name: true, phone: true, photoUrl: true, region: { select: { name: true } } },
        },
      },
      take: 200,
    });
  } catch (err) {
    console.error("Failed to load clientFeedbacks:", err);
  }

  // 2. جلب تقييمات الزبائن للمندوبين
  let driverRatings: any[] = [];
  try {
    driverRatings = await (prisma as any).driverRating.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            deliveryPrice: true,
            createdAt: true,
            customerLocationUrl: true,
            shop: { select: { id: true, name: true, phone: true } },
            courier: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      take: 300,
    });
  } catch (err) {
    console.error("Failed to load driverRatings:", err);
  }

  return (
    <ClientFeedbacksView
      initialClientFeedbacks={JSON.parse(JSON.stringify(clientFeedbacks))}
      initialDriverRatings={JSON.parse(JSON.stringify(driverRatings))}
    />
  );
}
