"use client";

import { useState } from "react";
import { togglePreparerAssignment } from "./actions";
import { useRouter } from "next/navigation";
import { DynamicIcon } from "@/components/dynamic-icon";
import type { GlobalIconsConfig } from "@/lib/icon-settings";

export function PreparerAssignmentToggle({
  preparerId,
  initialAvailable,
  icons,
  className = "",
}: {
  preparerId: string;
  initialAvailable: boolean;
  icons: GlobalIconsConfig | null;
  className?: string;
}) {
  const [available, setAvailable] = useState(initialAvailable);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await togglePreparerAssignment(preparerId, !available);
      if (res.success) {
        setAvailable(!available);
        router.refresh();
      } else {
        alert(res.error || "فشل التعديل");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      title={available ? "إخفاء المجهز من قائمة الإسناد" : "إظهار المجهز وتفعيله في قائمة الإسناد"}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
        available
          ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
          : "bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-700 shadow-sm"
      } disabled:opacity-50 ${className}`}
    >
      <DynamicIcon
        config={icons}
        iconKey={available ? "ui_eye_off" : "ui_eye"}
        fallback={available ? "👁️" : "👁️‍🗨️"}
        className="w-3.5 h-3.5"
      />
      {loading ? "جارٍ الحفظ…" : available ? "إخفاء من الإسناد" : "إعادة للإسناد"}
    </button>
  );
}
