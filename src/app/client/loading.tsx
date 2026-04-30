import { DeliveryLoading } from "@/components/delivery-loading";

export default function ClientLoading() {
  return (
    <div dir="rtl" lang="ar" className="kse-app-bg flex flex-col items-center justify-center min-h-[100vh] space-y-8 w-full text-slate-800 p-6">
      <div className="text-center space-y-4 w-full max-w-md">
        <h2 className="text-2xl font-bold text-sky-900">
          جاري جلب البيانات...
        </h2>

        <DeliveryLoading message="الرجاء الانتظار قليلاً ريثما تكتمل العملية" />
      </div>
    </div>
  );
}
