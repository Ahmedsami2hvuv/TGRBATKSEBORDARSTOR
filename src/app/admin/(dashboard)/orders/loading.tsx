import { DeliveryLoading } from "@/components/delivery-loading";
import { getGlobalIcons } from "@/lib/icon-settings";

export default async function AdminOrdersLoading() {
  const icons = await getGlobalIcons();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <DeliveryLoading
        message="جاري جلب بيانات الطلبات..."
        initialIcons={icons}
      />
    </div>
  );
}
