import type { Decimal } from "@prisma/client/runtime/library";
import type { DecimalLike } from "./mandoub-money-events";

export interface DecimalMaxLike extends DecimalLike {
  greaterThan(other: DecimalMaxLike | number): boolean;
  toNumber(): number;
}

function decimalMax(...args: DecimalMaxLike[]): DecimalMaxLike {
  let max = args[0];
  for (let i = 1; i < args.length; i++) {
    if (args[i].greaterThan(max)) {
      max = args[i];
    }
  }
  return max;
}

/**
 * - الطلب العادي (single): max(سعر توصيل منطقة المحل، سعر توصيل منطقة الزبون)
 * - طلب الوجهتين (double): max(سعر توصيل منطقة المرسل، سعر توصيل منطقة المستلم)
 *   ملاحظة: سعر توصيل "محل النظام" لا يدخل بالحساب إطلاقاً بوضع double،
 *   لأن هذا المحل قيمة تقنية فقط وما له علاقة حقيقية بالطلب.
 */
export function computeDeliveryPriceFromRegions(input: {
  shopRegionDelivery: DecimalMaxLike;
  customerRegionDelivery: DecimalMaxLike;
  secondRegionDelivery: DecimalMaxLike | null;
  routeMode: string;
}): DecimalMaxLike {
  const firstDel = input.customerRegionDelivery;

  if (input.routeMode === "double") {
    const secondDel = input.secondRegionDelivery ?? ({
      greaterThan: (other: DecimalMaxLike | number) => {
        const val = typeof other === 'number' ? other : other.toNumber();
        return 0 > val;
      },
      toNumber: () => 0,
      toDecimalPlaces: (places: number) => ({
        equals: (other: any) => (typeof other === 'number' ? 0 === other : (other.toNumber ? other.toNumber() === 0 : false))
      })
    } as DecimalMaxLike);

    return decimalMax(firstDel, secondDel);
  }

  return decimalMax(input.shopRegionDelivery, firstDel);
}
