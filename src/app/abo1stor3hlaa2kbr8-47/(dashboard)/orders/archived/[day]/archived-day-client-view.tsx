import { Metadata } from "next";
import LuxuryDeliveryDashboard from "@/components/luxury-delivery/LuxuryDeliveryDashboard";

export const metadata: Metadata = {
  title: "لوحة التوصيل الزمردية الفاخرة | إدارة الطلبات",
  description: "لوحة تحكم وتتبع الطلبات الملكية الفاخرة بطراز الزمرد والذهب — وصلي",
};

export default function AdminLuxuryDeliveryPage() {
  return <LuxuryDeliveryDashboard />;
}
