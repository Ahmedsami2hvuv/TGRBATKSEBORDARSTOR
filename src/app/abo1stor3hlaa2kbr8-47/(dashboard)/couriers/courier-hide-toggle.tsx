"use client";

import { useState } from "react";
import { toggleCourierHidden } from "./actions";
import { useRouter } from "next/navigation";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function CourierHideToggle({
  courierId,
  initialHidden,
  icons,
}: {
  courierId: string;
  initialHidden: boolean;
  icons: GlobalIconsConfig;
}) {
  const [hidden, setHidden] = useState(initialHidden);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await toggleCourierHidden(courierId, !hidden);
      if (res.success) {
        setHidden(!hidden);
        router.refresh();
      } else {
        alert(res.error || "فشل تعديل حالة الإخفاء من قوائم الإسناد");
      }
    } finally {
      setLoading(false);
    }
  }

  const tooltipText = hidden
    ? "مخفي من قوائم الإسناد (انقر للإظهار)"
    : "ظاهر في قوائم الإسناد (انقر للإخفاء)";

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      type="button"
      title={tooltipText}
      aria-label={tooltipText}
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-all border shadow-sm ${
        hidden
          ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-400 shadow-amber-500/20"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
      } disabled:opacity-50 cursor-pointer active:scale-95`}
    >
      <DynamicIcon
        config={icons}
        iconKey={hidden ? "ui_eye_off" : "ui_eye"}
        fallback={hidden ? "🙈" : "👁️"}
        className="w-4 h-4 sm:w-4.5 sm:h-4.5"
      />
    </button>
  );
}
