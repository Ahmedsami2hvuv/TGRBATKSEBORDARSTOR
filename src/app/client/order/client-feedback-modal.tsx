"use client";

import React, { useState } from "react";
import { Star, Check, Sparkles, X, MessageSquare, AlertCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClientFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId?: string;
  shopName?: string;
  employeeName?: string;
  employeePhone?: string;
  onSubmitted?: () => void;
}

export function ClientFeedbackModal({
  isOpen,
  onClose,
  shopId,
  shopName,
  employeeName,
  employeePhone,
  onSubmitted,
}: ClientFeedbackModalProps) {
  const [designRating, setDesignRating] = useState<number>(5);
  const [designReason, setDesignReason] = useState<string>("");

  const [buttonsRating, setButtonsRating] = useState<number>(5);
  const [buttonsReason, setButtonsReason] = useState<string>("");

  const [fieldsRating, setFieldsRating] = useState<number>(5);
  const [fieldsReason, setFieldsReason] = useState<string>("");

  const [easeRating, setEaseRating] = useState<number>(5);
  const [easeReason, setEaseReason] = useState<string>("");

  const [generalFeedback, setGeneralFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/client/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          shopName,
          employeeName,
          employeePhone,
          designRating,
          designReason: designRating < 5 ? designReason : "",
          buttonsRating,
          buttonsReason: buttonsRating < 5 ? buttonsReason : "",
          fieldsRating,
          fieldsReason: fieldsRating < 5 ? fieldsReason : "",
          easeRating,
          easeReason: easeRating < 5 ? easeReason : "",
          generalFeedback,
        }),
      });

      if (res.ok) {
        toast.success("شكراً جزيلاً لتقييمك وملاحظاتك القيمة 🌟");
        if (onSubmitted) onSubmitted();
        onClose();
      } else {
        toast.error("حدث خطأ أثناء إرسال التقييم");
      }
    } catch {
      toast.error("تعذر الاتصال بالسيرفر لإرسال التقييم");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarPicker = (
    label: string,
    rating: number,
    setRating: (val: number) => void,
    reason: string,
    setReason: (val: string) => void,
    icon: string
  ) => {
    return (
      <div className="rounded-[18px] bg-[#FFF8F0]/80 border border-[#C9A86A]/30 p-[12px] shadow-sm transition">
        <div className="flex items-center justify-between gap-2 mb-[8px]">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{icon}</span>
            <span className="text-[12.5px] font-black text-[#0A3D2E]">{label}</span>
          </div>
          <div className="flex items-center gap-1 direction-ltr" dir="ltr">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 hover:scale-115 active:scale-95 transition-transform"
                title={`${star} من 5`}
              >
                <Star
                  className={`w-[22px] h-[22px] transition-colors ${
                    star <= rating
                      ? "fill-[#F59E0B] text-[#D97706] drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]"
                      : "fill-transparent text-[#CBD5E1]"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* إذا كان التقييم أقل من 5، تظهر خانة توضيح السبب والمقترح */}
        {rating < 5 && (
          <div className="mt-[8px] pt-[8px] border-t border-[#C9A86A]/20 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-1.5 mb-[4px]">
              <AlertCircle className="w-[13px] h-[13px] text-[#B45309]" />
              <p className="text-[11px] font-bold text-[#B45309]">
                ما سبب التقييم وما هو الحل أو التحسين المقترح؟
              </p>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب ملاحظتك واقتراحك هنا لنقوم بتطويرها فوراً..."
              rows={2}
              className="w-full rounded-[12px] border border-[#C9A86A]/40 bg-white p-[8px] text-[11.5px] font-bold text-[#1E293B] outline-none resize-none placeholder:text-[#94A3B8] focus:border-[#0A3D2E]"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-[14px] bg-[#05281C]/75 backdrop-blur-[10px] animate-in fade-in duration-300"
      dir="rtl"
    >
      <div className="relative w-full max-w-[440px] max-h-[92vh] flex flex-col rounded-[28px] border-[2px] border-[#C9A86A] bg-gradient-to-b from-[#FFFEFB] via-[#FFFDF7] to-[#FAF6EE] shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* زر الإغلاق */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-[14px] left-[14px] w-[30px] h-[30px] rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#0A3D2E] flex items-center justify-center hover:bg-white active:scale-95 transition z-10"
        >
          <X className="w-[16px] h-[16px]" />
        </button>

        {/* رأس النافذة */}
        <div className="p-[20px] pb-[12px] text-center shrink-0 border-b border-[#C9A86A]/20">
          <div className="mx-auto w-[52px] h-[52px] rounded-full bg-gradient-to-tr from-[#0A3D2E] to-[#164E3D] border-[2px] border-[#F5D77F] flex items-center justify-center shadow-md mb-[8px]">
            <Sparkles className="w-[26px] h-[26px] text-[#F5D77F]" />
          </div>
          <h2 className="text-[17px] font-black text-[#0A3D2E]">تقييم تجربة الاستخدام 👑</h2>
          <p className="text-[11.5px] font-bold text-[#64748B] mt-[2px]">
            رأيك يهمنا جداً لتطوير وتسهيل النظام للأفضل دائماً
          </p>
        </div>

        {/* جسم النافذة مع سكرول */}
        <div className="p-[16px] overflow-y-auto space-y-[10px] flex-1">
          {/* 1. تقييم التصميم */}
          {renderStarPicker(
            "تقييم التصميم والمظهر العام",
            designRating,
            setDesignRating,
            designReason,
            setDesignReason,
            "🎨"
          )}

          {/* 2. تقييم الأزرار */}
          {renderStarPicker(
            "تقييم الأزرار وحركتها",
            buttonsRating,
            setButtonsRating,
            buttonsReason,
            setButtonsReason,
            "🔘"
          )}

          {/* 3. تقييم الخانات */}
          {renderStarPicker(
            "تقييم الخانات وسهولة الإدخال",
            fieldsRating,
            setFieldsRating,
            fieldsReason,
            setFieldsReason,
            "📝"
          )}

          {/* 4. تقييم السهولة */}
          {renderStarPicker(
            "تقييم سهولة وسرعة رفع الطلب",
            easeRating,
            setEaseRating,
            easeReason,
            setEaseReason,
            "⚡"
          )}

          {/* خانة الاقتراحات العامة والأفكار */}
          <div className="rounded-[18px] bg-white border border-[#C9A86A]/30 p-[12px] shadow-sm">
            <div className="flex items-center gap-1.5 mb-[6px]">
              <MessageSquare className="w-[15px] h-[15px] text-[#0A3D2E]" />
              <span className="text-[12px] font-black text-[#0A3D2E]">
                أفكار أو اقتراحات وملاحظات عامة (اختياري)
              </span>
            </div>
            <textarea
              value={generalFeedback}
              onChange={(e) => setGeneralFeedback(e.target.value)}
              placeholder="اكتب أي مقترح أو فكرة تود إضافتها في النظام..."
              rows={3}
              className="w-full rounded-[12px] border border-[#C9A86A]/30 bg-[#FFF8F0] p-[10px] text-[12px] font-bold text-[#1E293B] outline-none resize-none placeholder:text-[#94A3B8] focus:border-[#0A3D2E]"
            />
          </div>
        </div>

        {/* أزرار الإجراءات السفلية */}
        <div className="p-[16px] pt-[12px] bg-[#FAF6EE] border-t border-[#C9A86A]/20 shrink-0 flex items-center gap-[10px]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 h-[46px] rounded-[14px] bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0F4D3A] border border-[#C9A86A] text-[#F5D77F] font-black text-[14px] shadow-[0_4px_16px_rgba(10,61,46,0.3)] hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-[20px] h-[20px] animate-spin text-[#F5D77F]" />
            ) : (
              <>
                <span>إرسال التقييم</span>
                <Send className="w-[16px] h-[16px]" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] px-[16px] rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#475569] font-bold text-[13px] hover:bg-white active:scale-95 transition"
          >
            تخطي
          </button>
        </div>
      </div>
    </div>
  );
}
