"use client";

import { useEffect, useState } from "react";
import {
  applyMandoubWaTemplate,
  splitMandoubWaTemplateVariants,
  type MandoubWaButtonVariableValues,
} from "@/lib/mandoub-wa-button-template";
import { openUrlFromUserGesture, whatsappMeUrl, whatsappAppUrl } from "@/lib/whatsapp";
import { PhoneActionModal } from "@/components/phone-action-modal";
import {
  type OrderCardDesignerConfig,
  getElementStyle,
} from "@/lib/order-card-customizer";

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
  designerConfig?: OrderCardDesignerConfig;
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
  designerConfig,
}: Props) {
  const [buttons, setButtons] = useState<WaButtonNextItem[]>(customButtons || []);
  const [activePhoneModal, setActivePhoneModal] = useState<{
    phone1: string;
    phone2?: string | null;
    messageText: string;
  } | null>(null);

  useEffect(() => {
    if (customButtons && customButtons.length > 0) {
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

  // 1. تصفية الأزرار المخصصة المفعّلة لخيار "بجانب زر اللوكيشن"
  let locationButtons = buttons.filter((btn) => {
    if (!btn.showNextToLocation) return false;

    // فحص الصلاحية
    const rawScope = btn.visibilityScope && btn.visibilityScope.trim() ? btn.visibilityScope.trim() : "all";
    const scopes = rawScope.split(",").map((s) => s.trim()).filter(Boolean);
    const matchRole =
      scopes.includes("all") ||
      (userRole === "admin" && scopes.includes("admin")) ||
      (userRole === "mandoub" && scopes.includes("mandoub")) ||
      (userRole === "staff" && (scopes.includes("employee") || scopes.includes("preparer")));

    if (!matchRole) return false;

    // فحص حالة الطلب: إذا الزر محدد لحالات معينة فلا يظهر إذا حالة الطلب غير معروفة أو غير مسموحة.
    if (btn.statusesCsv?.trim()) {
      const allowedStatuses = btn.statusesCsv.split(",").map((s) => s.trim()).filter(Boolean);
      if (!orderStatus || (allowedStatuses.length > 0 && !allowedStatuses.includes(orderStatus))) {
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

  // في حال عدم وجود أي زر مخصص يطابق شروط الدور وحالة الطلب الحالية:
  // نستخدم الزر الافتراضي المناسب (تبليغ الزبون عند وجود لوكيشن، أو طلب لوكيشن عند عدم وجوده)
  if (locationButtons.length === 0) {
    const isExistingLoc = Boolean(hasCustomerLocation || hasCourierUploadedLocation);
    if (isExistingLoc) {
      locationButtons = [
        {
          id: "default-notify-customer",
          label: "تبليغ الزبون",
          iconKey: "💬",
          templateText: "السلام عليكم، نود تبليغكم بتجهيز طلبكم رقم #{order_number} وسيصلكم قريباً بإذن الله.",
          recipient: "customer",
          showNextToLocation: true,
        },
      ];
    } else {
      locationButtons = [
        {
          id: "default-request-location",
          label: userRole === "admin" ? "طلب لوكيشن" : "طلب لكيشن",
          iconKey: "📍",
          templateText:
            userRole === "admin"
              ? "السلام عليكم، نود تزويدنا بموقعكم (اللوكيشن) لتوصيل طلبكم رقم #{order_number}."
              : "السلام عليكم، يرجى إرسال موقعك (اللوكيشن) لتوصيل طلبك رقم #{order_number} 📍",
          recipient: "customer",
          showNextToLocation: true,
        },
      ];
    }
  }

  const handleButtonClick = (btn: WaButtonNextItem) => {
    const variants = splitMandoubWaTemplateVariants(btn.templateText || "");
    if (variants.length === 0) {
      sendWaMessage(btn, btn.templateText || "السلام عليكم بخصوص طلبكم 📦");
    } else {
      const randomIndex = Math.floor(Math.random() * variants.length);
      sendWaMessage(btn, variants[randomIndex]);
    }
  };

  const sendWaMessage = (btn: WaButtonNextItem, rawTemplate: string) => {
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
        : p1 || p2;

    // نستخدم الرابط الآمن api.whatsapp.com على الجوال لفتح التطبيق مباشرة وتفادي أي أخطاء
    const isMobile = typeof window !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isMobile ? whatsappAppUrl(targetPhone, text) : whatsappMeUrl(targetPhone, text);
    if (url && url !== "#") {
      openUrlFromUserGesture(url);
    } else {
      alert("رقم الهاتف غير متاح لإرسال الرسالة عبر الواتساب.");
    }
  };

  return (
    <>
      {locationButtons.slice(0, 1).map((btn) => {
        const btnCustom = designerConfig?.waButtonsConfig?.[btn.id];
        if (btnCustom?.hidden) return null;

        const customStyle = getElementStyle(btnCustom);
        const customImg = btnCustom?.imageUrl;

        return (
          <div key={btn.id} className="relative inline-block w-full min-w-0" style={customStyle}>
            <button
              type="button"
              onClick={() => handleButtonClick(btn)}
              className={`group relative flex w-full h-[44px] max-h-[44px] items-center justify-center gap-1.5 rounded-[16px] bg-[#FFC107] text-[#0B2E8C] font-extrabold text-[12px] shadow-[0_4px_12px_rgba(255,193,7,0.35)] transition-all hover:bg-[#ffcd38] active:scale-[0.97] cursor-pointer overflow-hidden px-3 ${
                compact ? "text-[11px] py-1 px-2 h-[36px]" : "text-[12px]"
              }`}
              title={btn.label}
            >
              {customImg ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={customImg}
                  alt={btn.label}
                  className="w-4 h-4 object-contain shrink-0 drop-shadow-xs pointer-events-none"
                />
              ) : (
                <svg className="w-3.5 h-3.5 text-[#0B2E8C] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              )}
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

