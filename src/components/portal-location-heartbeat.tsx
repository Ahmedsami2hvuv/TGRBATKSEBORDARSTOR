"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SEND_INTERVAL_MS = 20_000;
const STALE_AFTER_MS = 3 * 60_000;
const STALENESS_CHECK_MS = 1_000;

const GEO_OPTS_BACKGROUND: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30_000,
};

const GEO_OPTS_CHECK: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30_000,
};

const LOCK_MESSAGE =
  "لم يصل موقعك إلى الإدارة منذ أكثر من 3 دقائق. تأكد أن GPS يعمل، ثم اضغط فحص الموقع الآن.";

const CHECK_MESSAGE =
  "لم يتم إرسال الموقع بعد. تأكد من تشغيل GPS، ومنح إذن الموقع للمتصفح، ثم اضغط فحص الموقع الآن.";

const PERMISSION_DENIED_MESSAGE =
  "إذن الموقع مرفوض. افتح إعدادات المتصفح أو الجهاز، وفعل إذن الموقع لهذه الصفحة، ثم اضغط فحص الموقع الآن.";

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

export type PortalLocationHeartbeatProps = (MandoubProps | PreparerProps | EmployeeProps | StaffProps) & {
  globalEnabled?: boolean;
};

/**
 * يحاول إرسال موقع الموظف / المندوب / المجهز كل ~20 ثانية إلى الإدارة.
 * إذا اختفى الموقع أو رفض إذن الموقع، يعرض تعليمات واضحة للفحص.
 */
export function PortalLocationHeartbeat(props: PortalLocationHeartbeatProps) {
  const { children, globalEnabled = true } = props;
  const propsRef = useRef(props);
  propsRef.current = props;

  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [locationAlert, setLocationAlert] = useState<string>(
    "جارٍ محاولة الحصول على الموقع الآن. إذا لم تظهر نافذة طلب الإذن أو لم يصل الموقع خلال 20 ثانية، اضغط فحص الموقع الآن.",
  );
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

  const setAlertMessage = useCallback((message: string, denied = false) => {
    setLocationAlert(message);
    setPermissionDenied(denied);
  }, []);

  const handlePositionError = useCallback(
    (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setAlertMessage(PERMISSION_DENIED_MESSAGE, true);
        return;
      }

      if (error.code === error.POSITION_UNAVAILABLE) {
        setAlertMessage(
          "الموقع غير متوفر حالياً. افتح إعدادات الموقع وتأكد من تشغيل GPS ثم اضغط فحص الموقع الآن.",
        );
        return;
      }

      setAlertMessage(
        "فشل الحصول على الموقع. تأكد من تشغيل GPS ومنح الإذن للموقع ثم اضغط فحص الموقع الآن.",
      );
    },
    [setAlertMessage],
  );

  const handlePositionSuccess = useCallback(
    (pos: GeolocationPosition) => {
      lastLocalGeoMsRef.current = Date.now();
      setAlertMessage("الموقع موجود. يتم الإرسال إلى الإدارة الآن.");
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
            setLocationAlert(null);
          } else {
            setAlertMessage(
              "فشل إرسال الموقع. تأكد من الإنترنت ثم اضغط فحص.",
            );
          }
        })();
      }
    },
    [postToServer, setAlertMessage],
  );

  const startGeolocationWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAlertMessage(
        "المتصفح لا يدعم الموقع. افتح التطبيق على جهاز يدعم تتبع الموقع.",
        true,
      );
      return;
    }

    const id = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      GEO_OPTS_BACKGROUND,
    );
    watchIdRef.current = id;
  }, [handlePositionError, handlePositionSuccess, setAlertMessage]);

  const requestInitialLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      handlePositionSuccess,
      handlePositionError,
      GEO_OPTS_CHECK,
    );
  }, [handlePositionError, handlePositionSuccess]);

  useEffect(() => {
    if (!globalEnabled) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (locked) return;

    void (async () => {
      if (navigator.permissions?.query) {
        try {
          const st = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });
          if (st.state === "denied") {
            setAlertMessage(PERMISSION_DENIED_MESSAGE, true);
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
  }, [locked, requestInitialLocation, startGeolocationWatch, setAlertMessage]);

  useEffect(() => {
    if (!globalEnabled) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (locked) return;
    const id = window.setInterval(() => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      // توقف عن الإرسال إذا كانت الصفحة غير مرئية لتوفير باقة فيرسل
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      const lastLocal = lastLocalGeoMsRef.current;
      if (lastLocal == null) {
        if (now - sessionStartMsRef.current >= SEND_INTERVAL_MS) {
          setAlertMessage(CHECK_MESSAGE);
        }
      } else if (now - lastLocal >= SEND_INTERVAL_MS + 5_000) {
        setAlertMessage(CHECK_MESSAGE);
      }

      navigator.geolocation.getCurrentPosition(
        handlePositionSuccess,
        handlePositionError,
        GEO_OPTS_BACKGROUND,
      );
    }, SEND_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [handlePositionError, handlePositionSuccess, locked, setAlertMessage]);

  useEffect(() => {
    if (!globalEnabled) return;
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
            setAlertMessage(PERMISSION_DENIED_MESSAGE, true);
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
              } else {
                setAlertMessage(
                  "فشل إرسال الموقع. تأكد من اتصال الإنترنت ثم اضغط فحص.",
                );
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
  }, [handlePositionError, postToServer, setAlertMessage]);

  return (
    <div className={(locked && globalEnabled) ? "min-h-[100dvh] pb-24" : undefined}>
      {children}
      {(globalEnabled && (locked || locationAlert)) ? (
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
              إذن الموقع مرفوض. افتح إعدادات المتصفح أو الجهاز، فعّل الموقع لهذه الصفحة، ثم اضغط فحص الموقع الآن.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
