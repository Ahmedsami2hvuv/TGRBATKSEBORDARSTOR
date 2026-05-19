import type { Decimal } from "@prisma/client/runtime/library";
import type { DecimalLike } from "./mandoub-money-events";

/**
 * Interface representing a Decimal-like object with necessary methods for the browser.
 */
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

/** نفس منطق إنشاء الطلب: max(محل، منطقة الزبون، [الوجهة الثانية]). */
export function computeDeliveryPriceFromRegions(input: {
  shopRegionDelivery: DecimalMaxLike;
  customerRegionDelivery: DecimalMaxLike;
  secondRegionDelivery: DecimalMaxLike | null;
  routeMode: string;
}): DecimalMaxLike {
  const shopDel = input.shopRegionDelivery;
  const firstDel = input.customerRegionDelivery;

  // Create a minimal Decimal-like object for 0 if secondRegionDelivery is null
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

  if (input.routeMode === "double") {
    return decimalMax(shopDel, firstDel, secondDel);
  }
  return decimalMax(shopDel, firstDel);
}
