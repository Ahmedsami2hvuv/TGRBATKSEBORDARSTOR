"use client";

import type { TwoWayTemplatesConfig, TwoWayButtonRule } from "@/lib/two-way-whatsapp-helpers";

export type TwoWayOrderActionButtonsProps = {
  orderId?: string;
  orderNumber?: string | number;
  orderStatus?: string;
  routeMode?: string;
  senderName?: string;
  senderPhone?: string | null;
  senderAlternatePhone?: string | null;
  senderRegionName?: string | null;
  senderHasLocation?: boolean;
  senderGpsUploaded?: boolean;
  recipientName?: string;
  recipientPhone?: string | null;
  recipientAlternatePhone?: string | null;
  recipientRegionName?: string | null;
  recipientHasLocation?: boolean;
  recipientGpsUploaded?: boolean;
  subtotal?: string | number | null;
  delivery?: string | number | null;
  total?: string | number | null;
  notes?: string | null;
  deliveryName?: string | null;
  buttonRules?: TwoWayButtonRule[];
  twoWayTemplates?: Partial<TwoWayTemplatesConfig> | null;
};

/** تم تعطيل الزر العائم للطلب ذو الوجهتين بناءً على التصميم الملكي الموحد حيث يحتوي كل كارت على أزرار الاتصال والواتساب */
export function TwoWayOrderActionButtons(_props: TwoWayOrderActionButtonsProps) {
  return null;
}
