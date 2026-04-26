import { Decimal } from "@prisma/client/runtime/library";
import { MONEY_KIND_DELIVERY } from "@/lib/mandoub-money-events";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";

/** لحساب «أرباحي» وحالات الطلبات الحالية — أموال الصادر/الوارد تُحسب من `fetchMandoubMoneySumsForCourier` / `computeMoneySumsFromCourierEvents` */
export type MandoubOrderTotalsInput = {
  status: string;
  updatedAt: Date;
  courierEarningDinar: Decimal | null;
  courierEarningForCourierId: string | null;
  /** اختيارياً — يُستخدم كبديل عند غياب courierEarningForCourierId */
  assignedCourierId?: string | null;
  /** اختيارياً — يُستخدم كبديل لحساب الأجر عند غياب courierEarningDinar */
  deliveryPrice?: Decimal | null;
  courierVehicleType?: string | null;
  courier?: { vehicleType?: string | null } | null;
  moneyEvents: Array<{
    kind: string;
    amountDinar: Decimal;
    deletedAt: Date | null;
    createdAt: Date;
    /** يُفضّل لربط الأجر بمندوب التسليم الفعلي عند وجود حركة وارد */
    courierId?: string;
  }>;
};

export type MandoubCourierOrderMetrics = {
  sumEarnings: Decimal;
  /** لقطة حالية لطلبات المندوب المسند إليه حالياً */
  ordersAssigned: number;
  ordersDelivering: number;
  ordersDelivered: number;
};

/**
 * أرباح التوصيل المسندة لهذا المندوب (`courierEarningForCourierId`) وحالات الطلبات المفتوحة.
 * الصادر/الوارد/المتبقي يأتي من حركات مالية مرتبطة بـ `courierId` وليس من قائمة الطلبات الحالية فقط.
 */
export function computeMandoubTotalsForCourier(
  orders: MandoubOrderTotalsInput[],
  courierId: string,
  baseline: Date | null,
  includeArchivedEarnings = false,
): MandoubCourierOrderMetrics {
  let sumEarnings = new Decimal(0);
  let ordersAssigned = 0;
  let ordersDelivering = 0;
  let ordersDelivered = 0;

  for (const o of orders) {
    if (o.status === "assigned") ordersAssigned++;
    else if (o.status === "delivering") ordersDelivering++;
    else if (o.status === "delivered") ordersDelivered++;

    if (o.status !== "delivered" && !(includeArchivedEarnings && o.status === "archived")) continue;

    const deliveryEv = o.moneyEvents.find(
      (e) => e.kind === MONEY_KIND_DELIVERY && e.deletedAt == null,
    );

    // صاحب الأرباح: الحقل المحفوظ على الطلب، ثم مندوب حركة الوارد، ثم المسند حالياً.
    const earningOwner =
      o.courierEarningForCourierId ??
      deliveryEv?.courierId ??
      o.assignedCourierId ??
      null;
    if (earningOwner !== courierId) continue;

    // قيمة الأجر: إن كان courierEarningDinar محفوظاً نستخدمه، وإلا نحسبه من deliveryPrice + نوع مركبة المندوب.
    let earning: Decimal | null = o.courierEarningDinar ?? null;
    if (earning == null) {
      const vehicleType = o.courierVehicleType ?? o.courier?.vehicleType ?? null;
      const deliveryPrice = o.deliveryPrice ?? null;
      if (vehicleType && deliveryPrice != null) {
        earning = computeCourierDeliveryEarningDinar(
          vehicleType as any,
          deliveryPrice,
        );
      }
    }
    if (earning == null) continue;

    let skipForBaseline = false;
    if (baseline) {
      if (deliveryEv) skipForBaseline = deliveryEv.createdAt <= baseline;
      else skipForBaseline = o.updatedAt <= baseline;
    }

    if (!skipForBaseline) {
      sumEarnings = sumEarnings.plus(earning);
    }
  }

  return {
    sumEarnings,
    ordersAssigned,
    ordersDelivering,
    ordersDelivered,
  };
}
