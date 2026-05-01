"use client";

import React from "react";
import Script from "next/script";
import { IconConfig, isLottieDirectAssetUrl } from "@/lib/icon-settings";

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

  if (resolvedIcon.type === 'emoji') {
    return <span className={className}>{resolvedIcon.url}</span>;
  }

  if (resolvedIcon.type === 'image') {
    return (
      <img
        src={resolvedIcon.url}
        className={className}
        style={{ width: resolvedIcon.width || width, height: resolvedIcon.height || height, objectFit: 'contain' }}
        alt="icon"
      />
    );
  }

  if (resolvedIcon.type === 'lottie') {
    const url = resolvedIcon.url;

    if (isLottieDirectAssetUrl(url)) {
      return (
        <>
          <Script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js" strategy="afterInteractive" />
          <lottie-player
            src={url}
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

    const embedUrl = url.replace("https://lottiefiles.com/", "https://embed.lottiefiles.com/");
    return (
      <iframe
        src={embedUrl}
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
        dangerouslySetInnerHTML={{ __html: resolvedIcon.url }}
      />
    );
  }

  return <>{fallback}</>;
}
