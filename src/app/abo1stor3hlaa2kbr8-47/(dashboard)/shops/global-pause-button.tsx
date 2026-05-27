"use client";

import { toggleGlobalPause } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { useTransition } from "react";
import { toast } from "sonner";

export function GlobalPauseButton({
  isPaused,
  pauseMessage,
  icons,
}: {
  isPaused: boolean;
  pauseMessage: string;
  icons: GlobalIconsConfig | null;
}) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (isPaused) {
      if (confirm("هل تريد استئناف تلقي الطلبات لجميع المحلات؟")) {
        startTransition(async () => {
          const fd = new FormData();
          fd.append("shouldPause", "false");
          await toggleGlobalPause(fd);
          toast.success("تم استئناف الطلبات لجميع المحلات");
        });
      }
    } else {
      const msg = prompt("أدخل رسالة التوقف العامة (ستظهر لجميع العملاء):", "نعتذر عن استقبال الطلبات حالياً.. نفتح قريباً");
      if (msg !== null) {
        startTransition(async () => {
          const fd = new FormData();
          fd.append("shouldPause", "true");
          fd.append("pauseMessage", msg);
          await toggleGlobalPause(fd);
          toast.success("تم إيقاف الطلبات لجميع المحلات");
        });
      }
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all shadow-lg active:scale-95 ${
        isPaused
          ? "bg-green-600 hover:bg-green-700 text-white shadow-green-200"
          : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200"
      } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <DynamicIcon
        iconKey={isPaused ? "ui_play" : "ui_pause"}
        config={icons}
        fallback={isPaused ? "▶️" : "⏸️"}
        className="w-5 h-5"
      />
      {isPaused ? "استئناف الطلبات للكل" : "إيقاف الطلبات للكل"}
    </button>
  );
}
