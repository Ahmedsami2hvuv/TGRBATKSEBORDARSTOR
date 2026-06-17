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

  // 1. جلب قائمة الخلفيات المتاحة من السيرفر مرة واحدة عند التحميل
  useEffect(() => {
    setMounted(true);
    getBackgroundsConfigAction()
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => console.error("فشل جلب الخلفيات:", err));
  }, []);

  // 2. تحديث الوضع الداكن ومراقبة تغييراته
  useEffect(() => {
    if (!mounted) return;

    const checkDarkMode = () => {
      const root = document.documentElement;
      setIsDark(root.classList.contains("dark"));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, [mounted]);

  // 3. تحديد الخلفية النشطة للمستخدم عند تحميل التكوين أو تغير التفضيل
  useEffect(() => {
    if (!config) return;

    const updateActiveBg = () => {
      const savedBgId = localStorage.getItem("kse_user_background");
      let found = config.items.find((item) => item.id === savedBgId && item.isActive);
      
      if (!found) {
        found = config.items.find((item) => item.id === config.defaultBackgroundId && item.isActive);
      }
      
      if (!found) {
        found = config.items.find((item) => item.isActive);
      }

      setActiveBg(found || null);
    };

    updateActiveBg();

    const handleStorageChange = (e?: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent?.detail) {
        setActiveBg(customEvent.detail);
        return;
      }
      updateActiveBg();
    };

    const handleConfigUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<BackgroundsConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("kse_bg_changed", handleStorageChange);
    window.addEventListener("kse_bg_config_updated", handleConfigUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("kse_bg_changed", handleStorageChange);
      window.removeEventListener("kse_bg_config_updated", handleConfigUpdate as EventListener);
    };
  }, [config]);

  // تحديد الرابط والنوع المناسبين للوضع الحالي
  const url = activeBg ? (isDark ? activeBg.darkUrl : activeBg.lightUrl) : "";
  const type = activeBg ? (isDark ? activeBg.darkType : activeBg.lightType) : "image";

  if (!mounted || !activeBg) return null;

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
      {type === "image" && url ? (
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
