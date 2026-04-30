"use client";

import React, { useEffect, useState } from "react";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

export function DeliveryLoading({ message = "جاري التحميل..." }: { message?: string }) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const loadingIcon = icons?.loading_main;

  return (
    <div className="flex flex-col items-center justify-center p-8 w-full min-h-[200px] overflow-hidden">
      {loadingIcon?.type === 'lottie' ? (
        <div className="mb-4">
           {/* هنا يمكن إضافة مكتبة Lottie إذا كانت متوفرة، أو عرض iframe للرابط حالياً كحل ذكي */}
           <iframe
             src={loadingIcon.url.replace("https://lottiefiles.com/", "https://embed.lottiefiles.com/")}
             className="w-48 h-48 border-none pointer-events-none"
             allowFullScreen
           />
        </div>
      ) : loadingIcon?.type === 'image' ? (
        <img src={loadingIcon.url} className="w-32 h-32 object-contain mb-4 animate-bounce" alt="Loading" />
      ) : loadingIcon?.type === 'emoji' ? (
        <div className="text-6xl mb-4 animate-bounce">{loadingIcon.url}</div>
      ) : (
        <div className="relative w-full max-w-[300px] h-20 mb-4 border-b-2 border-dashed border-slate-200">
          {/* الطريق المنزلق */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
             <div className="absolute top-1/2 left-0 w-[200%] h-1 bg-gradient-to-r from-transparent via-slate-100 to-transparent animate-road-slide"></div>
          </div>

          {/* السيارة (تتسابق) */}
          <div className="absolute bottom-1 left-0 text-3xl animate-car-race delay-0 z-10">
            <div style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🚗</div>
            <div className="absolute -bottom-1 left-1 w-6 h-1 bg-black/10 blur-[2px] rounded-full"></div>
          </div>

          {/* الدراجة (تتسابق) */}
          <div className="absolute bottom-1 left-0 text-3xl animate-bike-race delay-150 z-20">
            <div style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🏍️</div>
            <div className="absolute -bottom-1 left-1 w-5 h-1 bg-black/10 blur-[2px] rounded-full"></div>
          </div>
        </div>
      )}

      <p className="text-sm font-bold text-slate-500 animate-pulse">{message}</p>

      <style jsx global>{`
        @keyframes road-slide {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes car-race {
          0% { transform: translateX(-50px); }
          20% { transform: translateX(100px) translateY(-2px); }
          40% { transform: translateX(80px) translateY(0); }
          60% { transform: translateX(220px) translateY(-1px); }
          80% { transform: translateX(180px) translateY(0); }
          100% { transform: translateX(350px); }
        }
        @keyframes bike-race {
          0% { transform: translateX(-60px); }
          25% { transform: translateX(150px) translateY(-4px); }
          50% { transform: translateX(120px) translateY(0); }
          75% { transform: translateX(250px) translateY(-3px); }
          100% { transform: translateX(350px); }
        }
        .animate-road-slide {
          animation: road-slide 1s linear infinite;
        }
        .animate-car-race {
          animation: car-race 3s ease-in-out infinite;
        }
        .animate-bike-race {
          animation: bike-race 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
