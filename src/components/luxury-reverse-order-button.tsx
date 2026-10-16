"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createReverseOrderFromExisting } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/[orderId]/reverse-order-actions";

type Props = {
  orderId?: string;
  orderNumber?: number | string;
  customerPhone?: string;
  role?: "admin" | "mandoub" | "preparer";
  size?: "sm" | "md" | "lg";
  className?: string;
  interactive?: boolean;
};

/** مكون الأيقونة البصرية الدائرية للطلب العكسي بثيم وصلي الرسمي */
function WasliReverseOrbVisual({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const iconSizeClasses =
    size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";

  return (
    <div
      className="relative w-full h-full rounded-full flex items-center justify-center overflow-hidden transition-transform duration-200"
      style={{
        background:
          "radial-gradient(circle at 35% 28%, #1E4DB7 0%, #0B2E8C 55%, #05143D 100%)",
        border: "2px solid #FFC107",
        boxShadow:
          "0 4px 12px rgba(11,46,140,0.45), 0 2px 4px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -3px 5px rgba(0,0,0,0.6), inset 0 0 8px rgba(255,193,7,0.35)",
      }}
    >
      {/* طبقة اللمعان الزجاجي العلوية المنحنية الخاصة بثيم وصلي */}
      <div
        className="pointer-events-none absolute top-0.5 inset-x-1.5 h-[42%] rounded-t-full opacity-80"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.2) 75%, transparent 100%)",
        }}
      />

      {/* حلقة داخلية خفيفة لتعزيز العمق الثلاثي الأبعاد */}
      <div className="pointer-events-none absolute inset-0.5 rounded-full border border-white/20" />

      {/* أيقونة السهمين العكسيين الذهبيين بدقة SVG ثلاثية الأبعاد */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizeClasses} relative z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)]`}
      >
        <defs>
          <linearGradient id="wasliReverseGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF9D2" />
            <stop offset="45%" stopColor="#FFC107" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        {/* السهم العلوي */}
        <path
          d="M20 11A8 8 0 0 0 6.34 6.34L3 9.5"
          stroke="url(#wasliReverseGold)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 5v4.5h4.5"
          stroke="url(#wasliReverseGold)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* السهم السفلي */}
        <path
          d="M4 13a8 8 0 0 0 13.66 4.66L21 14.5"
          stroke="url(#wasliReverseGold)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 19v-4.5h-4.5"
          stroke="url(#wasliReverseGold)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function LuxuryReverseOrderButton({
  orderId,
  orderNumber,
  customerPhone,
  role = "admin",
  size = "md",
  className = "",
  interactive = false,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreate = async (e: React.MouseEvent) => {
    if (!orderId) return;
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createReverseOrderFromExisting(orderId);
      if (res.ok && res.newOrderId) {
        setShowConfirm(false);
        if (role === "admin") {
          router.push(`/abo1stor3hlaa2kbr8-47/orders/${res.newOrderId}`);
        } else if (role === "mandoub") {
          router.refresh();
        } else if (role === "preparer") {
          router.refresh();
        } else {
          router.refresh();
        }
      } else {
        setError(res.error || "تعذر إنشاء الطلب العكسي");
      }
    } catch (err: any) {
      setError(err?.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses =
    size === "sm"
      ? "w-8 h-8 sm:w-9 sm:h-9"
      : size === "lg"
      ? "w-11 h-11 sm:w-12 sm:h-12"
      : "w-10 h-10 sm:w-11 sm:h-11";

  if (!interactive) {
    return (
      <div
        className={`relative ${sizeClasses} rounded-full shrink-0 drop-shadow-md select-none ${className}`}
        title="طلب عكسي 🔄 (استلام من الزبون وتسليم للمحل)"
      >
        <WasliReverseOrbVisual size={size} />
        <span className="sr-only">طلب عكسي</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setError(null);
          setShowConfirm(true);
        }}
        className={`relative ${sizeClasses} rounded-full hover:scale-105 active:scale-95 transition flex items-center justify-center cursor-pointer shrink-0 drop-shadow-md select-none ${className}`}
        title="إنشاء طلب عكسي 🔄"
      >
        <WasliReverseOrbVisual size={size} />
        <span className="sr-only">طلب عكسي</span>
      </button>

      {/* نافذة التأكيد الفاخرة بثيم وصلي الرسمي */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0A1840]/60 backdrop-blur-xs animate-in fade-in duration-150"
          dir="rtl"
          onClick={(e) => {
            e.stopPropagation();
            if (!loading) setShowConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-[24px] border-2 border-[#FFC107] bg-white p-5 shadow-2xl text-right animate-in zoom-in-95 duration-150 select-none relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* شريط علوي فخم بثيم وصلي */}
            <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-[#0B2E8C] via-[#FFC107] to-[#0B2E8C]" />

            <div className="flex items-center justify-between pb-3 border-b border-[#D0DDFB] mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full shrink-0">
                  <WasliReverseOrbVisual size="sm" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0B2E8C]">إنشاء طلب عكسي</h3>
                  <p className="text-xs font-bold text-[#FFC107] drop-shadow-xs">
                    {orderNumber ? `مرتبط بالطلب #${orderNumber}` : "طلب استرجاع فوري"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowConfirm(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-sm font-bold text-slate-500 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mb-4 text-xs font-bold text-slate-700 leading-relaxed bg-[#F0F5FF] p-3 rounded-2xl border border-[#D0DDFB]">
              <p className="flex items-center gap-2">
                <span className="text-[#0B2E8C]">🔄</span>
                <span>سيتم إنشاء طلب عكسي جديد (سعر الطلب 0، والوقت الآن).</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-[#0B2E8C]">📍</span>
                <span>لنفس العميل والمحل ونفس منطقة ورقم الزبون.</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-[#0B2E8C]">🛵</span>
                <span>وإسناده تلقائياً للمندوب نفسه إن وجد.</span>
              </p>
            </div>

            {error && (
              <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2 text-center text-xs font-bold text-rose-700">
                ⚠️ {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowConfirm(false)}
                className="w-full py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-black text-xs transition cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleCreate}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0B2E8C] via-[#1E4DB7] to-[#0B2E8C] border border-[#FFC107] hover:brightness-110 active:scale-95 text-[#FFC107] font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>جاري الإنشاء...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>تأكيد الإنشاء</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
