"use client";

import React from "react";
import { IconConfig } from "@/lib/icon-settings";

export function DynamicIcon({
  icon,
  className,
  fallback,
  width = 24,
  height = 24,
}: {
  icon?: IconConfig | null;
  className?: string;
  fallback?: React.ReactNode;
  width?: number;
  height?: number;
}) {
  if (!icon) return <>{fallback}</>;

  if (icon.type === 'emoji') {
    return <span className={className}>{icon.url}</span>;
  }

  if (icon.type === 'image') {
    return (
      <img
        src={icon.url}
        className={className}
        style={{ width: icon.width || width, height: icon.height || height, objectFit: 'contain' }}
        alt="icon"
      />
    );
  }

  if (icon.type === 'lottie') {
    const embedUrl = icon.url.replace("https://lottiefiles.com/", "https://embed.lottiefiles.com/");
    return (
      <iframe
        src={embedUrl}
        className={className}
        style={{ width: icon.width || width, height: icon.height || height, border: 'none', pointerEvents: 'none' }}
        allowFullScreen
      />
    );
  }

  if (icon.type === 'svg') {
    return (
      <div
        className={className}
        style={{ width: icon.width || width, height: icon.height || height }}
        dangerouslySetInnerHTML={{ __html: icon.url }}
      />
    );
  }

  return <>{fallback}</>;
}
