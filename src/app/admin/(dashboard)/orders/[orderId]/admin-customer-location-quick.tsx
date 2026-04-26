"use client";

import { useActionState, useRef, useState } from "react";
import {
  type CustomerDoorPhotoState,
  uploadCustomerLocationFromView,
} from "./customer-door-photo-actions";

const initial: CustomerDoorPhotoState = {};

function IconMapPin() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

export function AdminCustomerLocationQuick({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(
    uploadCustomerLocationFromView.bind(null, orderId),
    initial,
  );
  const [clientError, setClientError] = useState<string>("");
  const [locating, setLocating] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  const requestLocation = () => {
    setClientError("");
    if (!navigator.geolocation) {
      setClientError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!latRef.current || !lngRef.current || !formRef.current) return;
        setLocating(false);
        latRef.current.value = String(pos.coords.latitude);
        lngRef.current.value = String(pos.coords.longitude);
        formRef.current.requestSubmit();
      },
      () => {
        setLocating(false);
        setClientError("اسمح بالوصول للموقع ثم حاول مرة ثانية");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <form ref={formRef} action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input ref={latRef} type="hidden" name="lat" />
      <input ref={lngRef} type="hidden" name="lng" />
      <button
        type="button"
        disabled={pending || locating}
        onClick={requestLocation}
        aria-busy={pending || locating}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-black text-white shadow-md ring-2 ring-white/30 transition hover:from-amber-600 hover:to-orange-700 disabled:cursor-wait disabled:opacity-70"
      >
        <IconMapPin />
        {locating ? "جارٍ جلب الموقع…" : pending ? "جارٍ الحفظ…" : "رفع لوكيشن (GPS)"}
      </button>
      {clientError ? <p className="text-xs font-medium text-rose-600">{clientError}</p> : null}
      {state.error ? <p className="text-xs font-medium text-rose-600">{state.error}</p> : null}
      {state.ok ? <p className="text-xs font-medium text-emerald-700">تم تحديث لوكيشن الزبون</p> : null}
    </form>
  );
}

