"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildPortalManifestUrl } from "@/lib/pwa-manifest";

const STORAGE_KEY = "ksebordarstor:last-pwa-path";
const PORTAL_URL_KEY = "wasly_portal_last_url";

function shouldPreservePath(pathname: string) {
  if (!pathname) return false;
  if (pathname === "/") return false;
  if (
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/abo1stor3hlaa2kbr8-47/login"
  )
    return false;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) return false;
  return true;
}

function getPortalTitle(pathname: string) {
  if (pathname.startsWith("/mandoub")) {
    return { name: "لوحة المندوب — وصلي", shortName: "لوحة المندوب" };
  }
  if (pathname.startsWith("/client/order")) {
    return { name: "إدخال طلب — وصلي", shortName: "إدخال طلب" };
  }
  if (pathname.startsWith("/preparer")) {
    return { name: "لوحة المجهز — وصلي", shortName: "لوحة المجهز" };
  }
  if (pathname.startsWith("/store")) {
    return { name: "متجر وصلي", shortName: "المتجر" };
  }
  return { name: "وصلي", shortName: "وصلي" };
}

export function PwaRoutePreserver() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    const currentPathname = window.location.pathname;
    const currentSearch = window.location.search;
    const currentFullPath = currentPathname + currentSearch;

    // إذا تم فتح التطبيق من الشاشة الرئيسية (PWA) وكان في الصفحة الرئيسية أو المتجر بالخطأ
    // ولكن المستخدم لديه رابط بوابة مخصص (مندوب أو عميل أو مجهز)
    if (isStandalone && (currentPathname === "/" || currentPathname === "/store")) {
      try {
        const savedPortalUrl = localStorage.getItem(PORTAL_URL_KEY);
        if (savedPortalUrl && savedPortalUrl !== window.location.href) {
          window.location.replace(savedPortalUrl);
          return;
        }

        const savedPath = localStorage.getItem(STORAGE_KEY);
        if (
          savedPath &&
          (savedPath.startsWith("/mandoub") ||
            savedPath.startsWith("/client/order") ||
            savedPath.startsWith("/preparer"))
        ) {
          window.location.replace(savedPath);
          return;
        }
      } catch {}
    }

    const updateManifestAndPath = () => {
      const pathname = window.location.pathname;
      const fullPath = window.location.pathname + window.location.search;

      if (shouldPreservePath(pathname)) {
        try {
          window.localStorage.setItem(STORAGE_KEY, fullPath);

          if (
            pathname.startsWith("/mandoub") ||
            pathname.startsWith("/client/order") ||
            pathname.startsWith("/preparer")
          ) {
            window.localStorage.setItem(PORTAL_URL_KEY, window.location.href);
          }
        } catch {}
      }

      // تحديث المانيفيست ليكون رابط البدء مطابقاً للصفحة الحالية بالضبط
      const { name, shortName } = getPortalTitle(pathname);
      const manifestUrl = buildPortalManifestUrl(fullPath, name, shortName);

      try {
        let manifestTag = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
        if (!manifestTag) {
          manifestTag = document.createElement("link");
          manifestTag.setAttribute("rel", "manifest");
          document.head.appendChild(manifestTag);
        }
        if (manifestTag.getAttribute("href") !== manifestUrl) {
          manifestTag.setAttribute("href", manifestUrl);
        }

        let appleTitleTag = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (!appleTitleTag) {
          appleTitleTag = document.createElement("meta");
          appleTitleTag.setAttribute("name", "apple-mobile-web-app-title");
          document.head.appendChild(appleTitleTag);
        }
        appleTitleTag.setAttribute("content", shortName);
      } catch {}
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

    window.addEventListener("popstate", updateManifestAndPath);
    window.addEventListener("navigation", updateManifestAndPath);

    updateManifestAndPath();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", updateManifestAndPath);
      window.removeEventListener("navigation", updateManifestAndPath);
    };
  }, [router]);

  return null;
}
