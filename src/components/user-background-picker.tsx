"use client";

import { useEffect } from "react";

export function UserBackgroundPicker({ userKey }: { userKey?: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem("kse_user_background_url");
    } catch {}
  }, []);

  return null;
}
