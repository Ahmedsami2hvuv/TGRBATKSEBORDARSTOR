"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SEND_INTERVAL_MS = 20_000;
const STALE_AFTER_MS = 3 * 60_000;
const STALENESS_CHECK_MS = 1_000;

const GEO_OPTS_BACKGROUND: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 120_000,
  timeout: 25_000,
};

const GEO_OPTS_CHECK: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 0,
  timeout: 10_000,
};

const LOCK_MESSAGE = "لم يصل الموقع إلى الإدارة منذ أكثر من 3 دقائق. افحص الموقع الآن.";

const CHECK_MESSAGE = "إذا لم يصل الموقع خلال 20 ثانية، تأكد من تشغيل GPS ومنح إذن الموقع ثم اضغط فحص.";

const PERMISSION_DENIED_MESSAGE =
  "سماح الموقع مرفوض. افتح إعدادات المتصفح أو الجهاز ثم امنح إذن الموقع. بعد ذلك اضغط فحص.";

type MandoubProps = {
  variant: "mandoub";
  c: string;
  exp: string;
  s: string;
  children: React.ReactNode;
};

type PreparerProps = {
  variant: "preparer";
  p: string;
  exp: string;
  s: string;
  children: React.ReactNode;
};

type EmployeeProps = {
  variant: "employee";
  e: string;
  exp: string;
  s: string;
  children: React.ReactNode;
};

type StaffProps = {
  variant: "staff";
  children: React.ReactNode;
};

export type PortalLocationHeartbeatProps = MandoubProps | PreparerProps | EmployeeProps | StaffProps;

/**
 * يحاول إرسال موقع الموظف / المندوب / المجهز كل ~20 ثانية إلى الإدارة.
 * إذا اختفى الموقع أو رفض إذن الموقع، يعرض تعليمات واضحة للفحص.
 */
