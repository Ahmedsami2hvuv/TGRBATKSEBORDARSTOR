"use client";

import { useState } from "react";
import { toggleCourierChat } from "./actions";
import { useRouter } from "next/navigation";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function CourierChatToggle({
  courierId,
  initialDisabled,
  icons
}: {
  courierId: string;
  initialDisabled: boolean;
  icons: GlobalIconsConfig;
}) {
  const [disabled, setDisabled] = useState(initialDisabled);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await toggleCourierChat(courierId, !disabled);
      if (res.success) {
        setDisabled(!disabled);
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
      onClick={handleToggle}
      disabled={loading}
      type="button"
      title={disabled ? "تفعيل الدردشة لهذا المندوب" : "تعطيل الدردشة لهذا المندوب"}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all border shadow-sm ${
        disabled
          ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
          : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
      } disabled:opacity-50 cursor-pointer`}
    >
      <DynamicIcon
        config={icons}
        iconKey={disabled ? "ui_chat_off" : "ui_chat"}
        fallback={disabled ? "<ctrl42>" : "💬"}
        className="w-4 h-4"
      />
      <span>{loading ? "جاري..." : disabled ? "الدردشة معطلة" : "الدردشة مفعلة"}</span>
    </button>
  );
}
