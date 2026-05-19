"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appendMandoubLocFlash } from "@/lib/mandoub-loc-flash-url";
import {
  clearMandoubCustomerLocation,
  setMandoubCustomerLocationFromGeolocation,
  type MandoubEditCustomerState,
} from "./actions";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

const initial: MandoubEditCustomerState = {};

/**
 * عندما يوجد لوكيشن للزبون: مسح الرابط أو استبداله بموقع GPS الحالي (بعد تأكيد).
 */
export function MandoubLocationManageButtons({
  orderId,
  auth,
  nextUrl,
}: {
  orderId: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
}) {
  const [clearState, clearAction, clearPending] = useActionState(
    clearMandoubCustomerLocation,
    initial,
  );
  const [gpsState, gpsAction, gpsPending] = useActionState(
    setMandoubCustomerLocationFromGeolocation,
    initial,
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  /** أثناء انتظار GPS قبل إرسال الاستبدال للخادم */
  const [locating, setLocating] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const router = useRouter();
  const [, startTransition] = useTransition();
  const clearNavDone = useRef(false);
  const gpsNavDone = useRef(false);

  /** بدل `redirect` من الخادم — يتجنّب تعليق الواجهة وفقدان `c`/`s` على بعض الأجهزة */
  useEffect(() => {
    if (clearPending) clearNavDone.current = false;
  }, [clearPending]);
  useEffect(() => {
    if (gpsPending) gpsNavDone.current = false;
  }, [gpsPending]);

  useEffect(() => {
    if (!clearState.ok || clearState.flash !== "cleared") return;
    if (clearNavDone.current) return;
    clearNavDone.current = true;
    const url = appendMandoubLocFlash(nextUrl, "cleared");
    startTransition(() => {
      router.replace(url);
    });
  }, [clearState, nextUrl, router, startTransition]);

  useEffect(() => {
    if (!gpsState.ok || gpsState.flash !== "saved") return;
    if (gpsNavDone.current) return;
    gpsNavDone.current = true;
    const url = appendMandoubLocFlash(nextUrl, "saved");
    startTransition(() => {
      router.replace(url);
    });
  }, [gpsState, nextUrl, router, startTransition]);

  const pending = clearPending || gpsPending || locating;

  const onClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setConfirmReplace(false);
      return;
    }

    setConfirmClear(false);
    const fd = new FormData();
    fd.set("orderId", orderId);
    fd.set("next", nextUrl);
    fd.set("c", auth.c);
    fd.set("exp", auth.exp);
    fd.set("s", auth.s);
    clearAction(fd);
  };

  const onReplace = () => {
    if (!confirmReplace) {
      setConfirmReplace(true);
      setConfirmClear(false);
      return;
    }
    setConfirmReplace(false);
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("المتصفح لا يدعم تحديد الموقع.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = String(pos.coords.latitude);
        const lng = String(pos.coords.longitude);

        const fd = new FormData();
        fd.set("orderId", orderId);
        fd.set("next", nextUrl);
        fd.set("c", auth.c);
        fd.set("exp", auth.exp);
        fd.set("s", auth.s);
        fd.set("lat", lat);
        fd.set("lng", lng);
        fd.set("replace", "1");
        gpsAction(fd);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setGeoError(
            "تم رفض إذن الموقع. اسمح بالوصول من شريط العنوان أو إعدادات المتصفح ثم أعد المحاولة.",
          );
        } else if (err.code === 2) {
          setGeoError("تعذّر تحديد الموقع. تأكد من تشغيل GPS ثم أعد المحاولة.");
        } else if (err.code === 3) {
          setGeoError("انتهت مهلة تحديد الموقع. أعد المحاولة في مكان مفتوح.");
        } else {
          setGeoError("تعذّر تحديد الموقع.");
        }
      },
      { enableHighAccuracy: true, timeout: 22000, maximumAge: 0 },
    );
  };

  const err = clearState.error ?? gpsState.error ?? geoError;

  return (
    <div className="mt-2 flex w-full max-w-md flex-col gap-2" dir="rtl">
      {err ? (
        <p className="rounded-xl border border-rose-300/90 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900 shadow-sm">
          {err}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            aria-busy={clearPending}
            className={`min-h-[44px] w-full rounded-xl border-2 px-3 py-2 text-sm font-black transition disabled:cursor-wait disabled:opacity-70 ${
              confirmClear
                ? "border-rose-600 bg-rose-600 text-white animate-pulse"
                : "border-rose-300 bg-white text-rose-900 hover:bg-rose-50"
            }`}
          >
            {clearPending
              ? "جارٍ المسح…"
              : confirmClear
                ? "تأكيد المسح؟"
                : "مسح اللوكيشن"}
          </button>
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="text-[10px] font-bold text-rose-600 underline"
            >
              إلغاء
            </button>
          )}
        </div>

        <div className="flex flex-[1.2] flex-col gap-1">
          <button
            type="button"
            onClick={onReplace}
            disabled={pending}
            aria-busy={locating || gpsPending}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-black shadow-md ring-2 ring-white/30 transition disabled:cursor-wait disabled:opacity-70 ${
              confirmReplace
                ? "border-orange-600 bg-orange-600 text-white animate-pulse"
                : "border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
            }`}
            title="استبدال الرابط الحالي بموقعك GPS — يطلب إذن الموقع"
          >
            <DynamicIcon
              iconKey="ui_gps"
              config={icons}
              className="h-5 w-5 shrink-0"
              fallback={
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              }
            />
            {locating
              ? "جارٍ جلب الموقع…"
              : gpsPending
                ? "جارٍ الحفظ…"
                : confirmReplace
                  ? "تأكيد التبديل؟"
                  : "تبديل الموقع (GPS)"}
          </button>
          {confirmReplace && (
            <button
              onClick={() => setConfirmReplace(false)}
              className="text-[10px] font-bold text-orange-700 underline"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
