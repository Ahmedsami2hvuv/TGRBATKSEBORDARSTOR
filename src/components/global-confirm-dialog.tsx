"use client";

import React, { useEffect, useState, useCallback } from "react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  isAlert?: boolean;
};

type DialogState = (ConfirmOptions & {
  resolve: (value: boolean) => void;
}) | null;

let globalShowConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * دالة عالمية قابلة للاستدعاء من أي مكان بالموقع لإظهار نافذة التأكيد المخصصة
 */
export function customConfirm(options: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === "string" ? { message: options } : options;
  if (globalShowConfirm) {
    return globalShowConfirm(opts);
  }
  // في حال استدعائها قبل تهيئة الواجهة
  return Promise.resolve(window.confirm(opts.message));
}

/**
 * دالة عالمية قابلة للاستدعاء من أي مكان بالموقع لإظهار نافذة تنبيه مخصصة
 */
export function customAlert(message: string, title?: string): Promise<boolean> {
  return customConfirm({
    title: title || "تنبيه",
    message,
    confirmText: "حسناً",
    isAlert: true,
    type: "info",
  });
}

export function GlobalConfirmDialog() {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [animating, setAnimating] = useState(false);

  const handleOpen = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        ...options,
        resolve,
      });
      setTimeout(() => setAnimating(true), 10);
    });
  }, []);

  useEffect(() => {
    globalShowConfirm = handleOpen;

    // استبدال نافذة المتصفح الافتراضية بنظيرتها المخصصة في بيئة العميل
    const originalConfirm = window.confirm;
    const originalAlert = window.alert;

    window.confirm = (msg?: string): boolean => {
      // إظهار المودال للمستخدم
      customConfirm({
        title: "تأكيد الإجراء",
        message: msg || "هل أنت متأكد من المتابعة؟",
        type: "warning",
      });
      // لإيقاف السلوك التلقائي المباشر في المتصفح حتى يتم التعامل معه
      return false;
    };

    window.alert = (msg?: string): void => {
      customAlert(msg || "");
    };

    return () => {
      window.confirm = originalConfirm;
      window.alert = originalAlert;
      globalShowConfirm = null;
    };
  }, [handleOpen]);

  const handleClose = (result: boolean) => {
    setAnimating(false);
    setTimeout(() => {
      if (dialog) {
        dialog.resolve(result);
        setDialog(null);
      }
    }, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialog) return;
      if (e.key === "Escape") {
        handleClose(false);
      } else if (e.key === "Enter") {
        handleClose(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog]);

  if (!dialog) return null;

  const isDanger = dialog.type === "danger" || !dialog.type;
  const isWarning = dialog.type === "warning";

  return (
    <div
      className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
        animating ? "bg-slate-950/70 backdrop-blur-md opacity-100" : "bg-slate-950/0 backdrop-blur-none opacity-0"
      }`}
      onClick={() => !dialog.isAlert && handleClose(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md transform overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 text-right shadow-2xl transition-all duration-300 border border-slate-200/80 dark:border-slate-800 ${
          animating ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-4 opacity-0"
        }`}
      >
        {/* خلفية جمالية ملونة خفيفة */}
        <div
          className={`absolute -top-24 -right-24 h-48 w-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isDanger ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-sky-500"
          }`}
        />

        <div className="flex flex-col items-center text-center">
          {/* أيقونة التنبيه */}
          <div
            className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ring-8 transition-transform duration-300 hover:scale-105 ${
              isDanger
                ? "bg-rose-100 text-rose-600 ring-rose-50 dark:bg-rose-950/80 dark:text-rose-400 dark:ring-rose-950/40"
                : isWarning
                ? "bg-amber-100 text-amber-600 ring-amber-50 dark:bg-amber-950/80 dark:text-amber-400 dark:ring-amber-950/40"
                : "bg-sky-100 text-sky-600 ring-sky-50 dark:bg-sky-950/80 dark:text-sky-400 dark:ring-sky-950/40"
            }`}
          >
            {isDanger ? (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : isWarning ? (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007v.008H12v-.008s0 0 0 0zM12 3v.008m9 9a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            )}
          </div>

          {/* العنوان */}
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {dialog.title || (dialog.isAlert ? "تنبيه" : "تأكيد الإجراء")}
          </h3>

          {/* نص الرسالة */}
          <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line px-2">
            {dialog.message}
          </p>

          {/* الأزرار */}
          <div className="mt-7 flex w-full items-center justify-center gap-3">
            {!dialog.isAlert && (
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="flex-1 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 shadow-sm"
              >
                {dialog.cancelText || "إلغاء الأمر"}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleClose(true)}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white transition-all active:scale-95 shadow-lg ${
                isDanger
                  ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-500/25"
                  : isWarning
                  ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/25"
                  : "bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 shadow-sky-500/25"
              }`}
            >
              {dialog.confirmText || (dialog.isAlert ? "حسناً" : "موافق")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
