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
      title={disabled ? "تفعيل الدردشة لهذا المندوب" : "تعطيل الدردشة لهذا المندوب"}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
        disabled
          ? "bg-slate-100 text-slate-500 border border-slate-300"
          : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
      } disabled:opacity-50`}
    >
      <DynamicIcon
        config={icons}
        iconKey={disabled ? "ui_chat_off" : "ui_chat"}
        fallback={disabled ? "📵" : "💬"}
        className="w-4 h-4"
      />
      {loading ? "جاري..." : disabled ? "الدردشة معطلة" : "الدردشة مفعلة"}
    </button>
  );
}
