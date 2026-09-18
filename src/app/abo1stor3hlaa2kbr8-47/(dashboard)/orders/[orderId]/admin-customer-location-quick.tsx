"use client";

import React, { useActionState, useRef, useState, useEffect } from "react";
import {
  type CustomerDoorPhotoState,
  uploadCustomerLocationFromView,
  pasteCustomerLocationFromView,
} from "./customer-door-photo-actions";
import { WaLocationCustomButtons, type WaButtonNextItem } from "@/components/wa-location-custom-buttons";
import { type OrderCardDesignerConfig, getElementStyle } from "@/lib/order-card-customizer";
import { whatsappMeUrl, openUrlFromUserGesture } from "@/lib/whatsapp";
import { PhoneActionModal } from "@/components/phone-action-modal";
import { applyMandoubWaTemplate, splitMandoubWaTemplateVariants } from "@/lib/mandoub-wa-button-template";

const initial: CustomerDoorPhotoState = {};

export function AdminCustomerLocationQuick({
  orderId,
  target = "first",
  customerPhone,
  customerPhone2,
  shopPhone,
  orderStatus,
  hasCustomerLocation,
  hasCourierUploadedLocation,
  userRole = "admin",
  templateVars,
  customButtons,
  designerConfig,
}: {
  orderId: string;
  target?: "first" | "second";
  customerPhone?: string;
  customerPhone2?: string;
  shopPhone?: string;
  orderStatus?: string;
  hasCustomerLocation?: boolean;
  hasCourierUploadedLocation?: boolean;
  userRole?: "admin" | "mandoub" | "staff";
  templateVars?: Record<string, string>;
  customButtons?: WaButtonNextItem[];
  designerConfig?: OrderCardDesignerConfig;
}) {
  const [gpsState, gpsAction, gpsPending] = useActionState(
    uploadCustomerLocationFromView.bind(null, orderId),
    initial,
  );
  const [pasteState, pasteAction, pastePending] = useActionState(
    pasteCustomerLocationFromView.bind(null, orderId),
    initial,
  );

  const [clientError, setClientError] = useState<string>("");
  const [locating, setLocating] = useState(false);
  const gpsFormRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  const [showPaste, setShowPaste] = useState(false);
  const [pastedUrl, setPastedUrl] = useState("");

  const [buttons, setButtons] = useState<WaButtonNextItem[]>(customButtons || []);
  const [activePhoneModal, setActivePhoneModal] = useState<{
    phone1: string;
    phone2?: string | null;
    messageText: string;
  } | null>(null);

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

  const isExistingLocation = Boolean(
    hasCustomerLocation ||
    (templateVars?.location_url && templateVars.location_url.trim() && templateVars.location_url !== "—")
  );

  const requestLocation = () => {
    setClientError("");
    if (!navigator.geolocation) {
      setClientError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!latRef.current || !lngRef.current || !gpsFormRef.current) return;
        setLocating(false);
        latRef.current.value = String(pos.coords.latitude);
        lngRef.current.value = String(pos.coords.longitude);
        gpsFormRef.current.requestSubmit();
      },
      () => {
        setLocating(false);
        setClientError("اسمح بالوصول للموقع ثم حاول مرة ثانية");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleRequestLocationWa = () => {
    const locBtn = buttons.find((b) => b.showNextToLocation);
    let messageText = "السلام عليكم، يرجى إرسال موقعك (اللوكيشن) لتوصيل طلبك 📍";

    if (locBtn && locBtn.templateText) {
      const variants = splitMandoubWaTemplateVariants(locBtn.templateText);
      const chosenTemplate = variants.length > 0 ? variants[Math.floor(Math.random() * variants.length)] : locBtn.templateText;
      messageText = applyMandoubWaTemplate(chosenTemplate, {
        ...(templateVars || {}),
        customer_phone: customerPhone || templateVars?.customer_phone || "",
        customer_phone2: customerPhone2 || templateVars?.customer_phone2 || "",
        shop_phone: shopPhone || templateVars?.shop_phone || "",
      });
    }

    const p1 = customerPhone || templateVars?.customer_phone || "";
    const p2 = customerPhone2 || templateVars?.customer_phone2 || "";

    if (p1 && p2 && p1.trim() !== p2.trim()) {
      setActivePhoneModal({
        phone1: p1,
        phone2: p2,
        messageText,
      });
      return;
    }

    const targetPhone = p1 || p2;
    if (!targetPhone) {
      setClientError("رقم هاتف الزبون غير متوفر لطلب الموقع");
      return;
    }

    const url = whatsappMeUrl(targetPhone, messageText);
    if (url && url !== "#") {
      openUrlFromUserGesture(url);
    } else {
      setClientError("تعذر فتح الواتساب");
    }
  };

  const pending = gpsPending || pastePending;
  const error = gpsState.error || pasteState.error || clientError;
  const ok = gpsState.ok || pasteState.ok;

  const uploadBtnCustom = designerConfig?.customerCard?.btnUploadLocation;
  const pasteBtnCustom = designerConfig?.customerCard?.btnPasteLocation;

  // فحص هل توجد أزرار واتساب مخصصة مفعلة بجانب اللوكيشن عند عدم وجود لوكيشن
  const missingLocWaButtons = buttons.filter((btn) => {
    if (!btn.showNextToLocation) return false;
    if (btn.customerLocationRule) {
      const rules = btn.customerLocationRule.split(",").map((s) => s.trim().toLowerCase());
      if (rules.includes("exists") || rules.includes("location") || rules.includes("has_location")) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className={isExistingLocation ? "w-full" : "mt-2 space-y-2 w-full"} dir="rtl">
      {/* نموذج الـ GPS المخفي */}
      <form ref={gpsFormRef} action={gpsAction} className="hidden">
        <input ref={latRef} type="hidden" name="lat" />
        <input ref={lngRef} type="hidden" name="lng" />
        <input type="hidden" name="target" value={target} />
      </form>

      {/* الحالة 1: يوجد لوكيشن للزبون -> لا تظهر أزرار طلب/رفع/لصق اللوكيشن، وتظهر فقط أزرار الواتساب المخصصة لوجود اللوكيشن مثل (تبليغ الزبون) */}
      {isExistingLocation ? (
        <div className="w-full flex items-center">
          <WaLocationCustomButtons
            userRole={userRole}
            customerPhone={customerPhone}
            customerPhone2={customerPhone2}
            shopPhone={shopPhone}
            orderStatus={orderStatus}
            hasCustomerLocation={true}
            hasCourierUploadedLocation={hasCourierUploadedLocation}
            templateVars={templateVars}
            customButtons={buttons}
            designerConfig={designerConfig}
          />
        </div>
      ) : (
        /* الحالة 2: لا يوجد لوكيشن للزبون -> تظهر أزرار رفع ولصق وطلب اللوكيشن */
        <div className="flex gap-[8px] items-center w-full">
          {/* الزر 1: رفع لوكيشن أوتوماتيكي (GPS) */}
          {!uploadBtnCustom?.hidden && (
            <div className="flex-1 min-w-0" style={getElementStyle(uploadBtnCustom)}>
              <button
                type="button"
                disabled={pending || locating}
                onClick={requestLocation}
                aria-busy={pending || locating}
                className="group relative w-full h-[44px] rounded-[12px] bg-gradient-to-b from-[#F0B547] via-[#E8A525] to-[#D4850F] border border-[#C9A86A]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_3px_12px_rgba(212,133,15,0.28)] active:scale-[0.97] transition-all hover:shadow-[0_0_16px_rgba(232,165,37,0.45),0_3px_12px_rgba(212,133,15,0.32)] overflow-hidden cursor-pointer"
              >
                <div
                  className="absolute inset-0 opacity-[0.09] pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0 L11 7 L18 4 L12 10 L18 16 L11 13 L10 20 L9 13 L2 16 L8 10 L2 4 L9 7 Z' fill='white'/%3E%3C/svg%3E")`,
                  }}
                />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                <span className="relative flex flex-col items-center justify-center gap-[1px] leading-none px-[2px] text-center">
                  <span className="flex items-center gap-[3px] text-[11px] font-black text-[#0A3D2E] tracking-tight">
                    <span className="text-[11px]">📍</span>
                    <span>{locating ? "جارٍ الجلب…" : gpsPending ? "جارٍ الحفظ…" : "رفع لوكيشن"}</span>
                  </span>
                  <span className="text-[10px] font-black text-[#0A3D2E]/80 tracking-wide">(GPS)</span>
                </span>
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
              </button>
            </div>
          )}

          {/* الزر 2: لصق لوكيشن */}
          {!pasteBtnCustom?.hidden && (
            <div className="flex-1 min-w-0" style={getElementStyle(pasteBtnCustom)}>
              <button
                type="button"
                disabled={pending || locating}
                onClick={() => {
                  setShowPaste(!showPaste);
                  setClientError("");
                }}
                className="group relative w-full h-[44px] rounded-[12px] bg-gradient-to-b from-[#F0B547] via-[#E8A525] to-[#D4850F] border border-[#C9A86A]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_3px_12px_rgba(212,133,15,0.28)] active:scale-[0.97] transition-all hover:shadow-[0_0_16px_rgba(232,165,37,0.45),0_3px_12px_rgba(212,133,15,0.32)] overflow-hidden cursor-pointer"
              >
                <div
                  className="absolute inset-0 opacity-[0.09] pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0 L11 7 L18 4 L12 10 L18 16 L11 13 L10 20 L9 13 L2 16 L8 10 L2 4 L9 7 Z' fill='white'/%3E%3C/svg%3E")`,
                  }}
                />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                <span className="relative flex items-center justify-center gap-1 text-center px-1">
                  <span className="text-[12px]">📋</span>
                  <span className="text-[12px] font-black text-[#0A3D2E] leading-none">لصق لوكيشن</span>
                </span>
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
              </button>
            </div>
          )}

          {/* الزر 3: طلب لوكيشن (أزرار الواتساب المخصصة إن وجدت، أو الزر الافتراضي) */}
          <div className="flex-1 min-w-0">
            {missingLocWaButtons.length > 0 ? (
              <WaLocationCustomButtons
                userRole={userRole}
                customerPhone={customerPhone}
                customerPhone2={customerPhone2}
                shopPhone={shopPhone}
                orderStatus={orderStatus}
                hasCustomerLocation={false}
                hasCourierUploadedLocation={hasCourierUploadedLocation}
                templateVars={templateVars}
                customButtons={buttons}
                designerConfig={designerConfig}
              />
            ) : (
              <button
                type="button"
                onClick={handleRequestLocationWa}
                className="group relative w-full h-[44px] rounded-[12px] bg-gradient-to-b from-[#E8A525] via-[#D4850F] to-[#B86D0A] border border-[#9C7D46]/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_14px_rgba(184,109,10,0.32)] active:scale-[0.97] transition-all hover:shadow-[0_0_18px_rgba(212,133,15,0.5),0_4px_14px_rgba(184,109,10,0.38)] overflow-hidden cursor-pointer"
              >
                <div
                  className="absolute inset-0 opacity-[0.10] pointer-events-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 0 L11 7 L18 4 L12 10 L18 16 L11 13 L10 20 L9 13 L2 16 L8 10 L2 4 L9 7 Z' fill='white'/%3E%3C/svg%3E")`,
                  }}
                />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                <span className="relative flex items-center justify-center gap-1 text-center px-1">
                  <span className="text-[12px] font-black text-[#0A3D2E] leading-none">طلب لوكيشن</span>
                  <span className="text-[12px]">💬</span>
                </span>
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                <span className="absolute inset-[1px] rounded-[11px] border border-white/20 pointer-events-none" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* نموذج لصق الرابط الملكي المذهب */}
      {showPaste && (
        <form
          action={pasteAction}
          className="mt-2.5 p-3 rounded-[16px] bg-gradient-to-b from-[#FFFEFB] to-[#FDF6E3] border-[1.5px] border-[#C9A86A]/70 shadow-[0_4px_18px_rgba(201,168,106,0.25)] space-y-2 animate-in slide-in-from-top-1 duration-200"
        >
          <input type="hidden" name="target" value={target} />
          <div className="flex gap-2 items-center">
            <input
              type="text"
              name="locationUrl"
              value={pastedUrl}
              onChange={(e) => setPastedUrl(e.target.value)}
              placeholder="الصق رابط خرائط قوقل ماب هنا..."
              className="flex-1 min-h-[40px] rounded-[10px] border border-[#C9A86A]/60 bg-white text-[#0A3D2E] px-3 text-xs font-bold outline-none focus:border-[#0A3D2E] shadow-inner transition-all text-right [direction:ltr]"
              required
            />
            <button
              type="submit"
              disabled={pending}
              className="px-4 min-h-[40px] rounded-[10px] gold-grad border border-[#9C7D46]/40 text-[#0A3D2E] text-xs font-black shadow-[0_2px_8px_rgba(201,168,106,0.35)] hover:scale-105 active:scale-95 transition disabled:opacity-40 cursor-pointer"
            >
              {pastePending ? "حفظ…" : "حفظ الرابط"}
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p className="text-xs font-black text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-300 text-center">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="text-xs font-black text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-300 text-center">
          تم تحديث لوكيشن الزبون بنجاح ✨
        </p>
      ) : null}

      {/* مودال اختيار الرقم عند إرسال طلب الواتساب */}
      {activePhoneModal && (
        <PhoneActionModal
          type="whatsapp"
          phone1={activePhoneModal.phone1}
          phone2={activePhoneModal.phone2}
          messageText={activePhoneModal.messageText}
          onClose={() => setActivePhoneModal(null)}
        />
      )}
    </div>
  );
}
