import { redirect } from "next/navigation";

/** توحيد الواجهة مع تتبع الطلبات (نفس شريط التبويبات والبحث) */
export default function RejectedOrdersRedirectPage() {
  redirect("/abo1stor3hlaa2kbr8-47/orders/tracking?status=cancelled");
}
