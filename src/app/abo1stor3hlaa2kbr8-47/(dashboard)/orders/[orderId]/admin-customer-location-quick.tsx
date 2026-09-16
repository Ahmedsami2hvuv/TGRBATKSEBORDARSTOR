"use client";

import { useActionState, useRef, useState } from "react";
import {
  type CustomerDoorPhotoState,
  uploadCustomerLocationFromView,
  pasteCustomerLocationFromView,
} from "./customer-door-photo-actions";

const initial: CustomerDoorPhotoState = {};

function IconMapPin() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

import { WaLocationCustomButtons, type WaButtonNextItem } from "@/components/wa-location-custom-buttons";
import { type OrderCardDesignerConfig, getElementStyle } from "@/lib/order-card-customizer";

export function AdminCustomerLocationQuick({
  orderId,
  target = "first",
  customerPhone,
  customerPhone2,
  shopPhone,
  orderStatus,
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

  const pending = gpsPending || pastePending;
  const error = gpsState.error || pasteState.error || clientError;
  const ok = gpsState.ok || pasteState.ok;

  const uploadBtnCustom = designerConfig?.customerCard?.btnUploadLocation;
  const pasteBtnCustom = designerConfig?.customerCard?.btnPasteLocation;

  return (
    <div className="mt-2 space-y-2 w-full">
      {/* Hidden GPS form */}
      <form ref={gpsFormRef} action={gpsAction} className="hidden">
        <input ref={latRef} type="hidden" name="lat" />
        <input ref={lngRef} type="hidden" name="lng" />
        <input type="hidden" name="target" value={target} />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {!uploadBtnCustom?.hidden && (
          <div className="flex-1 min-w-[120px]" style={getElementStyle(uploadBtnCustom)}>
            <button
              type="button"
              disabled={pending || locating}
              onClick={requestLocation}
              aria-busy={pending || locating}
              className="w-full flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#B45309] to-[#78350F] px-2.5 py-2 text-xs font-black text-[#F5D77F] shadow-md transition hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-70 cursor-pointer"
            >
              {uploadBtnCustom?.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={uploadBtnCustom.imageUrl} alt="GPS" className="w-5 h-5 object-contain shrink-0 pointer-events-none" />
              ) : (
                <IconMapPin />
              )}
              <span>{locating ? "جارٍ جلب الموقع…" : gpsPending ? "جارٍ الحفظ…" : "رفع لوكيشن (GPS)"}</span>
            </button>
          </div>
        )}

        {!pasteBtnCustom?.hidden && (
          <div className="flex-1 min-w-[110px]" style={getElementStyle(pasteBtnCustom)}>
            <button
              type="button"
              disabled={pending || locating}
              onClick={() => {
                setShowPaste(!showPaste);
                setClientError("");
              }}
              className={`w-full flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#C9A86A] px-2.5 py-2 text-xs font-black shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-70 cursor-pointer ${
                showPaste 
                  ? "bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] text-[#F5D77F]" 
                  : "bg-gradient-to-r from-[#06281D] to-[#0A3D2E] text-[#FFF8F0]"
              }`}
            >
              {pasteBtnCustom?.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={pasteBtnCustom.imageUrl} alt="Link" className="w-5 h-5 object-contain shrink-0 pointer-events-none" />
              ) : (
                <IconLink />
              )}
              <span>لصق لكيشن</span>
            </button>
          </div>
        )}

        {/* أزرار الواتساب المخصصة للموقع (طلب لوكيشن) */}
        <div className="flex-1 min-w-[120px]">
          <WaLocationCustomButtons
            userRole="admin"
            customerPhone={customerPhone}
            customerPhone2={customerPhone2}
            shopPhone={shopPhone}
            orderStatus={orderStatus}
            templateVars={templateVars}
            customButtons={customButtons}
            designerConfig={designerConfig}
          />
        </div>
      </div>

      {showPaste && (
        <form action={pasteAction} className="mt-2 p-3 bg-[#06281D]/90 rounded-2xl border-2 border-[#C9A86A]/70 space-y-2 animate-in slide-in-from-top-1 duration-200 shadow-xl">
          <input type="hidden" name="target" value={target} />
          <div className="flex gap-2">
            <input
              type="text"
              name="locationUrl"
              value={pastedUrl}
              onChange={(e) => setPastedUrl(e.target.value)}
              placeholder="الصق رابط لوكيشن قوقل ماب هنا..."
              className="flex-1 min-h-[40px] rounded-xl border border-[#C9A86A]/60 bg-[#0A1A18] text-[#F5D77F] px-3 text-xs font-bold outline-none focus:border-[#F5D77F] font-mono transition-all text-right [direction:ltr]"
              required
            />
            <button
              type="submit"
              disabled={pending}
              className="px-5 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] text-[#F5D77F] text-xs font-black shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-40 cursor-pointer"
            >
              {pastePending ? "حفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      )}

      {error ? <p className="text-xs font-black text-rose-400 bg-rose-950/60 p-1.5 rounded-lg border border-rose-500/40 text-center">{error}</p> : null}
      {ok ? <p className="text-xs font-black text-emerald-400 bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-500/40 text-center">تم تحديث لوكيشن الزبون بنجاح</p> : null}
    </div>
  );
}
