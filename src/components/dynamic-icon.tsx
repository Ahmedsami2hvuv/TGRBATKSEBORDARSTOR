"use client";

import React, { useEffect, useState } from "react";
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
  const [mounted, setMounted] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && (window as any).customElements && (window as any).customElements.get('lottie-player')) {
      setPlayerLoaded(true);
    }
  }, []);

  const resolvedIcon = icon || (iconKey && config ? config[iconKey] : (config && !iconKey ? config : null));

  if (!resolvedIcon) return <>{fallback}</>;

  const iconUrl = cleanIconUrl(resolvedIcon.url || "");

  // فحص ذكي: إذا كان الرابط يحتوي على lottie أو gif، نحدد طريقة العرض
  const isLottie = isLottieDirectAssetUrl(iconUrl) || resolvedIcon.type === 'lottie';
  const isGif = iconUrl.toLowerCase().endsWith('.gif') || resolvedIcon.type === 'gif';
  const displayUrl = getLottieDisplayUrl(iconUrl);
  const isEmbed = displayUrl.includes("/embed/");

  if (isGif && iconUrl) {
    return (
      <img
        src={iconUrl}
        className={className}
        style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height, objectFit: 'contain' }}
        alt=""
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  if (isLottie && iconUrl) {
    if (!mounted) return <div style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height }} className={className} />;

    return (
      <div className={className} style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {!isEmbed && (
          <Script
            src="https://unpkg.com/@lottiefiles/lottie-player@1.5.7/dist/lottie-player.js"
            strategy="afterInteractive"
            onLoad={() => setPlayerLoaded(true)}
          />
        )}

        {isEmbed ? (
          <iframe
            src={displayUrl}
            style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
            allowFullScreen
          />
        ) : playerLoaded ? (
          <lottie-player
            src={iconUrl}
            background="transparent"
            speed="1"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <div className="animate-pulse bg-slate-100 rounded-full w-full h-full" />
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
