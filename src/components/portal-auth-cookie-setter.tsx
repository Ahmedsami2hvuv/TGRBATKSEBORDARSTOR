"use client";

import { useEffect } from "react";

type PortalAuthCookieSetterProps = {
  auth: {
    c?: string;
    exp?: string;
    s?: string;
    p?: string;
  };
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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
    }

    if (auth.p) {
      document.cookie = buildCookieString("preparer_p", auth.p);
      document.cookie = buildCookieString("preparer_s", auth.s ?? "");
      document.cookie = buildCookieString("preparer_exp", auth.exp ?? "");
    }
  }, [auth.c, auth.exp, auth.s, auth.p]);

  return null;
}
