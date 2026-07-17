"use client";

import { useEffect } from "react";

export function BackgroundSynchronizer({ imageUrl }: { imageUrl: string | null }) {
  useEffect(() => {
    // نقرأ القيمة المخزنة حالياً في المتصفح
    const stored = localStorage.getItem("kse_user_background_url");
    
    // القيمة المتوقعة من قاعدة البيانات (إذا كانت null تعني أن المستخدم لم يحدد خلفية خاصة ويرث الافتراضية)
    const expected = imageUrl || "";

    // إذا كانت القيمة في قاعدة البيانات مختلفة عما هو مخزن في المتصفح، نقوم بتحديث المتصفح
    if (stored !== expected && (expected || stored !== "none")) {
      // إذا كانت قاعدة البيانات فارغة والمتصفح لا يمتلك 'none' نقوم بتصفيرها
      // أما إذا كانت قاعدة البيانات تمتلك قيمة صالحة فنحدث المتصفح بها
      if (expected) {
        localStorage.setItem("kse_user_background_url", expected);
      } else {
        localStorage.removeItem("kse_user_background_url");
      }
      
      // إطلاق الحدث المخصص لتحديث الخلفية المخصصة فوراً في المتصفح
      window.dispatchEvent(new CustomEvent("kse_background_changed"));
    }
  }, [imageUrl]);

  return null; // مكون صامت لا يعرض شيئاً في الواجهة
}
