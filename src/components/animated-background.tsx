"use client";

import { useEffect, useState } from "react";
import { getBackgroundsConfigAction } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/background-actions";
import { BackgroundsConfig, BackgroundItem } from "@/lib/background-settings";
import { useTheme } from "./theme-provider";

export function AnimatedBackground() {
  const [config, setConfig] = useState<BackgroundsConfig | null>(null);
  const [activeBg, setActiveBg] = useState<BackgroundItem | null>(null);
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // تحديث الوضع الداكن بناءً على كلاس html
  useEffect(() => {
    setMounted(true);
    
    // جلب قائمة الخلفيات المتاحة من السيرفر
    getBackgroundsConfigAction()
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => console.error("فشل جلب الخلفيات:", err));

    const checkDarkMode = () => {
      const root = document.documentElement;
      setIsDark(root.classList.contains("dark"));
    };

    // التحقق فوراً
    checkDarkMode();

    // مراقبة التغييرات على فئة html (الوضع الداكن)
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // استماع لتغيير الخلفية من localStorage
    const handleStorageChange = () => {
      const savedBgId = localStorage.getItem("kse_user_background");
      if (config && savedBgId) {
        const found = config.items.find((item) => item.id === savedBgId && item.isActive);
        if (found) setActiveBg(found);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    // إرسال حدث مخصص للمزامنة اللحظية في نفس التبويب
    window.addEventListener("kse_bg_changed", handleStorageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("kse_bg_changed", handleStorageChange);
    };
  }, [config]);

  // تحديد الخلفية النشطة للمستخدم
  useEffect(() => {
    if (!config) return;

    const savedBgId = localStorage.getItem("kse_user_background");
    let found = config.items.find((item) => item.id === savedBgId && item.isActive);
    
    if (!found) {
      // استخدام الخلفية الافتراضية
      found = config.items.find((item) => item.id === config.defaultBackgroundId && item.isActive);
    }
    
    if (!found) {
      // الاحتياط الأخير
      found = config.items.find((item) => item.isActive);
    }

    setActiveBg(found || null);
  }, [config]);

  if (!mounted || !activeBg) return null;

  // تحديد الرابط والنوع المناسبين للوضع الحالي
  const url = isDark ? activeBg.darkUrl : activeBg.lightUrl;
  const type = isDark ? activeBg.darkType : activeBg.lightType;

  // الشفافية والضبابية
  const style = {
    opacity: activeBg.opacity / 100,
    filter: activeBg.blur > 0 ? `blur(${activeBg.blur}px)` : "none",
  };

  return (
    <div 
      className="fixed inset-0 w-full h-full -z-50 pointer-events-none overflow-hidden select-none transition-all duration-700 bg-transparent"
      style={style}
    >
      {type === "video" && url ? (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      ) : type === "lottie" && url ? (
        <div className="w-full h-full flex items-center justify-center scale-110">
          {/* @ts-ignore */}
          <lottie-player
            src={url}
            autoplay
            loop
            speed="1"
            style={{ width: "100%", height: "100%" }}
            background="transparent"
          />
        </div>
      ) : url ? (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        // تدرج لوني افتراضي هادئ جداً لا يؤثر على الرؤية
        <div className="w-full h-full bg-gradient-to-br from-slate-100 via-sky-50/30 to-blue-100/50 dark:from-[#09090b] dark:via-[#0c0d12] dark:to-[#09090b]" />
      )}
    </div>
  );
}
