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
        setTimeout(() => setToast(null), 4000);
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
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-2xl border-2 text-white font-black text-xs sm:text-sm animate-in slide-in-from-top duration-300 ${
            toast.type === "success"
              ? "bg-[#0A3D2E] border-[#F5D77F] text-[#F5D77F]"
              : "bg-rose-900 border-rose-400"
          }`}
          dir="rtl"
        >
          <span>{toast.type === "success" ? "🚀" : "⚠️"}</span>
          <span>{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="mr-2 text-white/80 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {variant === "tracking" && (
        <button
          type="button"
          onClick={handleCreateTest}
          disabled={isPending}
          className={`flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black text-[#8B6A2A] shadow-xs border border-[#E8C77E] transition hover:brightness-105 active:scale-95 text-center whitespace-nowrap cursor-pointer disabled:opacity-60 ${className}`}
          style={{
            background: "linear-gradient(180deg, #FFF8E0 0%, #FDF6E3 45%, #F7E9B0 100%)",
          }}
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
          className={`inline-flex items-center gap-2 px-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 relative cursor-pointer disabled:opacity-60 bg-gradient-to-r from-[#FFF8E0] via-[#FDF6E3] to-[#F7E9B0] border-2 border-[#E8C77E] text-[#8B6A2A] shadow-2xs font-black ${className}`}
          style={{
            height: 38 * itemScale,
            fontSize: 12 * itemScale,
          }}
        >
          <span
            className={`shrink-0 text-base ${isPending ? "animate-spin" : ""}`}
            style={{ transform: `scale(${itemScale})`, transformOrigin: "center" }}
            aria-hidden
          >
            {isPending ? "⏳" : "🧪"}
          </span>
          {isCompact ? null : (
            <span className="leading-snug font-black block whitespace-nowrap">
              {isPending ? "جاري..." : "طلب تيست"}
            </span>
          )}
        </button>
      )}

      {variant === "page" && (
        <button
          type="button"
          onClick={handleCreateTest}
          disabled={isPending}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-black text-[#8B6A2A] shadow-md border-2 border-[#E8C77E] transition hover:brightness-105 active:scale-95 text-center whitespace-nowrap cursor-pointer disabled:opacity-60 ${className}`}
          style={{
            background: "linear-gradient(180deg, #FFF8E0 0%, #FDF6E3 45%, #F7E9B0 100%)",
          }}
          title="إنشاء طلب تجريبي سريع (تيست)"
        >
          <span className={`text-base ${isPending ? "animate-spin" : ""}`}>
            {isPending ? "⏳" : "🧪"}
          </span>
          <span>{isPending ? "جاري إنشاء طلب التيست..." : "إنشاء طلب تيست سريع"}</span>
        </button>
      )}
    </>
  );
}
