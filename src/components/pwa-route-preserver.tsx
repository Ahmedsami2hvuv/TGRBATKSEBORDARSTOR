"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "ksebordarstor:last-pwa-path";

function shouldPreservePath(pathname: string) {
  if (!pathname) return false;
  if (pathname === "/") return false;
  if (pathname === "/register" || pathname === "/forgot-password" || pathname === "/abo1stor3hlaa2kbr8-47/login") return false;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) return false;
  return true;
}

function getCurrentPath() {
  return window.location.pathname + window.location.search;
}

export function PwaRoutePreserver() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updatePath = () => {
      const currentPath = getCurrentPath();
      const pathname = window.location.pathname;

      if (shouldPreservePath(pathname)) {
        window.localStorage.setItem(STORAGE_KEY, currentPath);
      }

      if (pathname === "/") {
        const storedRoute = window.localStorage.getItem(STORAGE_KEY);
        if (storedRoute && storedRoute !== "/" && storedRoute !== currentPath) {
          router.replace(storedRoute);
        }
      }
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const dispatchNavigation = () => window.dispatchEvent(new Event("navigation"));

    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      dispatchNavigation();
      return result;
    };

    window.history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      dispatchNavigation();
      return result;
    };

    window.addEventListener("popstate", updatePath);
    window.addEventListener("navigation", updatePath);

    updatePath();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", updatePath);
      window.removeEventListener("navigation", updatePath);
    };
  }, [router]);

  return null;
}
