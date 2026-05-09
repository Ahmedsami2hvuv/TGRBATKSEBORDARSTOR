"use client";

import { useState } from "react";
import { togglePreparerAI } from "./actions";
import { useRouter } from "next/navigation";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function PreparerAIToggle({
  preparerId,
  initialDisabled,
  icons
}: {
  preparerId: string;
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
      const res = await togglePreparerAI(preparerId, !disabled);
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
      title={disabled ? "تفعيل الذكاء الاصطناعي لهذا المجهز" : "تعطيل الذكاء الاصطناعي لهذا المجهز"}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
        disabled
          ? "bg-slate-100 text-slate-500 border border-slate-300"
          : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
      } disabled:opacity-50`}
    >
      <DynamicIcon
        config={icons}
        iconKey={disabled ? "ui_ai_off" : "ui_ai"}
        fallback={disabled ? "🤖❌" : "🤖"}
        className="w-4 h-4"
      />
      {loading ? "جاري..." : disabled ? "الذكاء معطل" : "الذكاء مفعل"}
    </button>
  );
}
