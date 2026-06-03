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
  const [forceRerun, setForceRerun] = useState(0);

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

  // تحديد الرابط والنوع المناسبين للوضع الحالي
  const url = activeBg ? (isDark ? activeBg.darkUrl : activeBg.lightUrl) : "";
  const type = activeBg ? (isDark ? activeBg.darkType : activeBg.lightType) : "image";

  // تشغيل وتنظيف الأكواد المخصصة (JavaScript/Canvas)
  useEffect(() => {
    if (!mounted || !activeBg) return;

    const currentUrl = isDark ? activeBg.darkUrl : activeBg.lightUrl;
    const currentType = isDark ? activeBg.darkType : activeBg.lightType;

    if (currentType !== "code" || !currentUrl) {
      return;
    }

    // الانتظار للتأكد من رندرة الـ Canvas بالـ DOM
    const timer = setTimeout(() => {
      try {
        const addedListeners: { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject; options?: boolean | AddEventListenerOptions }[] = [];
        
        const originalWindowAdd = window.addEventListener;
        const originalDocAdd = document.addEventListener;

        window.addEventListener = function(type, listener, options) {
          addedListeners.push({ target: window, type, listener, options });
          return originalWindowAdd.call(window, type, listener, options);
        };

        document.addEventListener = function(type, listener, options) {
          addedListeners.push({ target: document, type, listener, options });
          return originalDocAdd.call(document, type, listener, options);
        };

        // استبدال requestAnimationFrame لمنع تشغيل اللوب بعد مسح الكانفاس
        const originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = function(cb) {
          return originalRAF(function(time) {
            if (!document.getElementById("custom-bg-canvas")) {
              return;
            }
            cb(time);
          });
        };

        (window as any).isDarkMode = isDark;
        (window as any).isDark = isDark;

        const scriptId = "custom-bg-script";
        const oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();

        const cleanedCode = currentUrl
          .replace(/<script[^>]*>/gi, "")
          .replace(/<\/script>/gi, "");

        const script = document.createElement("script");
        script.id = scriptId;
        
        script.textContent = `
          (function() {
            try {
              var isDarkMode = ${isDark ? "true" : "false"};
              var isDark = ${isDark ? "true" : "false"};
              ${cleanedCode}
            } catch (err) {
              console.error("خطأ أثناء تشغيل الخلفية البرمجية المخصصة:", err);
            }
          })();
        `;
        
        document.body.appendChild(script);

        window.addEventListener = originalWindowAdd;
        document.addEventListener = originalDocAdd;

        (window as any).__cleanupCustomBg = () => {
          window.addEventListener = originalWindowAdd;
          document.addEventListener = originalDocAdd;
          window.requestAnimationFrame = originalRAF;

          addedListeners.forEach(({ target, type, listener, options }) => {
            target.removeEventListener(type, listener, options);
          });

          const s = document.getElementById(scriptId);
          if (s) s.remove();
          
          if (typeof (window as any).setBgTheme === "function") {
            delete (window as any).setBgTheme;
          }
          delete (window as any).isDarkMode;
          delete (window as any).isDark;
        };

      } catch (err) {
        console.error("فشل إعداد وحقن الخلفية البرمجية:", err);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (typeof (window as any).__cleanupCustomBg === "function") {
        (window as any).__cleanupCustomBg();
        delete (window as any).__cleanupCustomBg;
      }
    };
  }, [activeBg?.id, url, forceRerun, mounted]);

  // استدعاء تغير المظهر للسكريبت في حال تغير الثيم
  useEffect(() => {
    if (!mounted || !activeBg) return;

    const currentType = isDark ? activeBg.darkType : activeBg.lightType;
    if (currentType !== "code") return;

    (window as any).isDarkMode = isDark;
    (window as any).isDark = isDark;

    if (typeof (window as any).setBgTheme === "function") {
      try {
        (window as any).setBgTheme(isDark);
      } catch (e) {
        console.error("خطأ أثناء استدعاء setBgTheme للثيم الحركي:", e);
      }
    } else {
      setForceRerun((prev) => prev + 1);
    }
  }, [isDark, mounted, activeBg?.id]);

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
      {type === "code" && url ? (
        <div id="custom-canvas-container" className="w-full h-full block bg-transparent">
          <canvas id="custom-bg-canvas" className="w-full h-full block bg-transparent" />
        </div>
      ) : type === "video" && url ? (
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
