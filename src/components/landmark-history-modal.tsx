"use client";

import React, { useState } from "react";
import { LandmarkHistoryEntry } from "@/lib/landmark-history";
import { useModalBackHandler } from "@/hooks/use-modal-back-handler";

interface LandmarkHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  currentLandmark: string;
  currentModifierName?: string | null;
  currentUpdatedAt?: string | Date | null;
  history: LandmarkHistoryEntry[];
  onSelectLandmarkToEdit?: (landmarkText: string) => void;
}

export function LandmarkHistoryModal({
  isOpen,
  onClose,
  title = "سجل تعديلات أقرب نقطة دالة",
  currentLandmark,
  currentModifierName,
  currentUpdatedAt,
  history,
  onSelectLandmarkToEdit,
}: LandmarkHistoryModalProps) {
  useModalBackHandler(isOpen, onClose);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const formatDate = (dateInput?: string | Date | null) => {
    if (!dateInput) return "تاريخ غير محدد";
    try {
      const d = new Date(dateInput);
      return d.toLocaleDateString("ar-IQ", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dateInput);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-lg rounded-[24px] border-[2px] border-[#FFE082] bg-[#FFFEF8] p-4 sm:p-5 shadow-[0_12px_45px_rgba(0,0,0,0.35)] text-right animate-in zoom-in-95 duration-200 relative overflow-hidden my-auto max-h-[90vh] flex flex-col select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* شريط العنوان */}
        <div className="flex items-center justify-between border-b-[1.5px] border-[#FFE082]/40 pb-3 mb-3 bg-gradient-to-r from-amber-50 to-orange-50/30 -mx-4 -mt-4 p-3.5 sm:-mx-5 sm:-mt-5 sm:p-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-[34px] h-[34px] rounded-[12px] bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-sm border border-amber-500/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-800 leading-tight">
                {title}
              </h3>
              <p className="text-[11px] font-bold text-amber-900/70">
                عرض التعديلات السابقة وأسماء من قاموا بالتغيير
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-amber-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 font-black flex items-center justify-center cursor-pointer text-sm shadow-xs transition"
            title="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* محتوى السجل */}
        <div className="overflow-y-auto space-y-3.5 pr-0.5 max-h-[calc(90vh-140px)]">
          {/* 1. النسخة الحالية المعتمَدة */}
          <div className="rounded-[18px] border-[2px] border-emerald-400 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-3.5 shadow-xs relative">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-xs">
                  النسخة الحالية
                </span>
                {currentModifierName && (
                  <span className="text-[11px] font-black text-emerald-900">
                    بواسطة: {currentModifierName}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopy("current", currentLandmark)}
                className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-white/80 hover:bg-white px-2 py-1 rounded-lg border border-emerald-300 transition cursor-pointer"
              >
                {copiedId === "current" ? "✓ تم النسخ" : "📋 نسخ النص"}
              </button>
            </div>
            <p className="text-sm sm:text-base font-black text-emerald-950 leading-relaxed break-words whitespace-pre-wrap">
              {currentLandmark || "لم تُسجل نقطة دالة بعد"}
            </p>
            {currentUpdatedAt && (
              <p className="text-[10px] font-bold text-emerald-700/80 mt-2 text-left" dir="ltr">
                {formatDate(currentUpdatedAt)}
              </p>
            )}
          </div>

          {/* 2. قائمة النسخ والتعديلات السابقة */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <span>النسخ السابقة المحفوظة</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">
                  {history.length}
                </span>
              </h4>
            </div>

            {history.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-2 text-slate-500">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-slate-600">لا توجد نسخ سابقة مسجلة حتى الآن</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  عند قيام أي مندوب بتعديل النقطة الدالة، سيتم حفظ النص القديم واسم الشخص هنا تلقائياً.
                </p>
              </div>
            ) : (
              history.map((item, index) => (
                <div
                  key={item.id || index}
                  className="rounded-[16px] border-[1.5px] border-amber-200/80 bg-white hover:bg-amber-50/30 p-3 shadow-xs transition space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-amber-100/70 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black flex items-center justify-center border border-amber-300">
                        {history.length - index}
                      </span>
                      <span className="text-[11px] font-black text-slate-800">
                        عدّلها: <span className="text-amber-900">{item.changedByName || "مندوب سابق"}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onSelectLandmarkToEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectLandmarkToEdit(item.landmark);
                            onClose();
                          }}
                          className="flex items-center gap-0.5 text-[10px] font-black text-[#0B2E8C] hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition cursor-pointer"
                          title="استرجاع هذا النص ووضعه في التعديل"
                        >
                          <span>↩ استرجاع</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, item.landmark)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                        title="نسخ هذا النص"
                      >
                        {copiedId === item.id ? "✓ نُسخ" : "نسخ"}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug break-words whitespace-pre-wrap">
                    {item.landmark}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-1 text-slate-600 font-bold">
                      <svg className="w-3 h-3 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {formatDate(item.changedAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* أسفل المودال */}
        <div className="flex items-center justify-end pt-3 mt-2 border-t border-[#FFE082]/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-[36px] px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs active:scale-95 transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
