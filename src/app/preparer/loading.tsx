import { DeliveryLoading } from "@/components/delivery-loading";

export default function PreparerLoading() {
  return (
    <div dir="rtl" className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 overflow-hidden">
      <div className="w-full max-w-4xl">
        <DeliveryLoading message="يرجى الانتظار، جاري تحضير الطلبات..." />
      </div>
    </div>
  );
}
