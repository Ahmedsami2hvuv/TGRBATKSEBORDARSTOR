"use client";

import React, { useEffect, useState } from "react";
import Script from "next/script";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { isLottieDirectAssetUrl, cleanIconUrl, getLottieDisplayUrl } from "@/lib/icon-utils";

export function DeliveryLoading({ message = "جاري التحميل..." }: { message?: string }) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const loadingIcon = icons?.loading_main;
  const iconUrl = cleanIconUrl(loadingIcon?.url || "");
  const isDirectLottie = isLottieDirectAssetUrl(iconUrl);

  return (
    <div className="flex flex-col items-center justify-center p-2 w-full min-h-[400px] bg-transparent">
      <Script
        src="https://unpkg.com/@lottiefiles/lottie-player@1.5.7/dist/lottie-player.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      {loadingIcon?.type === 'lottie' ? (
        <div className="mb-8 w-full max-w-[500px] aspect-square flex items-center justify-center overflow-visible">
          {isDirectLottie ? (
            <lottie-player
              src={iconUrl}
              background="transparent"
              speed="1"
              loop
              autoplay
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          ) : (
            <iframe
              src={getLottieDisplayUrl(iconUrl)}
              className="w-full h-full border-none pointer-events-none bg-transparent"
              allowFullScreen
            />
          )}
        </div>
      ) : loadingIcon?.type === 'image' ? (
        <img src={iconUrl} className="w-48 h-48 object-contain mb-8 animate-bounce" alt="Loading" />
      ) : loadingIcon?.type === 'emoji' ? (
        <div className="text-9xl mb-8 animate-bounce">{iconUrl}</div>
      ) : (
        <div className="relative w-full max-w-[400px] h-32 mb-8 border-b-2 border-dashed border-slate-200">
           <div className="absolute inset-0 overflow-hidden pointer-events-none">
             <div className="absolute top-1/2 left-0 w-[200%] h-1 bg-gradient-to-r from-transparent via-slate-100 to-transparent animate-road-slide"></div>
          </div>
          <div className="absolute bottom-1 left-0 text-5xl animate-car-race delay-0 z-10">
            <div style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🚗</div>
          </div>
        </div>
      )}

      <div className="text-center space-y-3 px-4">
        <p className="text-2xl font-black text-sky-900 animate-pulse">{message}</p>
        <p className="text-sm font-bold text-slate-400">يرجى الانتظار قليلاً، نحن نجهز لك البيانات...</p>
      </div>

      <style jsx global>{`
        @keyframes road-slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes car-race {
          0% { transform: translateX(-150px); }
          100% { transform: translateX(600px); }
        }
        .animate-road-slide { animation: road-slide 1s linear infinite; }
        .animate-car-race { animation: car-race 2.5s ease-in-out infinite; }
        lottie-player { background: transparent !important; }
      `}</style>
    </div>
  );
}
