"use client";

import React, { useEffect, useState } from "react";
import Script from "next/script";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

export function DeliveryLoading({ message = "جاري التحميل..." }: { message?: string }) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const loadingIcon = icons?.loading_main;
  // تنظيف الرابط من أي مسافات أو نصوص زائدة
  const rawUrl = loadingIcon?.url || "";
  const iconUrl = rawUrl.trim().match(/https?:\/\/[^\s]+/) ? rawUrl.trim().match(/https?:\/\/[^\s]+/)?.[0] || rawUrl.trim() : rawUrl.trim();

  // تحديد ما إذا كان الرابط Lottie مباشر
  const isDirectLottie =
    iconUrl.toLowerCase().includes("lottie.host") ||
    iconUrl.toLowerCase().endsWith(".json") ||
    iconUrl.toLowerCase().includes("assets.lottiefiles.com");

  return (
    <div className="flex flex-col items-center justify-center p-8 w-full min-h-[200px] overflow-hidden">
      {loadingIcon?.type === 'lottie' ? (
        <div className="mb-4 w-48 h-48 flex items-center justify-center">
          {isDirectLottie ? (
            <>
              <Script
                src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"
                strategy="lazyOnload"
              />
              <lottie-player
                src={iconUrl}
                background="transparent"
                speed="1"
                loop
                autoplay
                style={{ width: '100%', height: '100%' }}
              />
            </>
          ) : (
            <iframe
              src={iconUrl.includes("lottiefiles.com/animations")
                ? iconUrl.replace("lottiefiles.com/animations/", "embed.lottiefiles.com/animation/")
                : iconUrl}
              className="w-48 h-48 border-none pointer-events-none"
              allowFullScreen
            />
          )}
        </div>
      ) : loadingIcon?.type === 'image' ? (
        <img src={iconUrl} className="w-32 h-32 object-contain mb-4 animate-bounce" alt="Loading" />
      ) : loadingIcon?.type === 'emoji' ? (
        <div className="text-6xl mb-4 animate-bounce">{iconUrl}</div>
      ) : (
        <div className="relative w-full max-w-[300px] h-20 mb-4 border-b-2 border-dashed border-slate-200">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
             <div className="absolute top-1/2 left-0 w-[200%] h-1 bg-gradient-to-r from-transparent via-slate-100 to-transparent animate-road-slide"></div>
          </div>
          <div className="absolute bottom-1 left-0 text-3xl animate-car-race delay-0 z-10">
            <div style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🚗</div>
          </div>
          <div className="absolute bottom-1 left-0 text-3xl animate-bike-race delay-150 z-20">
            <div style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🏍️</div>
          </div>
        </div>
      )}

      <p className="text-sm font-bold text-slate-500 animate-pulse">{message}</p>

      <style jsx global>{`
        @keyframes road-slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes car-race {
          0% { transform: translateX(-50px); }
          100% { transform: translateX(350px); }
        }
        @keyframes bike-race {
          0% { transform: translateX(-60px); }
          100% { transform: translateX(350px); }
        }
        .animate-road-slide { animation: road-slide 1s linear infinite; }
        .animate-car-race { animation: car-race 3s ease-in-out infinite; }
        .animate-bike-race { animation: bike-race 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
