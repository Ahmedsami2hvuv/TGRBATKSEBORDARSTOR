import { DeliveryLoading } from "@/components/delivery-loading";

export default function MandoubLoading() {
  return (
    <div dir="rtl" className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="w-full max-w-md text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">جاري التحميل...</h2>
        <DeliveryLoading message="يرجى الانتظار، جاري تحضير المهام" />
      </div>
    </div>
  );
}
