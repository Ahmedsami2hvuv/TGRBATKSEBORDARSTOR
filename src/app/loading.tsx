import { DeliveryLoading } from "@/components/delivery-loading";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6" dir="rtl">
      <div className="text-center w-full max-w-4xl">
        <h2 className="text-4xl md:text-6xl font-black text-sky-900 mb-8 opacity-20">
          أبو الأكبر للتوصيل
        </h2>

        <DeliveryLoading message="نجهز لك البيانات، لحظات..." />

        <p className="text-sm font-medium text-slate-400 mt-8 animate-pulse">
          يرجى الانتظار، نحن نجهز لك التجربة الأفضل
        </p>
      </div>
    </div>
  );
}
