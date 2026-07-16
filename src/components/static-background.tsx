"use client";

import { useEffect, useState } from "react";

export function StaticBackground() {
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    // دالة تحديث الحالة وتطبيق فئة التنسيق الزجاجي على الـ body
    const updateBackground = () => {
      const stored = localStorage.getItem("kse_user_background_url");
      setBgUrl(stored);

      if (stored) {
        document.body.classList.add("has-custom-bg");
      } else {
        document.body.classList.remove("has-custom-bg");
      }
    };

    // التشغيل المبدئي
    updateBackground();

    // الاستماع للتغييرات في التخزين المحلي
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "kse_user_background_url") {
        updateBackground();
      }
    };

    // الاستماع للحدث المخصص للتغيير الفوري بنفس التبويب
    window.addEventListener("storage", handleStorage);
    window.addEventListener("kse_background_changed", updateBackground);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("kse_background_changed", updateBackground);
    };
  }, []);

  if (!bgUrl) return null;

  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none bg-cover bg-center bg-no-repeat transition-all duration-500"
      style={{
        backgroundImage: `url(${bgUrl})`,
        opacity: 0.9, // شفافية خفيفة للخلفية ليتناسق النص فوقها
      }}
    />
  );
}

