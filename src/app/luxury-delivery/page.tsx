import { Metadata } from "next";
import LuxuryDeliveryDashboard from "@/components/luxury-delivery/LuxuryDeliveryDashboard";

export const metadata: Metadata = {
  title: "لوحة التحكم الملكية الفاخرة | إدارة التوصيل",
  description: "لوحة تحكم وتتبع الطلبات الملكية الفاخرة بطراز الزمرد والذهب — وصلي للتوصيل",
};

export default function LuxuryDeliveryPage() {
  return <LuxuryDeliveryDashboard />;
}
