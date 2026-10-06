"use client";

import { useEffect, useState } from "react";

function formatElapsedTime(createdAt: string | Date | null | undefined): { label: string; minutes: number } | null {
  if (!createdAt) return null;
  const createdDate = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (!createdDate || isNaN(createdDate.getTime())) return null;

  const now = Date.now();
  const diffMs = Math.max(0, now - createdDate.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return { label: "أقل من دقيقة", minutes: 0 };
  }

  const hours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  let label = "";

  if (days > 0) {
    label = `${days} يوم${remainingHours > 0 ? ` و ${remainingHours} س` : ""}`;
  } else if (hours > 0) {
    label = `${hours} س${remainingMinutes > 0 ? ` و ${remainingMinutes} د` : ""}`;
  } else if (diffMinutes === 1) {
    label = "1 دقيقة";
  } else if (diffMinutes === 2) {
    label = "2 دقيقة";
  } else if (diffMinutes >= 3 && diffMinutes <= 10) {
    label = `${diffMinutes} دقائق`;
  } else {
    label = `${diffMinutes} دقيقة`;
  }

  return { label, minutes: diffMinutes };
}

export function OrderCountUpTimer({
  createdAt,
  orderStatus,
  variant = "normal",
  className = "",
}: {
  createdAt?: string | Date | null;
  orderStatus?: string | null;
  variant?: "normal" | "luxury" | "detail" | "badge";
  className?: string;
}) {
  const [timeData, setTimeData] = useState<{ label: string; minutes: number } | null>(() =>
    formatElapsedTime(createdAt)
  );

  useEffect(() => {
    // تحديث فوري ثم تحديث دوري كل 15 ثانية لمواكبة الدقائق تصاعدياً
    setTimeData(formatElapsedTime(createdAt));
    const timer = setInterval(() => {
      setTimeData(formatElapsedTime(createdAt));
    }, 15000);

    return () => clearInterval(timer);
  }, [createdAt]);

  const s = String(orderStatus ?? "").trim().toLowerCase();
  // يختفي العداد إذا صار الطلب في حالة "تم الاستلام" (delivering) أو "تم التسليم" (delivered) أو ملغي (cancelled)
  // ويبقى فقط في حال كانت الطلبية "جديدة" (pending) أو "مسندة" (assigned)
  const isVisible = s === "pending" || s === "assigned";

  if (!isVisible || !timeData) {
    return null;
  }

  const { label, minutes } = timeData;

  // ألوان تنبيهية حسب المدة:
  // عادي (< 30 دقيقة): أزرق / عنبري ناعم
  // متوسط (30 - 60 دقيقة): برتقالي / كهرماني دافئ
  // متأخر (> 60 دقيقة): وردي / أحمر معتدل
  const isLate = minutes >= 60;
  const isMedium = minutes >= 30 && minutes < 60;

  if (variant === "luxury") {
    // تصميم فاخر مخصص للكروت الملكية للمجهز
    const bgStyle = isLate
      ? "bg-rose-50/95 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 shadow-[0_1px_4px_rgba(225,29,72,0.15)]"
      : isMedium
      ? "bg-amber-50/95 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 shadow-[0_1px_4px_rgba(217,119,6,0.15)]"
      : "bg-[#FFF8F0]/95 dark:bg-slate-900/95 border-[#C9A86A]/50 text-slate-800 dark:text-[#F5D77F] shadow-[0_1px_4px_rgba(201,168,106,0.15)]";

    return (
      <div
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10.5px] sm:text-xs font-black select-none max-w-full truncate ${bgStyle} ${className}`}
        title={`مرفوع منذ ${label}`}
      >
        <span className={`text-[11px] ${minutes > 0 ? "animate-pulse" : ""}`}>⏳</span>
        <span className="truncate">{label}</span>
      </div>
    );
  }

  if (variant === "detail") {
    // تصميم مخصص لرأس تفاصيل الطلب
    const detailBadge = isLate
      ? "bg-rose-100/90 text-rose-800 border-rose-300"
      : isMedium
      ? "bg-amber-100/90 text-amber-800 border-amber-300"
      : "bg-sky-50 text-sky-900 border-sky-200";

    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] border text-xs font-black shadow-xs select-none ${detailBadge} ${className}`}
        title={`مرفوع منذ ${label}`}
      >
        <span className="text-[12px] animate-pulse">⏳</span>
        <span>مرفوع منذ: {label}</span>
      </div>
    );
  }

  // التصميم الافتراضي للكرت العادي (normal / badge)
  const normalStyle = isLate
    ? "bg-rose-50/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300"
    : isMedium
    ? "bg-amber-50/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
    : "bg-sky-50/90 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-black text-[11px] sm:text-xs shadow-2xs shrink-0 select-none ${normalStyle} ${className}`}
      title={`مرفوع منذ ${label}`}
    >
      <span className={minutes > 0 ? "animate-pulse" : ""}>⏳</span>
      <span>{label}</span>
    </span>
  );
}
