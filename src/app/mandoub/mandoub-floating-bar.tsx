"use client";

import { useEffect, useMemo, useState } from "react";
import { OrderFabDock } from "@/components/order-fab-dock";
import { MANDOUB_ORDER_FAB_LAYOUT_STORAGE_KEY } from "@/lib/mandoub-fab-bridge";
import {
  applyMandoubWaTemplate,
  parseStatusesCsv,
  splitMandoubWaTemplateVariants,
} from "@/lib/mandoub-wa-button-template";
import {
  matchesCustomerLocationRules,
  parseCustomerLocationRules,
} from "@/lib/order-location";

export type MandoubWaButtonRow = {
  id: string;
  label: string;
  iconKey: string | null;
  templateText: string | null;
  visibilityScope: string | null;
  statusesCsv: string | null;
  customerLocationRule: string | null;
};

/** مواضع موحّدة لكل طلبات المندوب (ليست لكل طلب على حدة) */
const STORAGE_KEY = MANDOUB_ORDER_FAB_LAYOUT_STORAGE_KEY;

type Props = {
  orderId: string;
  shopPhone: string;
  customerPhone: string;
  customerAlternatePhone?: string;
  /** إن وُجد يظهر خيار ثالث في واتساب/اتصال: محل، زبون، مجهز */
  preparerPhone?: string;
  orderStatus: string;
  orderNumber: number;
  shopName: string;
  city: string;
  totalPrice: string;
  deliveryName: string;
  customerLocationUrl: string;
  customerLandmark: string;
  hasCustomerLocation: boolean;
  /** لوكيشن الزبون مرفوع من المندوب بزر GPS (customerLocationSetByCourierAt) */
  hasCourierUploadedLocation: boolean;
  /** واجهة المجهز: إخفاء الفاب أثناء تعديل الطلب */
  hideWhenPreparerEditOpen?: boolean;
  /** واجهة المجهز: إخفاء جميع أزرار الاتصال */
  hideAllButtons?: boolean;
  showCallBtn?: boolean;
  showWhatsAppBtn?: boolean;
};

/** واتساب + اتصال (قائمة عميل/زبون/زبون 2) */
export function MandoubFloatingBar(props: Props) {
  const [rows, setRows] = useState<MandoubWaButtonRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/mandoub-wa-buttons", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Failed to load wa buttons")))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setRows(data);
        }
      })
      .catch((error) => {
        console.error("MandoubFloatingBar failed to load wa button rows", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const vars = {
    clientshop: props.shopName,
    city: props.city,
    total_price: props.totalPrice,
    delivery: props.deliveryName,
    location_url: props.customerLocationUrl,
    landmark: props.customerLandmark,
    order_number: String(props.orderNumber),
    customer_phone: props.customerPhone,
    customer_phone2: props.customerAlternatePhone ?? "",
    shop_phone: props.shopPhone,
  };

  const customWaButtons = useMemo(() => {
    return rows.flatMap((r) => {
      const scopes = (r.visibilityScope ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const canSeeMandoub = scopes.includes("all") || scopes.includes("mandoub");
      if (!canSeeMandoub) return [];

      const statuses = parseStatusesCsv(r.statusesCsv ?? "");
      if (statuses.length > 0 && !statuses.includes(props.orderStatus)) return [];

      const locRules = parseCustomerLocationRules(r.customerLocationRule ?? "any");
      if (!matchesCustomerLocationRules(locRules, props.hasCustomerLocation, props.hasCourierUploadedLocation)) return [];

      const messages = splitMandoubWaTemplateVariants(r.templateText ?? "").map((t) =>
        applyMandoubWaTemplate(t, vars),
      );
      if (messages.length === 0) return [];

      return [
        {
          id: r.id,
          label: r.label,
          iconKey: r.iconKey,
          messages,
        },
      ];
    });
  }, [rows, props]);

  return (
    <OrderFabDock
      storageKey={STORAGE_KEY}
      legacyLayoutStorageKey="mandoubFabLayout_v3"
      orderId={props.orderId}
      shopPhone={props.shopPhone}
      customerPhone={props.customerPhone}
      customerAlternatePhone={props.customerAlternatePhone}
      preparerPhone={props.preparerPhone?.trim() || undefined}
      customWaButtons={customWaButtons}
      hideWhenPreparerEditOpen={props.hideWhenPreparerEditOpen}
      hideAllButtons={props.hideAllButtons}
      showCallBtn={props.showCallBtn}
      showWhatsAppBtn={props.showWhatsAppBtn}
    />
  );
}
