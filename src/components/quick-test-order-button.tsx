"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTestOrderAction } from "@/app/actions/create-test-order";

export function QuickTestOrderButton({
  variant = "tracking",
  className = "",
  itemScale = 1,
  isCompact = false,
}: {
  variant?: "tracking" | "sidebar" | "page";
  className?: string;
  itemScale?: number;
  isCompact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const router = useRouter();

  const handleCreateTest = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) return;

    startTransition(async () => {
      const res = await createTestOrderAction();
      if (res.ok) {
        setToast({
          text: `تم إنشاء طلب التيست بنجاح! رقم الطلب: #${res.orderNumber}`,
          type: "success",
        });
        router.refresh();
        setTimeout(() => setToast(null), 3500);
      } else {
        setToast({
          text: res.error || "تعذر إنشاء طلب التيست",
          type: "error",
        });
        setTimeout(() => setToast(null), 4000);
      }
    });
  };

  return (
    <>
      {/* ✅ نافذة التنبيه بثيم وصلي */}
      {toast && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A1840]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className={`flex flex-col items-center gap-3 rounded-2xl px-8 py-6 shadow-2xl border-2 text-center max-w-sm w-full animate-in zoom-in-95 duration-300 ${
              toast.type === "success"
                ? "bg-[#0B2E8C] border-[#FFC107] text-[#FFC107]"
                : "bg-rose-900 border-rose-400 text-white"
            }`}
            dir="rtl"
          >
            <span className="text-4xl">{toast.type === "success" ? "✅" : "⚠️"}</span>
            <span className="font-black text-sm sm:text-base leading-relaxed">
              {toast.text}
            </span>
            <div className="text-xs opacity-90 text-white mt-1">السعر: 10.5 د.ع</div>
            <button
              onClick={() => setToast(null)}
              className="mt-2 px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer transition"
            >
              إغلاق ✕
            </button>
          </div>
        </div>
      )}

      {variant === "tracking" && (
        <button
          type="button"
          onClick={handleCreateTest}
          disabled={isPending}
          className={`flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black text-[#0B2E8C] shadow-xs border border-[#BFD5FF] bg-gradient-to-r from-[#EFF6FF] via-[#E0EDFF] to-[#EFF6FF] transition hover:brightness-105 active:scale-95 text-center whitespace-nowrap cursor-pointer disabled:opacity-60 ${className}`}
          title="إنشاء طلب تجريبي سريع (تيست)"
        >
          <span className={isPending ? "animate-spin" : ""}>{isPending ? "⏳" : "🧪"}</span>
          <span className="hidden xs:inline">{isPending ? "جاري الإنشاء..." : "طلب تيست"}</span>
        </button>
      )}

      {variant === "sidebar" && (
        <button
          type="button"
          onClick={handleCreateTest}
          disabled={isPending}
          title="إنشاء طلب تجريبي (تيست)"
          className={`inline-flex items-center gap-2 px-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 relative cursor-pointer disabled:opacity-60 bg-gradient-to-r from-[#EFF6FF] via-[#DBEAFE] to-[#EFF6FF] border border-[#BFD5FF] text-[#0B2E8C] shadow-2xs font-black ${className}`}
          style={{ height: 38 * itemScale, fontSize: 12 * itemScale }}
        >
          <span className={`shrink-0 text-base ${isPending ? "animate-spin" : ""}`} style={{ transform: `scale(${itemScale})`, transformOrigin: "center" }} aria-hidden>
            {isPending ? "⏳" : "🧪"}
          </span>
          {isCompact ? null : <span className="leading-snug font-black block whitespace-nowrap">{isPending ? "جاري..." : "طلب تيست"}</span>}
        </button>
      )}

      {variant === "page" && (
        <button
          type="button"
          onClick={handleCreateTest}
          disabled={isPending}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-black text-[#0B2E8C] shadow-md border border-[#BFD5FF] bg-gradient-to-r from-[#EFF6FF] via-[#DBEAFE] to-[#EFF6FF] transition hover:brightness-105 active:scale-95 text-center whitespace-nowrap cursor-pointer disabled:opacity-60 ${className}`}
          title="إنشاء طلب تجريبي سريع (تيست)"
        >
          <span className={`text-base ${isPending ? "animate-spin" : ""}`}>{isPending ? "⏳" : "🧪"}</span>
          <span>{isPending ? "جاري إنشاء طلب التيست..." : "إنشاء طلب تيست سريع"}</span>
        </button>
      )}
    </>
  );
}
