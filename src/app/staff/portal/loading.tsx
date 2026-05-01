import { DeliveryLoading } from "@/components/delivery-loading";

export default function StaffPortalLoading() {
  return (
    <div className="kse-app-bg min-h-screen flex items-center justify-center p-8 text-slate-800" dir="rtl">
      <DeliveryLoading message="يرجى الانتظار، جاري الاتصال بالخادم..." />
    </div>
  );
}