export function PortalLocationHeartbeat(props: PortalLocationHeartbeatProps) {
  const { children } = props;
  const propsRef = useRef(props);
  propsRef.current = props;

  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [locationAlert, setLocationAlert] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const lastSuccessfulPostMsRef = useRef<number | null>(null);
  const lastLocalGeoMsRef = useRef<number | null>(null);
  const lastSentMsRef = useRef<number | null>(null);
  const sessionStartMsRef = useRef(Date.now());
  const lockedRef = useRef(false);
  lockedRef.current = locked;
  const watchIdRef = useRef<number | null>(null);

  const postToServer = useCallback(
    async (lat: number, lng: number): Promise<boolean> => {
      const p = propsRef.current;
      if (p.variant === "mandoub") {
        const r = await fetch("/api/courier/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            c: p.c,
            ...(p.exp.trim() ? { exp: p.exp.trim() } : {}),
            s: p.s,
            lat,
            lng,
          }),
        });
        return r.ok;
      }
      if (p.variant === "employee") {
        const r = await fetch("/api/employee/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            e: p.e,
            ...(p.exp.trim() ? { exp: p.exp.trim() } : {}),
            s: p.s,
            lat,
            lng,
          }),
        });
        return r.ok;
      }
      if (p.variant === "staff") {
        const r = await fetch("/api/staff/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });
        return r.ok;
      }
      const r = await fetch("/api/preparer/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p: p.p,
          ...(p.exp.trim() ? { exp: p.exp.trim() } : {}),
          s: p.s,
          lat,
          lng,
        }),
      });
      return r.ok;
    },
    [],
  );

  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      setPermissionDenied(true);
      setLocationAlert(PERMISSION_DENIED_MESSAGE);
      return;
    }

    if (error.code === error.POSITION_UNAVAILABLE) {
      setLocationAlert(
        "الموقع غير متوفر حالياً. تأكد من تشغيل GPS والانتظار قليلاً ثم اضغط فحص.",
      );
      return;
    }

    setLocationAlert("لم يتم الحصول على الموقع. افتح الموقع ثم اضغط فحص.");
  }, []);

  const handlePositionSuccess = useCallback(
    (pos: GeolocationPosition) => {
      lastLocalGeoMsRef.current = Date.now();
      setLocationAlert(null);
      setPermissionDenied(false);

      const now = Date.now();
      const lastSent = lastSentMsRef.current;
      if (lastSent == null || now - lastSent >= SEND_INTERVAL_MS) {
        lastSentMsRef.current = now;
        void (async () => {
          const ok = await postToServer(pos.coords.latitude, pos.coords.longitude);
          if (ok) {
            lastSuccessfulPostMsRef.current = Date.now();
            setLocked(false);
          }
        })();
      }
    },
    [postToServer],
  );

  const startGeolocationWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionDenied(true);
      setLocationAlert("المتصفح لا يدعم الموقع. افتح التطبيق على جهاز يدعم تتبع الموقع.");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      GEO_OPTS_BACKGROUND,
    );
    watchIdRef.current = id;
  }, [handlePositionError, handlePositionSuccess]);

  const requestInitialLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      handlePositionSuccess,
      handlePositionError,
      GEO_OPTS_CHECK,
    );
  }, [handlePositionError, handlePositionSuccess]);

  useEffect(() => {
    if (locked) return;
    void (async () => {
      if (navigator.permissions?.query) {
        try {
          const st = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });
          if (st.state === "denied") {
            setLocationAlert(PERMISSION_DENIED_MESSAGE);
            setPermissionDenied(true);
          }
        } catch {
          /* */
        }
      }
    })();

    startGeolocationWatch();
    requestInitialLocation();

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [locked, requestInitialLocation, startGeolocationWatch]);

  useEffect(() => {
    if (locked) return;
    const id = window.setInterval(() => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return;

      const now = Date.now();
      const lastLocal = lastLocalGeoMsRef.current;
      if (lastLocal == null) {
        if (now - sessionStartMsRef.current >= SEND_INTERVAL_MS) {
          setLocationAlert(CHECK_MESSAGE);
        }
      } else if (now - lastLocal >= SEND_INTERVAL_MS + 5_000) {
        setLocationAlert(CHECK_MESSAGE);
      }

      navigator.geolocation.getCurrentPosition(
        handlePositionSuccess,
        handlePositionError,
        GEO_OPTS_BACKGROUND,
      );
    }, SEND_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [handlePositionError, handlePositionSuccess, locked]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const lastOk = lastSuccessfulPostMsRef.current;
      const now = Date.now();
      if (lastOk == null) {
        if (now - sessionStartMsRef.current > STALE_AFTER_MS) {
          setLocked(true);
        }
      } else if (now - lastOk > STALE_AFTER_MS) {
        setLocked(true);
      }
    }, STALENESS_CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  const onCheckClick = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    void (async () => {
      setChecking(true);
      try {
        if (navigator.permissions?.query) {
          const st = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });
          if (st.state === "denied") {
            setLocationAlert(PERMISSION_DENIED_MESSAGE);
            setPermissionDenied(true);
            return;
          }
        }
      } catch {
        /* */
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void (async () => {
            try {
              const ok = await postToServer(pos.coords.latitude, pos.coords.longitude);
              if (ok) {
                lastSuccessfulPostMsRef.current = Date.now();
                lastLocalGeoMsRef.current = Date.now();
                setLocked(false);
                setLocationAlert(null);
                setPermissionDenied(false);
              }
            } finally {
              setChecking(false);
            }
          })();
        },
        (error) => {
          handlePositionError(error);
          setChecking(false);
        },
        GEO_OPTS_CHECK,
      );
    })();
  }, [handlePositionError, postToServer]);

  return (
    <div className={locked ? "min-h-[100dvh] pb-24" : undefined}>
      {children}
      {(locked || locationAlert) ? (
        <div
          className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-slate-950/97 px-4 text-center text-white"
          dir="rtl"
          role="alertdialog"
          aria-modal="true"
          aria-label="فحص الموقع"
        >
          <p className="mb-6 max-w-md text-base font-semibold leading-relaxed text-slate-200">
            {locked ? LOCK_MESSAGE : locationAlert}
          </p>
          <button
            type="button"
            onClick={onCheckClick}
            disabled={checking}
            className="rounded-2xl bg-emerald-500 px-10 py-4 text-lg font-black text-white shadow-xl ring-2 ring-emerald-300/60 hover:bg-emerald-400 disabled:opacity-60"
          >
            {checking ? "جارٍ الفحص…" : "فحص الموقع الآن"}
          </button>
          {permissionDenied ? (
            <p className="mt-4 max-w-md text-sm text-amber-200">
              إذا بقيت المشكلة بعد الضغط على فحص، افتح إعدادات المتصفح أو الجهاز وامنح إذن الموقع.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
