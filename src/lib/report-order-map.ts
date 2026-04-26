import type { Order, Courier, Shop, Employee, Customer } from "@prisma/client";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { hasCustomerLocationUrl } from "./order-location";
import { normalizeAdminShopName } from "@/lib/admin-order-from-admin-constants";
import type { ReportTableRow } from "./report-types";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";

export const REPORT_STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  assigned: "مسند للمندوب",
  delivering: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

export type OrderForReport = Order & {
  shop: Shop;
  courier: Courier | null;
  submittedBy: Employee | null;
  customer: Pick<Customer, "customerLocationUrl"> | null;
};

export function formatOrderAmount(o: OrderForReport): string {
  if (o.totalAmount == null) return "—";
  return formatDinarAsAlf(o.totalAmount);
}

export function orderTransactionTypeLabel(o: OrderForReport): string {
  const st = REPORT_STATUS_AR[o.status] ?? o.status;
  const ot = o.orderType?.trim();
  return ot ? `${st} — ${ot}` : st;
}

export function orderDateLabel(o: OrderForReport): string {
  return formatBaghdadDateTime(o.createdAt, { dateStyle: "medium", timeStyle: "short" });
}

export function orderToReportRow(o: OrderForReport): ReportTableRow {
  const missingCustomerLocation = !hasCustomerLocationUrl(
    o.customerLocationUrl,
    o.customer?.customerLocationUrl,
  );
  return {
    orderId: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    shopName: normalizeAdminShopName(o.shop.name),
    preparerName: o.submittedBy?.name?.trim() || "—",
    courierName: o.courier?.name?.trim() || "—",
    transactionType: orderTransactionTypeLabel(o),
    amount: formatOrderAmount(o),
    dateLabel: orderDateLabel(o),
    missingCustomerLocation,
  };
}
