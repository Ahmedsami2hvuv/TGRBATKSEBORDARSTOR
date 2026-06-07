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
  const [isEditing, setIsEditing] = useState(false);
  const [landmark, setLandmark] = useState(initialLandmark);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLandmark(initialLandmark);
  }, [initialLandmark]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await updateOrderLandmarkAction(orderId, landmark, isSecondDestination);
      if (res.error) {
        setError(res.error);
      } else {
        setIsEditing(false);
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setLandmark(initialLandmark);
      setIsEditing(false);
      setError(null);
    }
  };

  const labelFontSize = fontSizeConfig ? `${Math.max(10, fontSizeConfig.landmarkFontSize - 3)}px` : '11px';
  const valueFontSize = fontSizeConfig ? `${fontSizeConfig.landmarkFontSize + 2}px` : '16px';

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-lg p-1">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none border-none px-2 text-slate-800 dark:text-slate-200 font-bold"
            style={{ fontSize: valueFontSize }}
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="اكتب النقطة الدالة هنا..."
          />
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-black transition-colors"
          >
            {loading ? "..." : "حفظ"}
          </button>
          <button
            onClick={() => {
              setLandmark(initialLandmark);
              setIsEditing(false);
              setError(null);
            }}
            disabled={loading}
            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-350 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded text-xs font-black transition-colors"
          >
            إلغاء
          </button>
        </div>
        {error && <span className="text-[10px] text-red-600 font-black pr-1">{error}</span>}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      title="انقر لتعديل النقطة الدالة"
      className="flex items-center gap-1.5 flex-wrap rounded-lg bg-rose-50 dark:bg-rose-950/20 p-2 border border-rose-100 dark:border-rose-900/30 kse-landmark-text cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/35 transition-all duration-200 w-full"
    >
      <span
        className="font-bold text-rose-600 shrink-0 select-none"
        style={{ fontSize: labelFontSize }}
      >
        {label}
      </span>
      <span
        className="font-black text-rose-950 dark:text-rose-200 leading-tight flex-1"
        style={{ fontSize: valueFontSize }}
      >
        {initialLandmark || "—"}
        {isFromProfile && (
          <span
            className="mr-1 text-[9px] text-rose-400 font-bold"
            style={fontSizeConfig ? { fontSize: `${Math.max(9, fontSizeConfig.landmarkFontSize - 4)}px` } : undefined}
          >
            (من السجل)
          </span>
        )}
      </span>
    </div>
  );
}
