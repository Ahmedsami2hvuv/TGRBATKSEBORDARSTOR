"use client";

import React, { useEffect, useState } from "react";
import Script from "next/script";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { cleanIconUrl, isLottieDirectAssetUrl, getLottieDisplayUrl } from "@/lib/icon-utils";

const ICONS_CACHE_KEY = "global-icons-cache-v1";

function readIconsCache(): GlobalIconsConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ICONS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as GlobalIconsConfig) : null;
  } catch {
    return null;
  }
}

function writeIconsCache(icons: GlobalIconsConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ICONS_CACHE_KEY, JSON.stringify(icons));
  } catch {
    // ignore cache write failures
  }
}

export function DeliveryLoading({
  message = "جاري التحميل...",
  initialIcons = null,
}: {
  message?: string;
  initialIcons?: GlobalIconsConfig | null;
}) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(() => initialIcons || readIconsCache());
  const [iconsLoaded, setIconsLoaded] = useState(Boolean(initialIcons || readIconsCache()));
  const [mounted, setMounted] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (initialIcons) {
      writeIconsCache(initialIcons);
    }

    fetch("/api/admin/settings/icons", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          const fetchedIcons = data as GlobalIconsConfig;
          setIcons(fetchedIcons);
          writeIconsCache(fetchedIcons);
        }
      })
      .catch(() => {
        // تجاهل فشل الجلب واستمر على الكاش
      })
      .finally(() => {
        setIconsLoaded(true);
      });

    // التحقق من وجود المشغل مسبقاً في النافذة
    if (typeof window !== 'undefined' && (window as any).customElements && (window as any).customElements.get('lottie-player')) {
      setPlayerLoaded(true);
    }
  }, []);

  const loadingIcon = icons?.loading_main;
  const rawUrl = loadingIcon?.url || "";
  const iconUrl = cleanIconUrl(rawUrl);

  const isLottie = isLottieDirectAssetUrl(iconUrl) || loadingIcon?.type === 'lottie';
  const isGif = iconUrl.toLowerCase().endsWith('.gif') || loadingIcon?.type === "gif";
  const loadingRenderMode = loadingIcon?.renderMode || "no_upscale";
  const displayUrl = getLottieDisplayUrl(iconUrl);
  const isEmbed = displayUrl.includes("/embed/");

  // تجنب مشاكل Hydration في Next.js
  if (!mounted) return null;

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full min-h-[550px] bg-transparent overflow-visible">
      {/* تحميل مشغل Lottie الرسمي - نحتاجه فقط إذا لم يكن embed أو GIF */}
      {isLottie && !isEmbed && !isGif && (
        <Script
          src="https://unpkg.com/@lottiefiles/lottie-player@1.5.7/dist/lottie-player.js"
          onLoad={() => setPlayerLoaded(true)}
          strategy="afterInteractive"
        />
      )}

      {!iconsLoaded ? (
        <div className="mb-8 w-full max-w-[500px] h-[350px] md:h-[450px] flex items-center justify-center bg-transparent overflow-visible relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-35 pointer-events-none">
            <div className="w-24 h-24 border-8 border-sky-100 border-t-sky-600 rounded-full animate-spin"></div>
            <p className="text-sky-900 font-bold italic text-xl">جاري تحميل الأيقونة...</p>
          </div>
        </div>
      ) : (isLottie || isGif) && iconUrl ? (
        <div className="mb-8 w-full max-w-[500px] h-[350px] md:h-[450px] flex items-center justify-center bg-transparent overflow-visible relative">
          {isGif ? (
            <img
              src={iconUrl}
              className={loadingRenderMode === "fill" ? "w-full h-full object-cover drop-shadow-md" : "max-w-full max-h-full object-contain drop-shadow-md"}
              style={loadingRenderMode === "fill" ? undefined : { width: "auto", height: "auto" }}
              alt="Loading..."
            />
          ) : isEmbed ? (
            <iframe
              src={displayUrl}
              className="w-full h-full border-none bg-transparent relative z-10"
              allowFullScreen
            />
          ) : playerLoaded ? (
            <div
              className="w-full h-full flex items-center justify-center relative z-10"
              key={iconUrl}
              dangerouslySetInnerHTML={{
                __html: `<lottie-player
                  src="${iconUrl}"
                  background="transparent"
                  speed="1"
                  loop
                  autoplay
                  style="width: 100%; height: 100%; display: block;"
                ></lottie-player>`
              }}
            />
          ) : null}

          {/* طبقة تحميل احتياطية تظهر خلف الأنيميشن أو مكانه - تظهر فقط في حالة الـ Lottie البطيء */}
          {!isGif && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-20 pointer-events-none">
               <div className="w-24 h-24 border-8 border-sky-100 border-t-sky-600 rounded-full animate-spin"></div>
               <p className="text-sky-900 font-bold italic text-xl">جاري الاتصال...</p>
            </div>
          )}
        </div>
      ) : loadingIcon?.type === 'image' && iconUrl ? (
        <img
          src={iconUrl}
          className={`w-72 h-72 object-contain mb-12 ${isGif ? '' : 'animate-bounce'}`}
          alt=""
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : (
        <div className="text-[140px] mb-12 animate-bounce drop-shadow-2xl">
          {loadingIcon?.type === 'emoji' ? iconUrl : "🚚"}
        </div>
      )}

      <div className="text-center space-y-8 px-6 max-w-4xl relative z-10">
        <h2 className="text-4xl md:text-7xl font-black text-sky-950 animate-pulse leading-tight tracking-tight">
          {message}
        </h2>
        <div className="flex items-center justify-center gap-5 mt-10">
           <div className="w-6 h-6 bg-sky-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
           <div className="w-6 h-6 bg-sky-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
           <div className="w-6 h-6 bg-sky-600 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
}
