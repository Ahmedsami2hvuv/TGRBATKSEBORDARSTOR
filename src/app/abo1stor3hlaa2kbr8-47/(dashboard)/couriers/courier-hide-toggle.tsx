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
        alert(res.error || "فشل تعديل حالة الإخفاء");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      type="button"
      title={hidden ? "إظهار المندوب في القائمة الرئيسية" : "إخفاء المندوب ونقله للقائمة المخفية"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
        hidden
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20"
          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
      } disabled:opacity-50`}
    >
      <DynamicIcon
        config={icons}
        iconKey={hidden ? "ui_eye" : "ui_eye_off"}
        fallback={hidden ? "👁️" : "🙈"}
        className="w-4 h-4"
      />
      {loading ? "جاري..." : hidden ? "إظهار المندوب" : "إخفاء المندوب"}
    </button>
  );
}
