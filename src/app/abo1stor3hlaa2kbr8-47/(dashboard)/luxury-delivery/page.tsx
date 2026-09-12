import { Metadata } from "next";
import LuxuryDeliveryDashboard from "@/components/luxury-delivery/LuxuryDeliveryDashboard";

export const metadata: Metadata = {
  title: "لوحة التوصيل الزمردية الفاخرة | إدارة الطلبات",
  description: "لوحة تحكم وتتبع الطلبات الملكية الفاخرة بطراز الزمرد والذهب — أبو الأكبر للتوصيل",
};

export default function AdminLuxuryDeliveryPage() {
  return <LuxuryDeliveryDashboard />;
}
