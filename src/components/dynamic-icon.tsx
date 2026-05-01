"use client";

import React from "react";
import Script from "next/script";
import { IconConfig } from "@/lib/icon-settings";
import { isLottieDirectAssetUrl, getLottieDisplayUrl, cleanIconUrl } from "@/lib/icon-utils";

export function DynamicIcon({
  icon,
  iconKey,
  config,
  className,
  fallback,
  width = 24,
  height = 24,
}: {
  icon?: IconConfig | null;
  iconKey?: string;
  config?: any;
  className?: string;
  fallback?: React.ReactNode;
  width?: number;
  height?: number;
}) {
  const resolvedIcon = icon || (iconKey && config ? config[iconKey] : (config && !iconKey ? config : null));

  if (!resolvedIcon) return <>{fallback}</>;

  const iconUrl = cleanIconUrl(resolvedIcon.url || "");

  if (resolvedIcon.type === 'emoji') {
    return <span className={className}>{iconUrl}</span>;
  }

  if (resolvedIcon.type === 'image') {
    return (
      <img
        src={iconUrl}
        className={className}
        style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height, objectFit: 'contain' }}
        alt="icon"
      />
    );
  }

  if (resolvedIcon.type === 'lottie') {
    // إذا كان الرابط lottie.host أو ينتهي بـ .json نستخدم المشغل المباشر دائماً
    if (isLottieDirectAssetUrl(iconUrl)) {
      return (
        <>
          <Script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js" strategy="lazyOnload" />
          <lottie-player
            src={iconUrl}
            background="transparent"
            speed="1"
            loop
            autoplay
            className={className}
            style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height }}
          />
        </>
      );
    }

    // روابط lottiefiles التقليدية (Embed)
    return (
      <iframe
        src={getLottieDisplayUrl(iconUrl)}
        className={className}
        style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height, border: 'none', pointerEvents: 'none' }}
        allowFullScreen
      />
    );
  }

  if (resolvedIcon.type === 'svg') {
    return (
      <div
        className={className}
        style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height }}
        dangerouslySetInnerHTML={{ __html: iconUrl }}
      />
    );
  }

  return <>{fallback}</>;
}
