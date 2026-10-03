import { DeliveryLoading } from "@/components/delivery-loading";
import { getGlobalIcons } from "@/lib/icon-settings";

export default async function Loading() {
  const icons = await getGlobalIcons();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6" dir="rtl">
      <div className="text-center w-full max-w-4xl">
        <div className="flex flex-col items-center justify-center mb-8">
          <img src="/images/wasly-logo.png" alt="وصلي" className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-full shadow-md animate-pulse mb-3" />
          <h2 className="text-2xl md:text-3xl font-black text-[#0088ff]">
            وصلي
          </h2>
        </div>

        <DeliveryLoading message="نجهز لك البيانات، لحظات..." initialIcons={icons} />

        <p className="text-sm font-medium text-slate-400 mt-8 animate-pulse">
          يرجى الانتظار، نحن نجهز لك التجربة الأفضل
        </p>
      </div>
    </div>
  );
}
