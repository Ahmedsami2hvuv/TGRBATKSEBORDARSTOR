import React from "react";
import { prisma } from "@/lib/prisma";
import { ClientFeedbacksView } from "./client-feedbacks-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقييمات الأكشاك والعملاء — لوحة الإدارة",
};

export default async function ClientFeedbacksPage() {
  const feedbacks = await prisma.clientFeedback.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      shop: {
        select: { id: true, name: true, phone: true, photoUrl: true, region: { select: { name: true } } },
      },
    },
    take: 200,
  });

  return <ClientFeedbacksView initialFeedbacks={feedbacks} />;
}
