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
      const rules = btn.customerLocationRule.split(",").map((s) => s.trim()).filter(Boolean);
      if (rules.length > 0 && !rules.includes("any")) {
        let ok = false;
        if (rules.includes("exists") && (hasCustomerLocation || hasCourierUploadedLocation)) ok = true;
        if (rules.includes("missing") && !hasCustomerLocation && !hasCourierUploadedLocation) ok = true;
        if (rules.includes("courier_gps") && hasCourierUploadedLocation) ok = true;
        if (!ok) return false;
      }
    }

    return true;
  });

  if (locationButtons.length === 0) {
    return null;
  }

  const handleButtonClick = (btn: WaButtonNextItem) => {
    const variants = splitMandoubWaTemplateVariants(btn.templateText || "");
    if (variants.length <= 1) {
      // نموذج واحد مباشر
      sendWaMessage(btn, variants[0] || "");
    } else {
      // فتح قائمة النماذج المتاحة
      setOpenModalBtnId(openModalBtnId === btn.id ? null : btn.id);
    }
  };

  const sendWaMessage = (btn: WaButtonNextItem, rawTemplate: string) => {
    setOpenModalBtnId(null);
    const targetPhone =
      btn.recipient === "customer2" && customerPhone2
        ? customerPhone2
        : btn.recipient === "shop" && shopPhone
        ? shopPhone
        : customerPhone || templateVars.customer_phone || "";

    const text = applyMandoubWaTemplate(rawTemplate, {
      ...templateVars,
      customer_phone: customerPhone || templateVars.customer_phone || "",
      customer_phone2: customerPhone2 || templateVars.customer_phone2 || "",
      shop_phone: shopPhone || templateVars.shop_phone || "",
    });

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
        const variants = splitMandoubWaTemplateVariants(btn.templateText || "");
        const isMenuOpen = openModalBtnId === btn.id;

        return (
          <div key={btn.id} className="relative inline-block w-full">
            <button
              type="button"
              onClick={() => handleButtonClick(btn)}
              className={`flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-600 to-teal-700 px-3 py-2 text-xs font-black text-white shadow-md transition hover:from-emerald-700 hover:to-teal-800 active:scale-95 ${
                compact ? "text-[11px] py-1.5 px-2" : ""
              }`}
              title={btn.label}
            >
              <span className="text-sm shrink-0">{btn.iconKey || "📍"}</span>
              <span className="truncate">{btn.label}</span>
              {variants.length > 1 && (
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">
                  {variants.length}
                </span>
              )}
            </button>

            {/* قائمة النماذج إذا كانت متعددة */}
            {isMenuOpen && variants.length > 1 && (
              <div className="absolute top-full right-0 left-0 z-50 mt-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900 animate-in fade-in-50 zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-1.5 mb-1.5 px-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    اختر صيغة النموذج ({btn.label}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenModalBtnId(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {variants.map((vText, idx) => {
                    const previewText = applyMandoubWaTemplate(vText, {
                      ...templateVars,
                      customer_phone: customerPhone || templateVars.customer_phone || "",
                    });
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => sendWaMessage(btn, vText)}
                        className="w-full text-right p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-100 dark:border-white/5 transition flex flex-col gap-0.5"
                      >
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          صيغة رقم {idx + 1}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {previewText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
