"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  href: string;
  intervalMs?: number;
};

/**
 * Warm wallet route in background so it opens faster.
 */
export function PortalWalletPrefetch({ href, intervalMs = 45000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!href) return;

    const warm = () => {
      try {
        router.prefetch(href);
      } catch {
        // Ignore prefetch errors; this is only a best-effort optimization.
      }
    };

    warm();
    const timerId = window.setInterval(warm, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") warm();
    };

    window.addEventListener("focus", warm);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timerId);
      window.removeEventListener("focus", warm);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [href, intervalMs, router]);

  return null;
}
