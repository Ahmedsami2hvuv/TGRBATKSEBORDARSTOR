"use client";

import { useEffect, useState } from "react";
import { getStaticBackgroundsConfigAction } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/site-backgrounds-actions";
import { StaticBackgroundsConfig, StaticBackgroundItem } from "@/lib/site-backgrounds";
import { useTheme } from "./theme-provider";

export function StaticBackground() {
  const [config, setConfig] = useState<StaticBackgroundsConfig | null>(null);
  const [activeBg, setActiveBg] = useState<StaticBackgroundItem | null>(null);
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 1. جلب التكوين من الكاش المحلي أولاً للسرعة ثم من السيرفر في الخلفية
  useEffect(() => {
    setMounted(true);

    const cached = localStorage.getItem("kse_backgrounds_config_cache");
    if (cached) {
      try {
        setConfig(JSON.parse(cached));
      } catch (e) {
        console.error("فشل قراءة كاش الخلفيات:", e);
      }
    }

    getStaticBackgroundsConfigAction()
      .then((data: any) => {
        if (data && data.items) {
          setConfig(data);
          localStorage.setItem("kse_backgrounds_config_cache", JSON.stringify(data));
          window.dispatchEvent(new CustomEvent("kse_static_bg_updated", { detail: data }));
        }
      })
      .catch((err) => console.error("فشل جلب الخلفيات الثابتة:", err));
  }, []);

  // 2. تتبع ومراقبة تغيرات الوضع الليلي والنهاري
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

  // 3. تحديد الخلفية النشطة للمستخدم ومزامنتها
  useEffect(() => {
    if (!config) return;

    const updateActiveBg = () => {
      const savedBgId = localStorage.getItem("kse_user_background");
      const defaultBgId = config.defaultBackgroundId;
      const targetId = savedBgId || defaultBgId;

      const found = config.items.find((item) => item.id === targetId && item.isActive);
      // إذا لم يجد الخلفية المحددة أو كانت معطلة، استخدم أول خلفية نشطة
      if (!found) {
        const firstActive = config.items.find((item) => item.isActive);
        setActiveBg(firstActive || null);
      } else {
        setActiveBg(found);
      }
    };

    updateActiveBg();

    const handleStorageChange = () => {
      updateActiveBg();
    };

    const handleConfigUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<StaticBackgroundsConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("kse_static_bg_changed", handleStorageChange as EventListener);
    window.addEventListener("kse_static_bg_updated", handleConfigUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("kse_static_bg_changed", handleStorageChange as EventListener);
      window.removeEventListener("kse_static_bg_updated", handleConfigUpdate as EventListener);
    };
  }, [config]);

  // 4. تحديد صورة الخلفية للوضع الحالي
  const url = activeBg ? (isDark ? activeBg.darkUrl : activeBg.lightUrl) : "";

  // 5. حقن سمة data-has-custom-bg في عنصر html لتطبيق المظهر الزجاجي في globals.css
  useEffect(() => {
    if (!mounted) return;
    if (activeBg && url) {
      document.documentElement.setAttribute("data-has-custom-bg", "true");
    } else {
      document.documentElement.removeAttribute("data-has-custom-bg");
    }
  }, [activeBg, url, mounted]);

  if (!mounted || !activeBg || !url) return null;

  return (
    <div className="fixed inset-0 w-full h-full -z-50 pointer-events-none overflow-hidden select-none bg-transparent">
      <img
        src={url}
        alt=""
        className="w-full h-full object-cover"
        key={url}
      />
    </div>
  );
}
