"use client";

import { useEffect } from "react";

export function AdminGestureHandler() {
  useEffect(() => {
    // تعريف الدالة العالمية لتنفيذ إجراءات الأندرويد لصفحة المدير
    (window as any).executeGestureActionFromAndroid = (action: string) => {
      console.log("إجراء مستلم من أندرويد المدير:", action);
      const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

      switch (action) {
        case "open_dashboard":
          window.location.href = SECRET_ADMIN_PATH;
          break;
        case "open_orders":
          window.location.href = `${SECRET_ADMIN_PATH}/orders/new`;
          break;
        case "open_credit_book":
          window.location.href = `${SECRET_ADMIN_PATH}/credit-book`;
          break;
        case "open_reports":
          window.location.href = `${SECRET_ADMIN_PATH}/reports`;
          break;
        case "open_customers":
          window.location.href = `${SECRET_ADMIN_PATH}/customers`;
          break;
        case "open_couriers":
          window.location.href = `${SECRET_ADMIN_PATH}/couriers`;
          break;
        case "open_preparers":
          window.location.href = `${SECRET_ADMIN_PATH}/preparers`;
          break;
        case "open_settings":
          window.location.href = `${SECRET_ADMIN_PATH}/settings`;
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
      localStorage.setItem("kse_admin_gesture_zoom", `${currentZoom}%`);
    }

    // استعادة حجم الخط المحفوظ
    const savedZoom = localStorage.getItem("kse_admin_gesture_zoom");
    if (savedZoom) {
      document.body.style.zoom = savedZoom;
    }

    // دالة لتبديل وضع الخصوصية
    function togglePrivacyMode() {
      const isPrivate = localStorage.getItem("kse_admin_gesture_privacy") === "true";
      const newStatus = !isPrivate;
      localStorage.setItem("kse_admin_gesture_privacy", String(newStatus));
      applyPrivacyMode(newStatus);
    }

    function applyPrivacyMode(enable: boolean) {
      let styleEl = document.getElementById("kse-admin-privacy-style");
      if (enable) {
        if (!styleEl) {
          styleEl = document.createElement("style");
          styleEl.id = "kse-admin-privacy-style";
          styleEl.innerHTML = `
            /* تمويه المبالغ المالية والديون للمدير */
            .kse-admin-privacy-blur {
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
      const allElements = document.querySelectorAll("span, p, div, h1, h2, h3, td, th, b, strong");
      allElements.forEach((el) => {
        const text = el.textContent || "";
        if (el.children.length === 0 && (text.includes("د.ع") || text.includes("$") || /(\d+[\d,.]*)/.test(text))) {
          if (!text.includes("077") && !text.includes("078") && !text.includes("075") && !text.startsWith("#")) {
            if (blur) {
              el.classList.add("kse-admin-privacy-blur");
            } else {
              el.classList.remove("kse-admin-privacy-blur");
            }
          }
        }
      });
    }

    const isPrivate = localStorage.getItem("kse_admin_gesture_privacy") === "true";
    if (isPrivate) {
      setTimeout(() => applyPrivacyMode(true), 500);
      setTimeout(() => applyPrivacyMode(true), 1500);
    }
  }, []);

  return null;
}
