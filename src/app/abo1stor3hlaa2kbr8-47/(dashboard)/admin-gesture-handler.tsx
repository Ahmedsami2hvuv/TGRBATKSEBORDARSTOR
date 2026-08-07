"use client";

import { useEffect } from "react";

export function AdminGestureHandler() {
  useEffect(() => {
    const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

    // تعريف الدالة العالمية لتنفيذ إجراءات الإيماءات للمدير
    (window as any).executeGestureActionFromAndroid = (action: string) => {
      console.log("تأكيد تنفيذ الإجراء للمدير:", action);

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
        case "open_whatsapp":
          window.open("https://api.whatsapp.com/send?phone=9647733921468&text=" + encodeURIComponent("مرحباً إدارة أبو الأكبر"), "_blank");
          break;
        case "open_telegram":
          window.open("https://t.me/Reozaki_94", "_blank");
          break;
        case "privacy_mode":
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

    // كاشف إيماءات الأصابع التفاعلي المباشر بالويب (Web Touch Gesture Listener)
    // يضمن العمل المباشر 100% فوراً دون الحاجة لتحديث تطبيق الأندرويد APK
    let touchStartX = 0;
    let touchStartY = 0;
    let maxFingers = 0;
    let touchStartTime = 0;
    let longPressTimer: any = null;
    let isGestureExecuted = false;

    function handleTouchStart(e: TouchEvent) {
      const fingers = e.touches.length;
      if (fingers >= 2 && fingers <= 5) {
        if (!isGestureExecuted) {
          maxFingers = Math.max(maxFingers, fingers);
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = Date.now();

          // بدء مؤقت النقر المطول
          if (longPressTimer) clearTimeout(longPressTimer);
          longPressTimer = setTimeout(() => {
            if (!isGestureExecuted && maxFingers >= 2) {
              isGestureExecuted = true;
              triggerGesture(`long_press_${maxFingers}`);
            }
          }, 1600);
        }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      const fingers = e.touches.length;
      if (fingers >= 2 && fingers <= 5 && !isGestureExecuted) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - touchStartX;
        const deltaY = currentY - touchStartY;
        const swipeThreshold = 50; // مسافة خفيفة جداً لسهولة الاستجابة 50px

        if (Math.abs(deltaX) > swipeThreshold || Math.abs(deltaY) > swipeThreshold) {
          if (longPressTimer) clearTimeout(longPressTimer);
          isGestureExecuted = true;
          const dir = Math.abs(deltaX) > Math.abs(deltaY)
            ? (deltaX > 0 ? "right" : "left")
            : (deltaY > 0 ? "down" : "up");
          triggerGesture(`swipe_${fingers}_${dir}`);
        }
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (longPressTimer) clearTimeout(longPressTimer);
      const remainingFingers = e.touches.length;

      if (remainingFingers === 0) {
        const duration = Date.now() - touchStartTime;
        // إذا تم النقر والسحب لم يكن مسافة كبيرة، واعُتبرت نقرة سريعة خفيفة (أقل من 600ms)
        if (!isGestureExecuted && maxFingers >= 2 && maxFingers <= 5 && duration < 600) {
          isGestureExecuted = true;
          triggerGesture(`tap_${maxFingers}`);
        }
        
        setTimeout(() => {
          isGestureExecuted = false;
          maxFingers = 0;
        }, 150);
      }
    }

    function triggerGesture(gestureKey: string) {
      const action = localStorage.getItem(`gesture_${gestureKey}`) || "none";
      console.log(`تم التقاط إيماءة أصابع بالويب للمدير: key=${gestureKey}, action=${action}`);
      if (action !== "none") {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try { navigator.vibrate(80); } catch (e) {}
        }
        (window as any).executeGestureActionFromAndroid?.(action);
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

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

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  return null;
}
