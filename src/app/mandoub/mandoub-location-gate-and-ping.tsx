"use client";

import { useSearchParams } from "next/navigation";
import { PortalLocationHeartbeat } from "@/components/portal-location-heartbeat";
import { OneSignalInitializer } from "@/components/OneSignalInitializer";
import { useEffect, useState, useCallback } from "react";

/**
 * لوحة المندوب: نبض موقع كل 20 ثانية للإدارة، وقفل الصفحة إن انقطع الإرسال أكثر من 3 دقائق.
 */
export function MandoubLocationGateAndPing({ children }: { children: React.ReactNode }) {
  const [globalTracking, setGlobalTracking] = useState(true);
  const [fontSizeScale, setFontSizeScale] = useState(1.0);
  const [uiScale, setUiScale] = useState(1.0);

  const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

  const updateScalesFromLocalStorage = useCallback(() => {
    const savedFontSize = localStorage.getItem("kse_mandoub_fontSizeScale");
    const savedUiScale = localStorage.getItem("kse_mandoub_uiScale");
    if (savedFontSize) setFontSizeScale(parseFloat(savedFontSize));
    if (savedUiScale) setUiScale(parseFloat(savedUiScale));
  }, []);

  useEffect(() => {
    updateScalesFromLocalStorage();

    const handleScaleChange = (e: any) => {
      if (e.detail?.key === "fontSizeScale") {
        setFontSizeScale(e.detail.value);
        localStorage.setItem("kse_mandoub_fontSizeScale", e.detail.value.toString());
      } else if (e.detail?.key === "uiScale") {
        setUiScale(e.detail.value);
        localStorage.setItem("kse_mandoub_uiScale", e.detail.value.toString());
      }
    };

    window.addEventListener("kse_scale_changed" as any, handleScaleChange);
    return () => window.removeEventListener("kse_scale_changed" as any, handleScaleChange);
  }, [updateScalesFromLocalStorage]);

  useEffect(() => {
    fetch(`/api${SECRET_ADMIN_PATH}/settings/resource-management`)
      .then(res => res.json())
      .then(data => {
        if (data.trackingEnabled !== undefined) {
          setGlobalTracking(data.trackingEnabled);
        }
      })
      .catch(() => {});
  }, []);

  const searchParams = useSearchParams();
  const paramC = searchParams.get("c");
  const paramExp = searchParams.get("exp");
  const paramS = searchParams.get("s");

  function readCookie(name: string) {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : "";
  }

  const c = paramC ?? readCookie("mandoub_c") ?? "";
  const exp = paramExp ?? readCookie("mandoub_exp") ?? "";
  const s = paramS ?? readCookie("mandoub_s") ?? "";

  // الربط مع OneSignal إذا كان معرف المندوب موجوداً في الرابط
  const oneSignalComponent = c.trim() ? <OneSignalInitializer externalId={c.trim()} /> : null;

  if (!c.trim() || !s.trim()) {
    return (
      <>
        {oneSignalComponent}
        {children}
      </>
    );
  }

  return (
    <PortalLocationHeartbeat variant="mandoub" c={c} exp={exp} s={s} globalEnabled={globalTracking}>
      <div
        style={{
          "--mandoub-font-scale": fontSizeScale,
          "--mandoub-ui-scale": uiScale,
          fontSize: `${fontSizeScale}rem`
        } as React.CSSProperties}
        className="min-h-screen"
      >
        {oneSignalComponent}
        {children}
      </div>
    </PortalLocationHeartbeat>
  );
}
