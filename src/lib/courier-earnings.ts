import { Decimal } from "@prisma/client/runtime/library";
import type { CourierVehicleType } from "@prisma/client";

/**
 * أجر التوصيل للمندوب عند «تم التسليم» — من **كلفة التوصيل** فقط (لا سعر الطلب ولا الوارد):
 * - سيارة: ثلثي كلفة التوصيل ≈ (2/3) × deliveryPrice
 * - دراجة: نصف كلفة التوصيل
 */
export function computeCourierDeliveryEarningDinar(
  vehicle: CourierVehicleType,
  deliveryPrice: Decimal | null,
): Decimal | null {
  if (deliveryPrice == null) return null;
  if (vehicle === "bike") {
    return deliveryPrice.div(2);
  }
  return deliveryPrice.mul(2).div(3);
}
