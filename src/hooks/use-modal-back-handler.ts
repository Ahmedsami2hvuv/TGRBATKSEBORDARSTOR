"use client";

import { useEffect, useRef } from "react";

/**
 * هوك احترافي لالتقاط زر الرجوع في الهواتف والمتصفحات (Android / iOS / Browser Back Button)
 * بحيث يُغلق النافذة المنبثقة الحالية (المودال أو الصورة أو النقطة الدالة) فقط
 * ويمنع إغلاق الطلبية أو الرجوع للصفحة السابقة.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void) {
  const isClosedByPopStateRef = useRef(false);
  const pushedStateRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      isClosedByPopStateRef.current = false;
      pushedStateRef.current = false;
      return;
    }

    const stateId = "modal_" + Math.random().toString(36).substring(2, 9);
    window.history.pushState({ modalId: stateId }, "");
    pushedStateRef.current = true;
    isClosedByPopStateRef.current = false;

    const handlePopState = () => {
      isClosedByPopStateRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // إذا أغلقت النافذة عبر زر الإغلاق ✕ أو النقر بالخلفية وليس عبر زر الرجوع في الهاتف
      if (pushedStateRef.current && !isClosedByPopStateRef.current) {
        if (window.history.state?.modalId === stateId) {
          window.history.back();
        }
      }
    };
  }, [isOpen]);
}
