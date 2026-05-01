import { DeliveryLoading } from "@/components/delivery-loading";

export default function ClientLoading() {
  return (
    <div dir="rtl" lang="ar" className="kse-app-bg flex flex-col items-center justify-center min-h-[100vh] w-full text-slate-800 p-6">
      <DeliveryLoading message="جاري جلب بياناتك، يرجى الانتظار..." />
    </div>
  );
}
