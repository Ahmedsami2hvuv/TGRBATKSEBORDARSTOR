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

  // 2. إذا لم يكن هناك زر محدد بـ showNextToLocation صراحة، نبحث عن أول زر مخصص متاح في صفحة أزرار الواتساب
  if (locationButtons.length === 0 && buttons.length > 0) {
    const candidate = buttons.find((b) => b.label?.includes("تبليغ") || b.label?.includes("مراسلة") || b.recipient !== "shop") || buttons[0];
    if (candidate) {
      locationButtons = [candidate];
    }
  }

  // 3. إذا لم تكن هناك أزرار إطلاقاً مسجلة، نضع زر تبليغ الزبون الافتراضي الفاخر
  if (locationButtons.length === 0) {
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

    // على الجوال نستخدم رابط whatsapp:// المباشر لتفادي شاشة "جاري البحث"
    // وعلى الحاسوب نستخدم wa.me كالعادة
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
              className={`group relative flex w-full h-[42px] max-h-[42px] items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-b from-[#F0B547] via-[#E8A525] to-[#D4850F] border border-[#C9A86A]/60 text-[#0A3D2E] font-black text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_3px_12px_rgba(212,133,15,0.28)] transition-all hover:shadow-[0_0_16px_rgba(232,165,37,0.45),0_3px_12px_rgba(212,133,15,0.32)] active:scale-[0.97] cursor-pointer overflow-hidden px-3 ${
                compact ? "text-[11px] py-1 px-2" : "text-[13px]"
              }`}
              title={btn.label}
            >
              <div
                className="absolute inset-0 opacity-[0.09] pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0 L11 7 L18 4 L12 10 L18 16 L11 13 L10 20 L9 13 L2 16 L8 10 L2 4 L9 7 Z' fill='white'/%3E%3C/svg%3E")`,
                }}
              />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
              {customImg ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={customImg}
                  alt={btn.label}
                  className="w-4 h-4 object-contain shrink-0 drop-shadow-sm pointer-events-none"
                />
              ) : (
                <span className="text-sm shrink-0">{btn.iconKey || "💬"}</span>
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

