"use client";

import { useEffect } from "react";

export function GestureHandler() {
  useEffect(() => {
    // تعريف الدالة العالمية لتنفيذ إجراءات الأندرويد
    (window as any).executeGestureActionFromAndroid = (action: string) => {
      console.log("إجراء مستلم من الأندرويد:", action);
      const search = window.location.search || "";

      switch (action) {
        case "create_order":
          window.location.href = `/preparer/order/new${search}`;
          break;
        case "debts_list":
          window.location.href = `/preparer/debts${search}`;
          break;
        case "latest_order":
          window.location.href = `/preparer${search}`;
          break;
        case "reload_page":
          window.location.reload();
          break;
        case "privacy_mode":
          // تبديل وضع الخصوصية لإخفاء المبالغ المالية
          togglePrivacyMode();
          break;
        case "text_zoom_in":
          changeTextZoom(true);
          break;
        case "text_zoom_out":
          changeTextZoom(false);
          break;
        default:
          break;
      }
    };

    // دالة لتغيير حجم الخط
    function changeTextZoom(zoomIn: boolean) {
      const currentZoomStr = document.body.style.zoom || "100%";
      let currentZoom = parseInt(currentZoomStr) || 100;
      if (zoomIn) {
        currentZoom = Math.min(currentZoom + 1, 160);
      } else {
        currentZoom = Math.max(currentZoom - 1, 80);
      }
      document.body.style.zoom = `${currentZoom}%`;
      localStorage.setItem("kse_gesture_zoom", `${currentZoom}%`);
    }

    // استعادة حجم الخط المحفوظ
    const savedZoom = localStorage.getItem("kse_gesture_zoom");
    if (savedZoom) {
      document.body.style.zoom = savedZoom;
    }

    // دالة لتبديل وضع الخصوصية
    function togglePrivacyMode() {
      const isPrivate = localStorage.getItem("kse_gesture_privacy") === "true";
      const newStatus = !isPrivate;
      localStorage.setItem("kse_gesture_privacy", String(newStatus));
      applyPrivacyMode(newStatus);
    }

    function applyPrivacyMode(enable: boolean) {
      let styleEl = document.getElementById("kse-privacy-style");
      if (enable) {
        if (!styleEl) {
          styleEl = document.createElement("style");
          styleEl.id = "kse-privacy-style";
          styleEl.innerHTML = `
            /* تمويه المبالغ المالية والديون */
            .kse-privacy-blur {
              filter: blur(6px) !important;
              pointer-events: none !important;
              user-select: none !important;
              opacity: 0.8 !important;
            }
          `;
          document.head.appendChild(styleEl);
        }
        blurMoneyTexts(true);
      } else {
        if (styleEl) {
          styleEl.remove();
        }
        blurMoneyTexts(false);
      }
    }

    function blurMoneyTexts(blur: boolean) {
      // البحث عن العناصر التي تحتوي على نصوص مبالغ مالية وتمويهها
      const allElements = document.querySelectorAll("span, p, div, h1, h2, h3, td");
      allElements.forEach((el) => {
        const text = el.textContent || "";
        // التحقق مما إذا كان النص يحتوي على أرقام أو إشارة الدينار ولا يحتوي على تفريعات كثيرة
        if (el.children.length === 0 && (text.includes("د.ع") || /(\d+[\d,.]*)/.test(text))) {
          // استثناء أرقام الهواتف أو أرقام الطلبات من التمويه
          if (!text.includes("077") && !text.includes("078") && !text.includes("075") && !text.startsWith("#")) {
            if (blur) {
              el.classList.add("kse-privacy-blur");
            } else {
              el.classList.remove("kse-privacy-blur");
            }
          }
        }
      });
    }

    // تطبيق وضع الخصوصية المحفوظ تلقائياً عند تحميل الصفحة
    const isPrivate = localStorage.getItem("kse_gesture_privacy") === "true";
    if (isPrivate) {
      // ننتظر قليلاً للتأكد من اكتمال بناء الصفحة
      setTimeout(() => applyPrivacyMode(true), 500);
      setTimeout(() => applyPrivacyMode(true), 1500);
    }
  }, []);

  return null;
}
