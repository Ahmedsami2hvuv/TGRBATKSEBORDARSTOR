import { Decimal } from "@prisma/client/runtime/library";
import type { CourierVehicleType } from "@prisma/client";

/**
 * Interface representing a Decimal-like object for math operations.
 */
export interface DecimalMathLike {
  div(other: number | DecimalMathLike): DecimalMathLike;
  mul(other: number | DecimalMathLike): DecimalMathLike;
}

/**
 * أجر التوصيل للمندوب عند «تم التسليم» — من **كلفة التوصيل** فقط (لا سعر الطلب ولا الوارد):
 * - سيارة: ثلثي كلفة التوصيل ≈ (2/3) × deliveryPrice
 * - دراجة: نصف كلفة التوصيل
 */
export function computeCourierDeliveryEarningDinar(
  vehicle: CourierVehicleType,
  deliveryPrice: DecimalMathLike | number | string | null | undefined,
  zeroEarning = false,
): Decimal | null {
  if (deliveryPrice == null) return null;
  if (zeroEarning) return new Decimal(0);

  const decVal =
    typeof deliveryPrice === "object" && deliveryPrice !== null && "mul" in deliveryPrice && typeof (deliveryPrice as any).mul === "function"
      ? (deliveryPrice as unknown as Decimal)
      : new Decimal(Number(deliveryPrice) || 0);

  if (vehicle === "bike") {
    return decVal.div(2);
  }
  return decVal.mul(2).div(3);
}
