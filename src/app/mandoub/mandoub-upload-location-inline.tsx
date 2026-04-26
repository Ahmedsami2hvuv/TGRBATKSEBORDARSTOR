"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appendMandoubLocFlash } from "@/lib/mandoub-loc-flash-url";
import {
  setMandoubCustomerLocationFromGeolocation,
  type MandoubEditCustomerState,
} from "./actions";

const initial: MandoubEditCustomerState = {};

function IconMapPin() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

/**
 * رفع لوكيشن الزبون من موقع المندوب الحالي — يُعرض مكان خانة اللوكيشن عندما لا يوجد رابط بعد.
 */
export function MandoubUploadLocationInline({
  orderId,
  auth,
  nextUrl,
}: {
  orderId: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
}) {
  const [state, formAction, pending] = useActionState(
    setMandoubCustomerLocationFromGeolocation,
    initial,
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const [permHint, setPermHint] = useState<string | null>(null);
  /** أثناء انتظار GPS — قبل بدء إرسال النموذج للخادم */
  const [locating, setLocating] = useState(false);

  const router = useRouter();
  const [, startTransition] = useTransition();
  const navDone = useRef(false);

  useEffect(() => {
    if (pending) navDone.current = false;
  }, [pending]);

  useEffect(() => {
    if (!state.ok || state.flash !== "saved") return;
    if (navDone.current) return;
    navDone.current = true;
    startTransition(() => {
      router.replace(appendMandoubLocFlash(nextUrl, "saved"));
    });
  }, [state, nextUrl, router, startTransition]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const perm = (
          navigator as Navigator & {
            permissions?: { query: (q: { name: string }) => Promise<PermissionStatus> };
          }
        ).permissions?.query({ name: "geolocation" });
        if (!perm) return;
        const status = await perm;
        if (cancelled) return;
        if (status.state === "denied") {
          setPermHint("إذن الموقع مرفوض — افتح إعدادات المتصفح واسمح بالموقع لهذا الموقع.");
        }
      } catch {
        /* Permissions API غير مدعوم */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onUploadLocation = () => {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("المتصفح لا يدعم تحديد الموقع.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const fd = new FormData();
        fd.set("orderId", orderId);
        fd.set("next", nextUrl);
        fd.set("c", auth.c);
        fd.set("exp", auth.exp);
        fd.set("s", auth.s);
        fd.set("lat", String(pos.coords.latitude));
        fd.set("lng", String(pos.coords.longitude));
        formAction(fd);
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

  const err = state.error ?? geoError;

  return (
    <div className="flex w-full max-w-md flex-col gap-2" dir="rtl">
      {permHint ? (
        <p className="rounded-xl border border-amber-300/90 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 shadow-sm">
          {permHint}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-xl border border-rose-300/90 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-900 shadow-sm">
          {err}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onUploadLocation}
        disabled={pending || locating}
        aria-busy={pending || locating}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-black text-white shadow-md ring-2 ring-white/30 transition hover:from-amber-600 hover:to-orange-700 disabled:cursor-wait disabled:opacity-70"
        title="رفع موقعك الحالي كلوكيشن للزبون — يظهر طلب إذن الموقع من المتصفح"
      >
        <IconMapPin />
        {locating
          ? "جارٍ جلب الموقع…"
          : pending
            ? "جارٍ الحفظ…"
            : "رفع لوكيشن (GPS)"}
      </button>
    </div>
  );
}
