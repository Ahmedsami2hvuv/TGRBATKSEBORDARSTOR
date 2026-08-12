"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopLoadingBar() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // إخفاء مؤشر التحميل عندما يتغير المسار
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleStart = () => setLoading(true);
    const handleStop = () => setLoading(false);

    window.addEventListener("kse:nav-start", handleStart);
    window.addEventListener("kse:nav-stop", handleStop);

    // تفعيل المؤشر عند النقر على أي رابط داخل المتجر
    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (target && target.href && target.href.includes("/store") && !target.href.includes("#") && target.target !== "_blank") {
        if (target.pathname === window.location.pathname && target.search === window.location.search) {
          // نفس الصفحة، لا حاجة للتحميل
          return;
        }
        setLoading(true);
      }
    };

    document.addEventListener("click", handleLinkClick);

    return () => {
      window.removeEventListener("kse:nav-start", handleStart);
      window.removeEventListener("kse:nav-stop", handleStop);
      document.removeEventListener("click", handleLinkClick);
    };
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-green-500/20 z-[9999] overflow-hidden">
      <div className="w-full h-full bg-green-500 animate-[loading_1s_ease-in-out_infinite] origin-left scale-x-0" style={{
        animation: "slideRight 1s ease-in-out infinite"
      }}>
        <style>{`
          @keyframes slideRight {
            0% { transform: scaleX(0); transform-origin: left; }
            50% { transform: scaleX(1); transform-origin: left; }
            50.1% { transform-origin: right; }
            100% { transform: scaleX(0); transform-origin: right; }
          }
        `}</style>
      </div>
    </div>
  );
}
