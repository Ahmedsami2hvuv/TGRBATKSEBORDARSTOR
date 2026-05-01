import { DeliveryLoading } from "@/components/delivery-loading";

export default function MandoubLoading() {
  return (
    <div dir="rtl" className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
      <DeliveryLoading message="يرجى الانتظار، جاري تحضير المهام..." />
    </div>
  );
}
