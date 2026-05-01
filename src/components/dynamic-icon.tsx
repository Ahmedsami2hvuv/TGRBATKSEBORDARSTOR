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

  // فحص ذكي: إذا كان الرابط يحتوي على lottie، فهو أنيميشن حتماً
  const isLottie = isLottieDirectAssetUrl(iconUrl) || resolvedIcon.type === 'lottie';

  if (isLottie && iconUrl) {
    return (
      <div className={className} style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js" strategy="lazyOnload" />
        {isLottieDirectAssetUrl(iconUrl) ? (
          <lottie-player
            src={iconUrl}
            background="transparent"
            speed="1"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <iframe
            src={getLottieDisplayUrl(iconUrl)}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          />
        )}
      </div>
    );
  }

  if (resolvedIcon.type === 'emoji') {
    return <span className={className}>{iconUrl}</span>;
  }

  if (resolvedIcon.type === 'image' && iconUrl) {
    return (
      <img
        src={iconUrl}
        className={className}
        style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height, objectFit: 'contain' }}
        alt=""
        onError={(e) => {
          // إخفاء المربع الرمادي تماماً في حال فشل الصورة
          (e.target as HTMLImageElement).style.display = 'none';
        }}
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
