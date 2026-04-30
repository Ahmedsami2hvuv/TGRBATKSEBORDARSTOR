"use client";

import React from "react";

export function DeliveryLoading({ message = "جاري التحميل..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 w-full min-h-[200px] overflow-hidden">
      <div className="relative w-full max-w-[300px] h-20 mb-4 border-b-2 border-dashed border-slate-200">
        {/* الطريق المنزلق */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
           <div className="absolute top-1/2 left-0 w-[200%] h-1 bg-gradient-to-r from-transparent via-slate-100 to-transparent animate-road-slide"></div>
        </div>

        {/* السيارة (تتسابق) */}
        <div className="absolute bottom-1 left-0 text-3xl animate-car-race delay-0 z-10">
          🚗
          <div className="absolute -bottom-1 left-1 w-6 h-1 bg-black/10 blur-[2px] rounded-full"></div>
        </div>

        {/* الدراجة (تتسابق) */}
        <div className="absolute bottom-1 left-0 text-3xl animate-bike-race delay-150 z-20">
          🏍️
          <div className="absolute -bottom-1 left-1 w-5 h-1 bg-black/10 blur-[2px] rounded-full"></div>
        </div>
      </div>

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
