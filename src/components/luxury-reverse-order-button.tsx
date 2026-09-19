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
      ? "w-10 h-10 sm:w-11 sm:h-11"
      : size === "lg"
      ? "w-14 h-14 sm:w-16 sm:h-16"
      : "w-12 h-12 sm:w-14 sm:h-14";

  if (!interactive) {
    return (
      <div
        className={`relative ${sizeClasses} rounded-full bg-no-repeat bg-contain pointer-events-none shrink-0 drop-shadow-md select-none ${className}`}
        style={{
          backgroundImage: "url('/images/order-luxury/btn-reverse-order.webp')",
        }}
        title="طلب عكسي 🔄"
      >
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
        className={`relative ${sizeClasses} rounded-full text-xs font-black text-white hover:scale-105 active:scale-95 transition flex items-center justify-center bg-no-repeat bg-contain cursor-pointer shrink-0 drop-shadow-md select-none ${className}`}
        style={{
          backgroundImage: "url('/images/order-luxury/btn-reverse-order.webp')",
        }}
        title="إنشاء طلب عكسي 🔄"
      >
        <span className="sr-only">طلب عكسي</span>
      </button>

      {/* نافذة التأكيد الملكية */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          dir="rtl"
          onClick={(e) => {
            e.stopPropagation();
            if (!loading) setShowConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-[24px] border-2 border-[#C9A86A] bg-[#FFFEFB] p-5 shadow-2xl text-right animate-in zoom-in-95 duration-150 select-none relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* زخرفة ملكية علوية */}
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-[#0A3D2E] via-[#C9A86A] to-[#0A3D2E]" />

            <div className="flex items-center justify-between pb-3 border-b border-[#C9A86A]/20 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-full bg-no-repeat bg-contain shrink-0"
                  style={{
                    backgroundImage: "url('/images/order-luxury/btn-reverse-order.webp')",
                  }}
                />
                <div>
                  <h3 className="text-base font-black text-[#0A3D2E]">إنشاء طلب عكسي</h3>
                  <p className="text-xs font-bold text-[#8B6A2A]">
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

            <div className="space-y-2 mb-4 text-xs font-bold text-slate-700 leading-relaxed bg-[#FDF6E3]/60 p-3 rounded-2xl border border-[#C9A86A]/20">
              <p className="flex items-center gap-2">
                <span>🔄</span>
                <span>سيتم إنشاء طلب عكسي جديد (سعر الطلب 0، والوقت الآن).</span>
              </p>
              <p className="flex items-center gap-2">
                <span>📍</span>
                <span>لنفس العميل والمحل ونفس منطقة ورقم الزبون.</span>
              </p>
              <p className="flex items-center gap-2">
                <span>🛵</span>
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
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0A3D2E] to-[#125B45] border border-[#C9A86A] hover:brightness-110 active:scale-95 text-[#F5D77F] font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
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
