import { redirect } from "next/navigation";

/** توحيد الواجهة مع تتبع الطلبات (نفس شريط التبويبات والبحث) */
export default function RejectedOrdersRedirectPage() {
  redirect("/admin/orders/tracking?status=cancelled");
}
