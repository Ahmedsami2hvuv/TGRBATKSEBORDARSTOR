"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type FontSizeConfig = {
  landmarkFontSize: number; // بالبكسل أو النسبة المئوية
  locationBtnSize: number;
  smartHintFontSize: number;
  globalFontSize: number;
  globalBtnSize: number;
};

const defaultConfig: FontSizeConfig = {
  landmarkFontSize: 14,
  locationBtnSize: 14,
  smartHintFontSize: 14,
  globalFontSize: 16,
  globalBtnSize: 14,
};

type FontSizeContextType = {
  config: FontSizeConfig;
  updateConfig: (newConfig: Partial<FontSizeConfig>) => void;
  resetConfig: () => void;
};

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<FontSizeConfig>(defaultConfig);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("kse_font_size_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig({ ...defaultConfig, ...parsed });
      } catch (e) {
        console.error("Failed to parse font size config", e);
      }
    }

    // الاستماع لحدث مخصص لتحديث الخط عند الحفظ في تبويب أو نافذة أخرى
    const handleFontChange = () => {
      const updated = localStorage.getItem("kse_font_size_config");
      if (updated) {
        try {
          setConfig({ ...defaultConfig, ...JSON.parse(updated) });
        } catch (e) {}
      }
    };
    window.addEventListener("kse_font_changed", handleFontChange);
    return () => window.removeEventListener("kse_font_changed", handleFontChange);
  }, []);

  const updateConfig = (newConfig: Partial<FontSizeConfig>) => {
    const next = { ...config, ...newConfig };
    setConfig(next);
    localStorage.setItem("kse_font_size_config", JSON.stringify(next));
    window.dispatchEvent(new Event("kse_font_changed"));
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    localStorage.removeItem("kse_font_size_config");
    window.dispatchEvent(new Event("kse_font_changed"));
  };

  // حقن متغيرات CSS في حاوية علوية
  const cssVariables = mounted
    ? {
        "--kse-landmark-font-size": `${config.landmarkFontSize}px`,
        "--kse-location-btn-size": `${config.locationBtnSize}px`,
        "--kse-smart-hint-font-size": `${config.smartHintFontSize}px`,
        "--kse-global-font-size": `${config.globalFontSize}px`,
        "--kse-global-btn-size": `${config.globalBtnSize}px`,
        "--kse-global-font-scale": config.globalFontSize / 16,
        "--kse-global-btn-scale": config.globalBtnSize / 14,
      } as React.CSSProperties
    : {};

  return (
    <FontSizeContext.Provider value={{ config, updateConfig, resetConfig }}>
      <div style={cssVariables} className="font-size-root w-full min-h-screen">
        {mounted && (
          <style dangerouslySetInnerHTML={{
            __html: `
              .kse-landmark-text {
                font-size: var(--kse-landmark-font-size) !important;
              }
              .kse-location-btn, 
              a[href*="google.com/maps"],
              a[href*="maps.google"],
              a[href*="apple.com/maps"],
              a[href*="maps.apple"],
              .kse-location-btn-class {
                font-size: var(--kse-location-btn-size) !important;
              }
              .kse-smart-hint-text {
                font-size: var(--kse-smart-hint-font-size) !important;
              }
              
              /* تكبير كافة نصوص كلاسات Tailwind النصية بشكل ملحوظ وقوي */
              .font-size-root .text-xs { font-size: calc(0.75rem * var(--kse-global-font-scale, 1)) !important; }
              .font-size-root .text-sm { font-size: calc(0.875rem * var(--kse-global-font-scale, 1)) !important; }
              .font-size-root .text-base { font-size: calc(1rem * var(--kse-global-font-scale, 1)) !important; }
              .font-size-root .text-lg { font-size: calc(1.125rem * var(--kse-global-font-scale, 1)) !important; }
              .font-size-root .text-xl { font-size: calc(1.25rem * var(--kse-global-font-scale, 1)) !important; }
              .font-size-root .text-2xl { font-size: calc(1.5rem * var(--kse-global-font-scale, 1)) !important; }
              .font-size-root .text-3xl { font-size: calc(1.875rem * var(--kse-global-font-scale, 1)) !important; }
              .font-size-root .text-4xl { font-size: calc(2.25rem * var(--kse-global-font-scale, 1)) !important; }

              /* تكبير أحجام الخطوط العامة والنصوص المباشرة في العناصر */
              .font-size-root,
              .font-size-root p,
              .font-size-root span:not(.kse-landmark-text):not(.kse-smart-hint-text),
              .font-size-root td,
              .font-size-root th,
              .font-size-root h1,
              .font-size-root h2,
              .font-size-root h3,
              .font-size-root h4,
              .font-size-root div:not([style*="--"]) {
                font-size: calc(1em * var(--kse-global-font-scale, 1));
              }

              /* تكبير وتوسيع أحجام وحشوات الأزرار وعناصر الاتصال والمراسلة بشكل ملحوظ */
              .font-size-root button,
              .font-size-root a[href^="tel:"],
              .font-size-root a[href*="wa.me"],
              .font-size-root a[href*="t.me"],
              .font-size-root .btn,
              .font-size-root .kse-btn {
                font-size: calc(1em * var(--kse-global-btn-scale, 1)) !important;
                padding-top: calc(0.4rem * var(--kse-global-btn-scale, 1)) !important;
                padding-bottom: calc(0.4rem * var(--kse-global-btn-scale, 1)) !important;
              }
            `
          }} />
        )}
        {children}
      </div>
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error("useFontSize must be used within a FontSizeProvider");
  }
  return context;
}
