"use client";

import { useEffect } from "react";

type PortalAuthCookieSetterProps = {
  auth: {
    c?: string;
    exp?: string;
    s?: string;
    p?: string;
    e?: string;
  };
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 يوماً لضمان بقاء الجلسة بعد التثبيت

function buildCookieString(name: string, value: string) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? ";secure" : "";
  return `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax${secure}`;
}

export function PortalAuthCookieSetter({ auth }: PortalAuthCookieSetterProps) {
  useEffect(() => {
    if (!auth) return;

    if (auth.c) {
      document.cookie = buildCookieString("mandoub_c", auth.c);
      document.cookie = buildCookieString("mandoub_s", auth.s ?? "");
      document.cookie = buildCookieString("mandoub_exp", auth.exp ?? "");
      try {
        localStorage.setItem("wasly_portal_last_url", window.location.href);
        localStorage.setItem("wasly_portal_type", "mandoub");
      } catch {}
    }

    if (auth.p) {
      document.cookie = buildCookieString("preparer_p", auth.p);
      document.cookie = buildCookieString("preparer_s", auth.s ?? "");
      document.cookie = buildCookieString("preparer_exp", auth.exp ?? "");
      try {
        localStorage.setItem("wasly_portal_last_url", window.location.href);
        localStorage.setItem("wasly_portal_type", "preparer");
      } catch {}
    }

    if (auth.e) {
      document.cookie = buildCookieString("client_order_e", auth.e);
      document.cookie = buildCookieString("client_order_s", auth.s ?? "");
      document.cookie = buildCookieString("client_order_exp", auth.exp ?? "");
      try {
        localStorage.setItem("wasly_portal_last_url", window.location.href);
        localStorage.setItem("wasly_portal_type", "client");
      } catch {}
    }
  }, [auth.c, auth.exp, auth.s, auth.p, auth.e]);

  return null;
}
