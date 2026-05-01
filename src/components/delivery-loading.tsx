"use client";

import React, { useEffect, useState } from "react";
import Script from "next/script";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { isLottieDirectAssetUrl, cleanIconUrl } from "@/lib/icon-utils";

export function DeliveryLoading({ message = "جاري التحميل..." }: { message?: string }) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const loadingIcon = icons?.loading_main;
  const iconUrl = cleanIconUrl(loadingIcon?.url || "");

  // إذا كان الرابط يحتوي على lottie، فهو أنيميشن 100% مهما كان الاختيار في الإعدادات
  const isLottie = isLottieDirectAssetUrl(iconUrl) || loadingIcon?.type === 'lottie';

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full min-h-[450px] bg-transparent overflow-visible">
      <Script
        src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"
        strategy="afterInteractive"
      />

      {isLottie ? (
        <div className="mb-8 w-full max-w-[550px] h-[400px] flex items-center justify-center bg-transparent overflow-visible">
          <lottie-player
            src={iconUrl}
            background="transparent"
            speed="1"
            loop
            autoplay
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      ) : loadingIcon?.type === 'image' && iconUrl ? (
        <img
          src={iconUrl}
          className="w-48 h-48 object-contain mb-8 animate-bounce"
          alt=""
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : (
        /* في حال فشل كل شيء، يظهر هذا الأنيميشن البسيط بدلاً من المربع المكسور */
        <div className="text-9xl mb-8 animate-bounce">
          {loadingIcon?.type === 'emoji' ? iconUrl : "⏳"}
        </div>
      )}

      <div className="text-center space-y-4 px-6 relative z-10">
        <h2 className="text-3xl md:text-4xl font-black text-sky-900 animate-pulse leading-tight">
          {message}
        </h2>
        <div className="flex items-center justify-center gap-3">
           <div className="w-3 h-3 bg-sky-500 rounded-full animate-bounce delay-75"></div>
           <div className="w-3 h-3 bg-sky-500 rounded-full animate-bounce delay-150"></div>
           <div className="w-3 h-3 bg-sky-500 rounded-full animate-bounce delay-300"></div>
        </div>
      </div>

      <style jsx global>{`
        lottie-player {
          background: transparent !important;
          border: none !important;
          outline: none !important;
        }
      `}</style>
    </div>
  );
}
