"use client";

import { useEffect } from "react";

/**
 * داخل أي نموذج: الضغط على Enter يُرسِل النموذج (كزر «تحديث / إرسال / بحث»).
 * يُستثنى: textarea، محتوى قابل للتحرير، عناصر data-enter-omit، ونماذج data-no-enter-submit.
 */
export function EnterSubmitGlobal() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented) return;
      if (e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.isContentEditable) return;
      if (t.closest("[data-enter-omit]")) return;

      const tag = t.tagName;
      if (tag === "TEXTAREA") return;
      if (tag === "A") return;

      const form = t.closest("form");
      if (!form || form.hasAttribute("data-no-enter-submit")) return;

      if (tag === "BUTTON") {
        const b = t as HTMLButtonElement;
        if (b.type === "button" || b.type === "reset") return;
      }
      if (tag === "INPUT") {
        const inp = t as HTMLInputElement;
        if (inp.type === "submit" || inp.type === "button" || inp.type === "reset") return;
        if (inp.type === "file") return;
      }

      e.preventDefault();
      e.stopPropagation();
      form.requestSubmit();
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
