"use client";

import React, { useState, useRef, useEffect } from "react";
import { updateOrderLandmarkAction } from "@/app/actions/update-landmark";

interface InlineLandmarkEditorProps {
  orderId: string;
  initialLandmark: string;
  isSecondDestination?: boolean;
  fontSizeConfig?: any; // To apply custom font size
  isFromProfile?: boolean;
  label?: string; // e.g., "📍 أقرب نقطة دالة:" or "📍 النقطة الدالة:"
}

export function InlineLandmarkEditor({
  orderId,
  initialLandmark,
  isSecondDestination = false,
  fontSizeConfig,
  isFromProfile = false,
  label = "📍 دالة:"
}: InlineLandmarkEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [landmark, setLandmark] = useState(initialLandmark);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLandmark(initialLandmark);
  }, [initialLandmark]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.value.length;
          textareaRef.current.selectionEnd = textareaRef.current.value.length;
        }
      }, 50);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await updateOrderLandmarkAction(orderId, landmark.trim(), isSecondDestination);
      if (res.error) {
        setError(res.error);
      } else {
        setIsOpen(false);
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setLandmark(initialLandmark);
      setIsOpen(false);
      setError(null);
    }
  };

  const labelFontSize = fontSizeConfig ? `${Math.max(10, fontSizeConfig.landmarkFontSize - 3)}px` : '11px';
  const valueFontSize = fontSizeConfig ? `${fontSizeConfig.landmarkFontSize + 2}px` : '16px';

  return (
    <>
      {/* Trigger Block */}
      <div
        onClick={() => setIsOpen(true)}
        title="انقر لتعديل النقطة الدالة"
        className="group relative flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20 p-2.5 border border-rose-200/80 dark:border-rose-800/40 kse-landmark-text cursor-pointer hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 w-full"
      >
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <span
            className="font-bold text-rose-600 dark:text-rose-400 shrink-0 select-none flex items-center gap-1"
            style={{ fontSize: labelFontSize }}
          >
            {label}
          </span>
          <span
            className="font-black text-rose-950 dark:text-rose-100 leading-tight flex-1 break-words"
            style={{ fontSize: valueFontSize }}
          >
            {initialLandmark || "— انقر لإضافة أو تعديل النقطة الدالة —"}
            {isFromProfile && (
              <span
                className="mr-1.5 text-[9px] text-rose-500/80 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.5 rounded-md"
                style={fontSizeConfig ? { fontSize: `${Math.max(9, fontSizeConfig.landmarkFontSize - 4)}px` } : undefined}
              >
                (من السجل)
              </span>
            )}
          </span>
        </div>

        {/* Edit Action Icon Badge */}
        <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-300 shadow-sm border border-rose-100 dark:border-rose-900/40 group-hover:bg-rose-600 group-hover:text-white transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
      </div>

      {/* Floating Modal Window */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => {
            if (!loading) {
              setLandmark(initialLandmark);
              setIsOpen(false);
              setError(null);
            }
          }}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-200 dir-rtl text-right overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg sm:text-xl shadow-inner shrink-0">
                  📍
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                    تعديل أقرب نقطة دالة
                  </h3>
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                    تعديل النقطة الدالة للطلب
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!loading) {
                    setLandmark(initialLandmark);
                    setIsOpen(false);
                    setError(null);
                  }
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto py-3 space-y-3 flex-1">
              {/* Error Message if any */}
              {error && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Main Textarea Block */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 px-1">
                  <span>نص أقرب نقطة دالة:</span>
                  {landmark && (
                    <button
                      type="button"
                      onClick={() => setLandmark("")}
                      className="text-[11px] text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 underline font-bold cursor-pointer"
                    >
                      مسح النص
                    </button>
                  )}
                </div>

                <textarea
                  ref={textareaRef}
                  rows={3}
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="اكتب أقرب نقطة دالة هنا..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 focus:border-rose-500 dark:focus:border-rose-500 rounded-2xl p-3 text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 outline-none resize-none transition-all shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-600 leading-relaxed"
                />
              </div>
            </div>

            {/* Actions Footer - Always Visible */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLandmark(initialLandmark);
                  setIsOpen(false);
                  setError(null);
                }}
                disabled={loading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-[100px]"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>جارٍ الحفظ...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>حفظ النقطة الدالة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


