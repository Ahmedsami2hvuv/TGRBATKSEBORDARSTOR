"use client";

import React, { useState } from "react";
import {
  Star,
  Sparkles,
  Heart,
  Truck,
  Store,
  MapPin,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Send,
} from "lucide-react";

interface RateDriverClientProps {
  orderData: {
    id: string;
    orderNumber: number;
    customerPhone: string;
    customerRegion: string;
    customerLandmark: string;
    shopName: string;
    courierId: string | null;
    courierName: string;
  } | null;
  alreadyRated?: boolean;
  existingRating?: any;
}

export function RateDriverClient({
  orderData,
  alreadyRated = false,
  existingRating = null,
}: RateDriverClientProps) {
  // حالات التقييم
  const [mannerRating, setMannerRating] = useState<number>(5);
  const [mannerReason, setMannerReason] = useState<string>("");

  const [speedRating, setSpeedRating] = useState<number>(5);
  const [speedReason, setSpeedReason] = useState<string>("");

  const [overallRating, setOverallRating] = useState<number>(5);
  const [overallReason, setOverallReason] = useState<string>("");

  const [notes, setNotes] = useState<string>("");

  // حالات الإرسال والواجهة
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(alreadyRated);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // أسماء وتفاصيل
  const regionName = orderData?.customerRegion || "منطقتكم الكريمة";
  const shopName = orderData?.shopName || "المتجر";
  const courierName = orderData?.courierName || "مندوب التوصيل";

  // دالة الإرسال
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderData) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/rate-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderData.id,
          orderNumber: orderData.orderNumber,
          customerPhone: orderData.customerPhone,
          customerRegion: regionName,
          customerLandmark: orderData.customerLandmark,
          shopName,
          courierId: orderData.courierId,
          courierName,
          mannerRating,
          mannerReason: mannerRating < 5 ? mannerReason : null,
          speedRating,
          speedReason: speedRating < 5 ? speedReason : null,
          overallRating,
          overallReason: overallRating < 5 ? overallReason : null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إرسال التقييم، يرجى المحاولة لاحقاً");
      }

      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  };

  // مكوّن النجوم التفاعلية
  const InteractiveStarGroup = ({
    value,
    onChange,
    label,
    icon,
  }: {
    value: number;
    onChange: (val: number) => void;
    label: string;
    icon: React.ReactNode;
  }) => {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black text-[#0A3D2E] flex items-center gap-1.5">
            {icon}
            {label}
          </span>
          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#B45309]">
            {value === 5
              ? "ممتاز 🌟 (5/5)"
              : value === 4
              ? "جيد جداً (4/5)"
              : value === 3
              ? "متوسط (3/5)"
              : value === 2
              ? "مقبول (2/5)"
              : "ضعيف (1/5)"}
          </span>
        </div>

        {/* النجوم */}
        <div className="flex items-center justify-center gap-2 py-2.5 bg-[#FFFDF9] rounded-[18px] border border-[#C9A86A]/30 shadow-inner" dir="ltr">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= value;
            return (
              <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                className="p-1 hover:scale-125 active:scale-95 transition-all transform cursor-pointer"
                title={`${star} نجوم`}
              >
                <Star
                  className={`w-8 h-8 md:w-9 md:h-9 transition-colors ${
                    isFilled
                      ? "fill-[#F59E0B] text-[#D97706] drop-shadow-[0_2px_4px_rgba(245,158,11,0.4)]"
                      : "fill-transparent text-[#CBD5E1] hover:text-[#FDE68A]"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // شاشة الشكر بعد إكمال التقييم
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0A3D2E] via-[#0D4434] to-[#06241B] flex items-center justify-center p-4 py-8" dir="rtl">
        <div className="w-full max-w-lg bg-white rounded-[32px] border-2 border-[#C9A86A] shadow-2xl p-6 md:p-8 text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          {/* زخرفة خلفية */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#FFF8F0] rounded-full border border-[#C9A86A]/20 blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[#0A3D2E]/10 rounded-full blur-xl pointer-events-none" />

          {/* أيقونة النجاح */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#0A3D2E] to-[#14532D] border-4 border-[#F5D77F] flex items-center justify-center mx-auto mb-4 text-[#F5D77F] shadow-lg animate-bounce duration-1000">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-black text-[#0A3D2E] mb-2">
            شكراً جزيلاً لتقييمك! ❤️
          </h2>
          <p className="text-sm font-bold text-slate-600 mb-6 leading-relaxed">
            تم استلام تقييمك للمندوب <span className="text-[#0A3D2E] font-black">{courierName}</span> بنجاح. رأيك وملاحظاتك تساهم دائماً في تطوير خدمتنا وتقديم أفضل تجربة توصيل تليق بكم.
          </p>

          {/* بطاقة الدعوة لصفحة الترحيب والخدمات */}
          <div className="bg-gradient-to-br from-[#FFFDF7] via-[#FFF9EE] to-[#FFF3DC] border-2 border-[#C9A86A] rounded-[24px] p-5 mb-6 text-right shadow-md relative group">
            <div className="flex items-center gap-2 mb-2 text-[#0A3D2E]">
              <Sparkles className="w-5 h-5 text-[#C9A86A] shrink-0" />
              <h3 className="text-base font-black text-[#0A3D2E]">
                مادام قيّمت المندوب.. تعال نسولفلك عن خدمتنا! 🌟
              </h3>
            </div>
            <p className="text-xs font-bold text-slate-700 leading-relaxed mb-4">
              تعرف على كافة مميزات التوصيل، المتابعة، والخدمات الحصرية التي نقدمها لك وللمتاجر الشريكة في بغداد وجميع المناطق.
            </p>

            <a
              href="https://aboakbr.com/welcome"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-[18px] bg-gradient-to-r from-[#0A3D2E] to-[#14532D] text-[#F5D77F] font-black text-sm border border-[#C9A86A] hover:scale-[1.02] active:scale-95 transition shadow-lg cursor-pointer text-center"
            >
              <span>اضغط هنا وتعرف على خدماتنا ومميزاتنا</span>
              <ArrowRight className="w-4 h-4 text-[#F5D77F] rotate-180" />
            </a>
          </div>

          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#0A3D2E]" />
            <span>نظام التوصيل وإدارة الطلبيات — جميع الحقوق محفوظة</span>
          </div>
        </div>
      </div>
    );
  }

  // إذا لم يكن هناك بيانات طلب
  if (!orderData) {
    return (
      <div className="min-h-screen bg-[#0A3D2E] flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-[28px] border-2 border-[#C9A86A] p-6 text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-[#B45309] mx-auto mb-3" />
          <h2 className="text-lg font-black text-[#0A3D2E] mb-1">الرابط غير صحيح أو منتهي</h2>
          <p className="text-xs font-bold text-slate-500 mb-4">
            يرجى التأكد من الدخول عبر رابط التقييم المرفق مع رسالة الطلب
          </p>
          <a
            href="https://aboakbr.com/welcome"
            className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-[14px] bg-[#0A3D2E] text-[#F5D77F] text-xs font-black border border-[#C9A86A]"
          >
            الانتقال لصفحة الترحيب
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A3D2E] via-[#0E4938] to-[#07261D] flex items-center justify-center p-3 sm:p-5 py-6 sm:py-10" dir="rtl">
      <div className="w-full max-w-lg bg-white rounded-[32px] border-2 border-[#C9A86A] shadow-2xl p-5 sm:p-7 relative overflow-hidden">
        {/* الترويسة وبطاقة الترحيب المخصصة */}
        <div className="bg-gradient-to-r from-[#0A3D2E] via-[#124B3A] to-[#0A3D2E] rounded-[24px] p-4 sm:p-5 text-white border border-[#C9A86A]/50 shadow-md mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">👋</span>
            <h1 className="text-base sm:text-lg font-black text-[#F5D77F]">
              أهلاً بك زبوننا العزيز
            </h1>
          </div>

          <div className="space-y-1.5 text-xs font-bold text-slate-200">
            <p className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#F5D77F] shrink-0" />
              <span>من منطقة: <strong className="text-white">{regionName}</strong></span>
            </p>
            <p className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#F5D77F] shrink-0" />
              <span>طلبك من محل: <strong className="text-white">{shopName}</strong></span>
            </p>
            <p className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#F5D77F] shrink-0" />
              <span>وصلك مع المندوب: <strong className="text-[#F5D77F] text-sm">{courierName}</strong></span>
            </p>
          </div>
        </div>

        {/* نبذة التقييم */}
        <div className="text-center mb-5">
          <h2 className="text-base sm:text-lg font-black text-[#0A3D2E]">
            تقييم مندوب التوصيل ⭐
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            نسعد بمعرفة رأيك وتقييمك لأداء المندوب من 5 نجوم لمساعدتنا في تقديم أفضل خدمة
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-[16px] bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* نموذج التقييم */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. أسلوب وتعامل المندوب */}
          <div className="bg-[#FAF6EE] p-4 rounded-[22px] border border-[#C9A86A]/30 shadow-sm space-y-3">
            <InteractiveStarGroup
              value={mannerRating}
              onChange={setMannerRating}
              label="أسلوب وتعامل المندوب"
              icon={<Heart className="w-4 h-4 text-[#C9A86A]" />}
            />

            {/* يظهر الحقل إذا كان التقييم أقل من 5 نجوم */}
            {mannerRating < 5 && (
              <div className="pt-2 border-t border-[#C9A86A]/20 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-black text-[#B45309] mb-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>لماذا أقل من 5 نجوم؟ يرجى إخبارنا بالسبب لنعالجه فوراً:</span>
                </label>
                <textarea
                  value={mannerReason}
                  onChange={(e) => setMannerReason(e.target.value)}
                  placeholder="مثال: المندوب كان متعجلاً، أو لم يكن أسلوبه لائقاً..."
                  rows={2}
                  className="w-full p-2.5 rounded-[14px] bg-white border border-amber-300 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0A3D2E] focus:ring-1 focus:ring-[#0A3D2E]"
                />
              </div>
            )}
          </div>

          {/* 2. سهولة وسرعة توصيل الطلب */}
          <div className="bg-[#FAF6EE] p-4 rounded-[22px] border border-[#C9A86A]/30 shadow-sm space-y-3">
            <InteractiveStarGroup
              value={speedRating}
              onChange={setSpeedRating}
              label="سهولة وسرعة توصيل الطلب"
              icon={<Truck className="w-4 h-4 text-[#C9A86A]" />}
            />

            {/* يظهر الحقل إذا كان التقييم أقل من 5 نجوم */}
            {speedRating < 5 && (
              <div className="pt-2 border-t border-[#C9A86A]/20 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-black text-[#B45309] mb-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>ما الذي سبب تأخير أو صعوبة التوصيل؟</span>
                </label>
                <textarea
                  value={speedReason}
                  onChange={(e) => setSpeedReason(e.target.value)}
                  placeholder="مثال: تأخر في الوصول، صعوبة في معرفة العنوان..."
                  rows={2}
                  className="w-full p-2.5 rounded-[14px] bg-white border border-amber-300 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0A3D2E] focus:ring-1 focus:ring-[#0A3D2E]"
                />
              </div>
            )}
          </div>

          {/* 3. التقييم العام للمندوب */}
          <div className="bg-[#FAF6EE] p-4 rounded-[22px] border border-[#C9A86A]/30 shadow-sm space-y-3">
            <InteractiveStarGroup
              value={overallRating}
              onChange={setOverallRating}
              label="التقييم الإجمالي للخدمة"
              icon={<Star className="w-4 h-4 text-[#C9A86A]" />}
            />

            {/* يظهر الحقل إذا كان التقييم أقل من 5 نجوم */}
            {overallRating < 5 && (
              <div className="pt-2 border-t border-[#C9A86A]/20 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-black text-[#B45309] mb-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>سبب تقييم الخدمة الإجمالية بأقل من 5 نجوم:</span>
                </label>
                <textarea
                  value={overallReason}
                  onChange={(e) => setOverallReason(e.target.value)}
                  placeholder="اكتب تفاصيل إضافية حول التقييم العام..."
                  rows={2}
                  className="w-full p-2.5 rounded-[14px] bg-white border border-amber-300 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0A3D2E] focus:ring-1 focus:ring-[#0A3D2E]"
                />
              </div>
            )}
          </div>

          {/* خانة ملاحظات إضافية */}
          <div className="bg-white p-3.5 rounded-[20px] border border-[#C9A86A]/30">
            <label className="block text-xs font-black text-[#0A3D2E] mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#C9A86A]" />
              <span>هل لديك أي ملاحظات أو اقتراحات أخرى؟ (اختياري)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب أي ملاحظة تحب مشاركتها معنا..."
              rows={2}
              className="w-full p-2.5 rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/30 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0A3D2E]"
            />
          </div>

          {/* زر الإرسال */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-[20px] bg-gradient-to-r from-[#0A3D2E] via-[#0F4D3A] to-[#0A3D2E] text-[#F5D77F] font-black text-sm border-2 border-[#C9A86A] shadow-xl hover:scale-[1.01] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <span>جاري إرسال التقييم... ⏳</span>
            ) : (
              <>
                <span>إرسال التقييم الآن</span>
                <Send className="w-4 h-4 text-[#F5D77F]" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
