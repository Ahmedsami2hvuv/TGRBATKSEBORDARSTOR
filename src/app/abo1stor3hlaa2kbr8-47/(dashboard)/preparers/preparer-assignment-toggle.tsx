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
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all active:scale-95 ${
        available
          ? "border-2 border-amber-200 bg-amber-50 text-amber-800 shadow-sm hover:bg-amber-100 hover:border-amber-300"
          : "border-2 border-emerald-300 bg-emerald-600 text-white shadow-md hover:bg-emerald-700"
      } disabled:opacity-50 ${className}`}
    >
      <DynamicIcon
        config={icons}
        iconKey={available ? "ui_eye_off" : "ui_eye"}
        fallback={available ? "👁️" : "👁️‍🗨️"}
        className="w-4 h-4"
      />
      {loading ? "جارٍ الحفظ…" : available ? "إخفاء من الإسناد" : "إعادة للإسناد (ظاهر)"}
    </button>
  );
}
