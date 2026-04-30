import { DeliveryLoading } from "@/components/delivery-loading";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6" dir="rtl">
      <div className="text-center space-y-4 w-full max-w-md">
        <h2 className="text-2xl font-bold text-sky-900">
          أبو الأكبر للتوصيل
        </h2>

        <DeliveryLoading message="نجهز لك البيانات، لحظات..." />

        <p className="text-sm font-medium text-slate-400">
          يرجى الانتظار، نحن نجهز لك التجربة الأفضل
        </p>
      </div>
    </div>
  );
}
