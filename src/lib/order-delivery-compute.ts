import { Decimal } from "@prisma/client/runtime/library";

/** نفس منطق إنشاء الطلب: max(محل، منطقة الزبون، [الوجهة الثانية]). */
export function computeDeliveryPriceFromRegions(input: {
  shopRegionDelivery: Decimal;
  customerRegionDelivery: Decimal;
  secondRegionDelivery: Decimal | null;
  routeMode: string;
}): Decimal {
  const shopDel = input.shopRegionDelivery;
  const firstDel = input.customerRegionDelivery;
  const secondDel = input.secondRegionDelivery ?? new Decimal(0);
  if (input.routeMode === "double") {
    return Decimal.max(shopDel, firstDel, secondDel);
  }
  return Decimal.max(shopDel, firstDel);
}
