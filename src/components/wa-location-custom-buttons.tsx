"use client";

import { useEffect, useState } from "react";
import {
  applyMandoubWaTemplate,
  splitMandoubWaTemplateVariants,
  type MandoubWaButtonVariableValues,
} from "@/lib/mandoub-wa-button-template";
import { openUrlFromUserGesture, whatsappMeUrl } from "@/lib/whatsapp";

export type WaButtonNextItem = {
  id: string;
  label: string;
  iconKey?: string;
  templateText: string;
  visibilityScope?: string;
  statusesCsv?: string;
  customerLocationRule?: string;
  showNextToLocation?: boolean;
  recipient?: string;
};

type Props = {
  userRole: "admin" | "mandoub" | "staff";
  customerPhone?: string;
  customerPhone2?: string;
  shopPhone?: string;
  orderStatus?: string;
  hasCustomerLocation?: boolean;
  hasCourierUploadedLocation?: boolean;
  templateVars?: MandoubWaButtonVariableValues;
  customButtons?: WaButtonNextItem[];
  compact?: boolean;
};

export function WaLocationCustomButtons({
  userRole,
  customerPhone = "",
  customerPhone2 = "",
  shopPhone = "",
  orderStatus,
  hasCustomerLocation,
  hasCourierUploadedLocation,
  templateVars = {},
  customButtons,
  compact = false,
}: Props) {
  const [buttons, setButtons] = useState<WaButtonNextItem[]>(customButtons || []);
  const [openModalBtnId, setOpenModalBtnId] = useState<string | null>(null);

  useEffect(() => {
    if (customButtons) {
      setButtons(customButtons);
      return;
    }
    let cancelled = false;
    fetch("/api/mandoub-wa-buttons", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: WaButtonNextItem[]) => {
        if (!cancelled && Array.isArray(data)) {
          setButtons(data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customButtons]);

  // تصفية الأزرار المخصصة المفعّلة لخيار "بجانب زر اللوكيشن"
  const locationButtons = buttons.filter((btn) => {
    if (!btn.showNextToLocation) return false;

    // فحص الصلاحية
    const scopes = (btn.visibilityScope ?? "all").split(",").map((s) => s.trim());
    const matchRole =
      scopes.includes("all") ||
      (userRole === "admin" && scopes.includes("admin")) ||
      (userRole === "mandoub" && scopes.includes("mandoub")) ||
      (userRole === "staff" && (scopes.includes("employee") || scopes.includes("preparer")));

    if (!matchRole) return false;

    // فحص حالة الطلب
    if (orderStatus && btn.statusesCsv) {
      const allowedStatuses = btn.statusesCsv.split(",").map((s) => s.trim()).filter(Boolean);
      if (allowedStatuses.length > 0 && !allowedStatuses.includes(orderStatus)) {
        return false;
      }
    }

    // فحص حالة اللوكيشن
    if (btn.customerLocationRule) {
      const rules = btn.customerLocationRule.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (rules.length > 0 && !rules.includes("any")) {
        let ok = false;
        const isExistingLoc = Boolean(hasCustomerLocation || hasCourierUploadedLocation);

        if ((rules.includes("exists") || rules.includes("location") || rules.includes("has_location")) && isExistingLoc) ok = true;
        if ((rules.includes("missing") || rules.includes("no_location")) && !isExistingLoc) ok = true;
        if (rules.includes("courier_gps") && hasCourierUploadedLocation) ok = true;

        if (!ok) return false;
      }
    }

    return true;
  });

  if (locationButtons.length === 0) {
    return null;
  }

  const [activePhoneModal, setActivePhoneModal] = useState<{
    phone1: string;
    phone2?: string | null;
    messageText: string;
  } | null>(null);

  const handleButtonClick = (btn: WaButtonNextItem) => {
    const variants = splitMandoubWaTemplateVariants(btn.templateText || "");
    if (variants.length === 0) {
      sendWaMessage(btn, "");
    } else {
      // اختيار صيغة عشوائية فوراً في كل ضغطة
      const randomIndex = Math.floor(Math.random() * variants.length);
      sendWaMessage(btn, variants[randomIndex]);
    }
  };

  const sendWaMessage = (btn: WaButtonNextItem, rawTemplate: string) => {
    setOpenModalBtnId(null);

    const text = applyMandoubWaTemplate(rawTemplate, {
      ...templateVars,
      customer_phone: customerPhone || templateVars.customer_phone || "",
      customer_phone2: customerPhone2 || templateVars.customer_phone2 || "",
      shop_phone: shopPhone || templateVars.shop_phone || "",
    });

    const isCustomerTarget = btn.recipient !== "shop";
    const p1 = customerPhone || templateVars.customer_phone || "";
    const p2 = customerPhone2 || templateVars.customer_phone2 || "";

    if (isCustomerTarget && p1 && p2 && p1.trim() !== p2.trim()) {
      setActivePhoneModal({
        phone1: p1,
        phone2: p2,
        messageText: text,
      });
      return;
    }

    const targetPhone =
      btn.recipient === "customer2" && customerPhone2
        ? customerPhone2
        : btn.recipient === "shop" && shopPhone
        ? shopPhone
        : p1;

    const url = whatsappMeUrl(targetPhone, text);
    if (url && url !== "#") {
      openUrlFromUserGesture(url);
    } else {
      alert("رقم الهاتف غير متاح لإرسال الرسالة عبر الواتساب.");
    }
  };

  return (
    <>
      {locationButtons.map((btn) => {
        return (
          <div key={btn.id} className="relative inline-block w-full">
            <button
              type="button"
              onClick={() => handleButtonClick(btn)}
              className={`flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-amber-400/90 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-3 py-2 text-xs font-black text-white shadow-md shadow-amber-500/25 transition hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 active:scale-95 ${
                compact ? "text-[11px] py-1.5 px-2" : ""
              }`}
              title={btn.label}
            >
              <span className="text-sm shrink-0">{btn.iconKey || "⚡"}</span>
              <span className="truncate">{btn.label}</span>
            </button>
          </div>
        );
      })}

      {activePhoneModal && (
        <PhoneActionModal
          type="whatsapp"
          phone1={activePhoneModal.phone1}
          phone2={activePhoneModal.phone2}
          messageText={activePhoneModal.messageText}
          onClose={() => setActivePhoneModal(null)}
        />
      )}
    </>
  );
}
