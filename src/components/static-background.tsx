"use client";

import { useEffect } from "react";

export function StaticBackground({ systemDefaultBgUrl }: { systemDefaultBgUrl?: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem("kse_user_background_url");
      document.body.classList.remove("has-custom-bg");
    } catch {}
  }, []);

  return null;
}
