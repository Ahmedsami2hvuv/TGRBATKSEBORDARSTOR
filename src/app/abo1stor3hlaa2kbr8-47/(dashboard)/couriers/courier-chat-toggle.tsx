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

  const tooltipText = disabled ? "الدردشة معطلة (انقر للتفعيل)" : "الدردشة مفعلة (انقر للتعطيل)";

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      type="button"
      title={tooltipText}
      aria-label={tooltipText}
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-all border shadow-sm ${
        disabled
          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
          : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-indigo-500/20"
      } disabled:opacity-50 cursor-pointer active:scale-95`}
    >
      <DynamicIcon
        config={icons}
        iconKey={disabled ? "ui_chat_off" : "ui_chat"}
        fallback={disabled ? "📵" : "💬"}
        className="w-4 h-4 sm:w-4.5 sm:h-4.5"
      />
    </button>
  );
}
