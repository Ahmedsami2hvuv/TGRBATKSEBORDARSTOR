import { DeliveryLoading } from "@/components/delivery-loading";

export default function StaffPortalLoading() {
  return (
    <div className="kse-app-bg min-h-screen flex items-center justify-center p-8 text-slate-800" dir="rtl">
      <div className="text-center space-y-4 w-full max-w-md">
        <h2 className="text-2xl font-bold text-sky-900">
          جاري جلب البيانات...
        </h2>

        <DeliveryLoading message="يرجى الانتظار، جاري الاتصال بالخادم..." />
      </div>
    </div>
  );
}
