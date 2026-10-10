"use client";

import React, { useState, useEffect } from "react";
import type { MandoubOrderDetailPayload } from "@/lib/mandoub-order-queries";
import { UISectionConfig } from "@/lib/ui-settings";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { WasliOrderDetailView } from "./wasli-order-detail-view";

type PhoneProfileFallback = {
  locationUrl: string;
  landmark: string;
  photoUrl: string;
  alternatePhone: string | null;
} | null;

export function OrderDetailSection({
  order,
  closeHref,
  onCloseModal,
  auth,
  nextUrl,
  viewerCourierId,
  courierName,
  phoneProfile,
  secondPhoneProfile,
  smartHintLine,
  secondSmartHintLine,
  uiSettings,
  icons,
  routeHistory,
  courierSettings,
  isModal = false,
  customWaButtons,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  onCloseModal?: () => void;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  viewerCourierId?: string;
  courierName?: string | null;
  phoneProfile?: any;
  secondPhoneProfile?: PhoneProfileFallback;
  smartHintLine?: string | null;
  secondSmartHintLine?: string | null;
  uiSettings?: UISectionConfig | null;
  icons?: GlobalIconsConfig | null;
  routeHistory?: { lat: number; lng: number; recordedAt: string }[];
  courierSettings?: {
    showDoorBtn?: boolean;
    showLocationBtn?: boolean;
    showCallBtn?: boolean;
    showWhatsAppBtn?: boolean;
    showNotesBtn?: boolean;
    showVoiceNotesBtn?: boolean;
    showMoneyBoxes?: boolean;
    showFloatingBar?: boolean;
    hideShopInfoOnPickup?: boolean;
    guidedDeliverySteps?: boolean;
    orderViewTheme?: string;
  };
  isModal?: boolean;
  customWaButtons?: any[];
}) {
  const [customerDebt, setCustomerDebt] = useState<number | null>(null);

  useEffect(() => {
    if (order.customerPhone) {
      import("@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions")
        .then(({ getCustomerDebtByPhone }) => {
          getCustomerDebtByPhone(order.customerPhone)
            .then(setCustomerDebt)
            .catch(() => setCustomerDebt(null));
        })
        .catch(() => setCustomerDebt(null));
    }
  }, [order.customerPhone]);

  return (
    <WasliOrderDetailView
      order={order}
      auth={auth}
      closeHref={closeHref}
      onCloseModal={onCloseModal}
      nextUrl={nextUrl}
      viewerCourierId={viewerCourierId}
      courierName={courierName}
      phoneProfile={phoneProfile}
      secondPhoneProfile={secondPhoneProfile}
      smartHintLine={smartHintLine}
      secondSmartHintLine={secondSmartHintLine}
      isModal={isModal}
      customerDebt={customerDebt}
      customWaButtons={customWaButtons}
    />
  );
}
