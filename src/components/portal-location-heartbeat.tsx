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
  maximumAge: 300_000,
  timeout: 10_000,
};

const LOCK_MESSAGE = "نزل البرده وشغل الموقع (اللكيشن) وبعدها انقر على زر الفحص";

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

export type PortalLocationHeartbeatProps = MandoubProps | PreparerProps;

/**
 * القفل يعتمد فقط على هذه الجلسة في المتصفح:
 * — لا يُفتح طلب الفحص عند أول فتح للصفحة.
 * — يُطلب الفحص بعد 3 دقائق متتالية دون أي استجابة ناجحة من الخادم لطلب موقع (POST).
 * — إذا وصل الموقع للخادم (كل ~20 ثانية) لا يظهر القفل.
 */
export function PortalLocationHeartbeat(props: PortalLocationHeartbeatProps) {
  const { children } = props;
  const propsRef = useRef(props);
  propsRef.current = props;

  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);

  /** آخر وقت نجح فيه POST بموقع في هذه الجلسة فقط (لا نقرأ قاعدة البيانات عند الفتح) */
  const lastSuccessfulPostMsRef = useRef<number | null>(null);
  const sessionStartMsRef = useRef(Date.now());
  const lockedRef = useRef(false);
  lockedRef.current = locked;

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

  const trySendOnce = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    if (lockedRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const ok = await postToServer(pos.coords.latitude, pos.coords.longitude);
          if (ok) {
            lastSuccessfulPostMsRef.current = Date.now();
          }
        })();
      },
      () => {
        /* صامت */
      },
      GEO_OPTS_BACKGROUND,
    );
  }, [postToServer]);

  useEffect(() => {
    if (locked) return;
    trySendOnce();
    const id = window.setInterval(() => trySendOnce(), SEND_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [locked, trySendOnce]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const lastOk = lastSuccessfulPostMsRef.current;
      const sessionStart = sessionStartMsRef.current;
      const now = Date.now();
      if (lastOk == null) {
        if (now - sessionStart > STALE_AFTER_MS) setLocked(true);
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
            setChecking(false);
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
                setLocked(false);
              }
            } finally {
              setChecking(false);
            }
          })();
        },
        () => {
          setChecking(false);
        },
        GEO_OPTS_CHECK,
      );
    })();
  }, [postToServer]);

  return (
    <div className={locked ? "min-h-[100dvh] pb-24" : undefined}>
      {children}
      {locked ? (
        <div
          className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-slate-950/97 px-4 text-center text-white"
          dir="rtl"
          role="alertdialog"
          aria-modal="true"
          aria-label="فحص الموقع"
        >
          <p className="mb-8 max-w-md text-base font-semibold leading-relaxed text-slate-200">{LOCK_MESSAGE}</p>
          <button
            type="button"
            onClick={onCheckClick}
            disabled={checking}
            className="rounded-2xl bg-emerald-500 px-10 py-4 text-lg font-black text-white shadow-xl ring-2 ring-emerald-300/60 hover:bg-emerald-400 disabled:opacity-60"
          >
            {checking ? "جارٍ الفحص…" : "فحص"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
