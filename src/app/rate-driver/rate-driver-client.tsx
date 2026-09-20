"use client";

import React, { useState } from "react";
import {
  Star,
  Truck,
  Store,
  MapPin,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Send,
  Heart,
  Zap,
  Users,
  ShoppingBag,
  CheckCircle2,
  MessageCircle,
  Phone,
  Clock,
  BookmarkPlus,
  ArrowLeft,
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
  // حالات التقييم — تبدأ بـ 0 (غير محددة)
  const [mannerRating, setMannerRating] = useState<number>(0);
  const [mannerReason, setMannerReason] = useState<string>("");

  const [speedRating, setSpeedRating] = useState<number>(0);
  const [speedReason, setSpeedReason] = useState<string>("");

  const [overallRating, setOverallRating] = useState<number>(0);
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

  // هل النموذج جاهز للإرسال؟
  const isFormReady = mannerRating > 0 && speedRating > 0 && overallRating > 0;

  // دالة الإرسال
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderData || !isFormReady) return;

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
    const [hovered, setHovered] = useState(0);

    const getLabel = (v: number) => {
      if (v === 0) return <span className="text-white/40 font-mono text-[11px]">اختر تقييمك</span>;
      if (v === 5) return <span className="text-[#CCFF00] font-mono text-[11px] font-black">ممتاز! ⭐ (5/5)</span>;
      if (v === 4) return <span className="text-[#a8e060] font-mono text-[11px] font-bold">جيد جداً (4/5)</span>;
      if (v === 3) return <span className="text-orange-400 font-mono text-[11px] font-bold">متوسط (3/5)</span>;
      if (v === 2) return <span className="text-orange-500 font-mono text-[11px] font-bold">مقبول (2/5)</span>;
      return <span className="text-red-400 font-mono text-[11px] font-bold">ضعيف (1/5)</span>;
    };

    const displayVal = hovered > 0 ? hovered : value;

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black text-white flex items-center gap-1.5">
            {icon}
            {label}
          </span>
          {getLabel(displayVal)}
        </div>

        {/* النجوم */}
        <div
          className="flex items-center justify-center gap-3 py-3 bg-white/[0.04] rounded-2xl border border-white/10 hover:border-[#CCFF00]/30 transition-colors"
          dir="ltr"
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= displayVal;
            return (
              <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="p-1 hover:scale-125 active:scale-95 transition-all transform cursor-pointer select-none"
                title={`${star} نجوم`}
              >
                <Star
                  className={`w-9 h-9 md:w-10 md:h-10 transition-all duration-150 ${
                    isFilled
                      ? "fill-[#CCFF00] text-[#CCFF00] drop-shadow-[0_0_8px_rgba(204,255,0,0.6)]"
                      : "fill-transparent text-white/20 hover:text-white/40"
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
      <div
        className="min-h-screen bg-[#080C0F] text-white flex items-center justify-center p-4 py-8 overflow-x-hidden"
        dir="rtl"
      >
        {/* توهجات خلفية */}
        <div className="pointer-events-none fixed inset-0 z-0 opacity-30">
          <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#CCFF00] rounded-full blur-[150px] opacity-10" />
          <div className="absolute bottom-[10%] left-[-10%] w-[350px] h-[350px] bg-[#5FA8D3] rounded-full blur-[140px] opacity-10" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
          {/* بطاقة الشكر */}
          <div className="bg-[#0F171B] border border-white/10 rounded-[32px] p-6 md:p-8 text-center shadow-2xl">
            {/* أيقونة النجاح */}
            <div className="w-20 h-20 rounded-full bg-[#CCFF00]/10 border-2 border-[#CCFF00]/40 flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(204,255,0,0.2)]">
              <CheckCircle2 className="w-10 h-10 text-[#CCFF00]" />
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/30 font-mono text-xs font-bold text-[#CCFF00] mb-4">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
              <span>تم استلام تقييمك بنجاح</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
              شكراً جزيلاً لتقييمك! ❤️
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-md mx-auto mb-8">
              تم استلام تقييمك للمندوب{" "}
              <strong className="text-[#CCFF00]">{courierName}</strong> بنجاح.
              رأيك يساهم في تطوير خدمتنا وتقديم أفضل تجربة توصيل تليق بكم.
            </p>

            {/* بطاقة التعريف بالخدمات */}
            <div className="bg-[#080C0F] border border-[#CCFF00]/20 rounded-[24px] p-5 mb-6 text-right space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-px flex-1 bg-[#CCFF00]/20" />
                <span className="font-mono text-xs text-[#CCFF00] font-bold tracking-widest">تعرّف على خدماتنا</span>
                <span className="h-px flex-1 bg-[#CCFF00]/20" />
              </div>

              <p className="text-white/80 text-sm leading-relaxed font-bold">
                هل تعلم أننا نوصّل <strong className="text-[#CCFF00]">كلشي تريده</strong> لباب بيتك داخل قضاء أبي الخصيب؟ 🚀
              </p>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {[
                  { icon: "💊", text: "أدوية وصيدليات" },
                  { icon: "🍔", text: "مطاعم ووجبات" },
                  { icon: "🛒", text: "سوبرماركت ومخضر" },
                  { icon: "🎁", text: "هدايا ومناسبات" },
                  { icon: "💄", text: "كوزمتك ومكياج" },
                  { icon: "🧁", text: "حلويات وكيك" },
                  { icon: "📚", text: "قرطاسية ومستلزمات" },
                  { icon: "🔄", text: "توصيل فوري 24/7" },
                ].map((item) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 font-bold text-white/80 hover:border-[#CCFF00]/30 transition"
                  >
                    <span className="text-base shrink-0">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2 text-xs font-bold text-white/70">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
                  <span>بدون حاجة لتطبيق أو تسجيل — بس رسالة واتساب!</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
                  <span>سيارات مبردة ودراجات حديثة — توصيل آمن وسريع</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
                  <span>الدفع نقداً أو بطاقة عند الاستلام</span>
                </div>
                {orderData?.shopName && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#5FA8D3] shrink-0" />
                    <span>
                      صاحب متجر؟ انضم إلينا كـ{" "}
                      <strong className="text-[#5FA8D3]">شريك توصيل</strong> وسع نطاق مبيعاتك!
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* زر الانتقال */}
            <a
              href="https://aboakbr.com/welcome"
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-[20px] bg-[#CCFF00] text-black font-black text-sm hover:bg-white transition-all shadow-[0_0_25px_rgba(204,255,0,0.3)] active:scale-95"
            >
              <span>تعرف أكثر عن خدماتنا</span>
              <ArrowLeft className="w-4 h-4" />
            </a>

            <div className="mt-5 text-[11px] font-bold text-white/30 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>أبو الأكبر للتوصيل — أبي الخصيب</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // إذا لم يكن هناك بيانات طلب
  if (!orderData) {
    return (
      <div className="min-h-screen bg-[#080C0F] text-white flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md bg-[#0F171B] border border-white/10 rounded-[28px] p-6 text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-black text-white mb-1">الرابط غير صحيح أو منتهي</h2>
          <p className="text-xs font-bold text-white/50 mb-4">
            يرجى التأكد من الدخول عبر رابط التقييم المرفق مع رسالة الطلب
          </p>
          <a
            href="https://aboakbr.com/welcome"
            className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-[14px] bg-[#CCFF00] text-black text-xs font-black hover:bg-white transition"
          >
            الانتقال لصفحة خدماتنا
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#080C0F] text-white flex items-center justify-center p-3 sm:p-5 py-6 sm:py-10 overflow-x-hidden"
      dir="rtl"
    >
      {/* توهجات خلفية */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-25">
        <div className="absolute top-[-5%] right-[-5%] w-[350px] h-[350px] bg-[#CCFF00] rounded-full blur-[150px] opacity-10" />
        <div className="absolute bottom-[15%] left-[-5%] w-[300px] h-[300px] bg-[#5FA8D3] rounded-full blur-[140px] opacity-10" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* الشريط العلوي للعلامة التجارية */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-xl font-black">
            <span>أبو الأكبر</span>
            <span className="text-[#CCFF00]">.</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-white/[0.05] border border-white/10 rounded-full px-3.5 py-1.5">
            <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
            <span className="text-white/70">نظام تقييم المندوبين</span>
          </div>
        </div>

        {/* بطاقة الترحيب المخصصة */}
        <div className="bg-[#0F171B] border border-white/10 rounded-[24px] p-4 sm:p-5 mb-5 hover:border-[#CCFF00]/20 transition-all">
          <div className="font-mono text-xs tracking-[0.2em] text-[#CCFF00] font-bold mb-2">
            أهلاً وسهلاً بك
          </div>
          <div className="space-y-2 text-sm font-bold text-white/80">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#5FA8D3] shrink-0" />
              <span>
                من منطقة:{" "}
                <strong className="text-white">{regionName}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#5FA8D3] shrink-0" />
              <span>
                طلبك من محل:{" "}
                <strong className="text-white">{shopName}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-white/10">
              <Truck className="w-4 h-4 text-[#CCFF00] shrink-0" />
              <span>
                وصّل طلبك المندوب:{" "}
                <strong className="text-[#CCFF00] text-base">{courierName}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* عنوان التقييم */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1.5">
            قيّم مندوب التوصيل ⭐
          </h1>
          <p className="text-white/50 text-sm font-bold">
            رأيك يساعدنا لنقدم خدمة أفضل — اختر من 1 إلى 5 نجوم
          </p>
        </div>

        {/* رسالة الخطأ */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-[16px] bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* نموذج التقييم */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. أسلوب وتعامل المندوب */}
          <div className="bg-[#0F171B] border border-white/10 rounded-[22px] p-4 sm:p-5 hover:border-[#CCFF00]/20 transition-all">
            <InteractiveStarGroup
              value={mannerRating}
              onChange={setMannerRating}
              label="أسلوب وتعامل المندوب"
              icon={<Heart className="w-4 h-4 text-[#CCFF00]" />}
            />

            {mannerRating > 0 && mannerRating < 5 && (
              <div className="mt-3 pt-3 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-black text-orange-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>لماذا أقل من 5 نجوم؟ أخبرنا لنعالجه فوراً:</span>
                </label>
                <textarea
                  value={mannerReason}
                  onChange={(e) => setMannerReason(e.target.value)}
                  placeholder="مثال: المندوب كان متعجلاً أو أسلوبه لم يكن لائقاً..."
                  rows={2}
                  className="w-full p-3 rounded-[14px] bg-white/[0.04] border border-orange-500/30 text-xs font-bold text-white placeholder:text-white/30 outline-none focus:border-orange-400 resize-none"
                />
              </div>
            )}
          </div>

          {/* 2. سهولة وسرعة توصيل الطلب */}
          <div className="bg-[#0F171B] border border-white/10 rounded-[22px] p-4 sm:p-5 hover:border-[#5FA8D3]/20 transition-all">
            <InteractiveStarGroup
              value={speedRating}
              onChange={setSpeedRating}
              label="سهولة وسرعة توصيل الطلب"
              icon={<Truck className="w-4 h-4 text-[#5FA8D3]" />}
            />

            {speedRating > 0 && speedRating < 5 && (
              <div className="mt-3 pt-3 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-black text-orange-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>لماذا أقل من 5 نجوم؟ ما الذي سبب المشكلة؟</span>
                </label>
                <textarea
                  value={speedReason}
                  onChange={(e) => setSpeedReason(e.target.value)}
                  placeholder="مثال: تأخر في الوصول، صعوبة في إيجاد العنوان..."
                  rows={2}
                  className="w-full p-3 rounded-[14px] bg-white/[0.04] border border-orange-500/30 text-xs font-bold text-white placeholder:text-white/30 outline-none focus:border-orange-400 resize-none"
                />
              </div>
            )}
          </div>

          {/* 3. التقييم العام */}
          <div className="bg-[#0F171B] border border-white/10 rounded-[22px] p-4 sm:p-5 hover:border-[#CCFF00]/20 transition-all">
            <InteractiveStarGroup
              value={overallRating}
              onChange={setOverallRating}
              label="التقييم العام للمندوب والخدمة"
              icon={<Star className="w-4 h-4 text-[#CCFF00]" />}
            />

            {overallRating > 0 && overallRating < 5 && (
              <div className="mt-3 pt-3 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-black text-orange-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>لماذا أقل من 5 نجوم؟ اذكر لنا السبب:</span>
                </label>
                <textarea
                  value={overallReason}
                  onChange={(e) => setOverallReason(e.target.value)}
                  placeholder="اكتب تفاصيل إضافية حول التقييم العام..."
                  rows={2}
                  className="w-full p-3 rounded-[14px] bg-white/[0.04] border border-orange-500/30 text-xs font-bold text-white placeholder:text-white/30 outline-none focus:border-orange-400 resize-none"
                />
              </div>
            )}
          </div>

          {/* خانة الملاحظات الإضافية */}
          <div className="bg-[#0F171B] border border-white/10 rounded-[22px] p-4 sm:p-5">
            <label className="block text-sm font-black text-white mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#5FA8D3]" />
              <span>ملاحظات أو اقتراحات إضافية (اختياري)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب أي ملاحظة أو اقتراح تريد مشاركته معنا..."
              rows={2}
              className="w-full p-3 rounded-[14px] bg-white/[0.04] border border-white/10 text-xs font-bold text-white placeholder:text-white/30 outline-none focus:border-[#CCFF00]/30 resize-none"
            />
          </div>

          {/* بلوك معلومات ما قبل الإرسال */}
          <div className="bg-[#0A0F12] border border-[#CCFF00]/15 rounded-[22px] p-4 sm:p-5 space-y-3">
            <div className="font-mono text-[10px] tracking-[0.25em] text-[#CCFF00] font-bold">
              INFO // تعرّف على خدماتنا
            </div>
            <p className="text-white/70 text-xs leading-relaxed font-bold">
              نحن نقدم خدمة توصيل شاملة داخل قضاء أبي الخصيب تشمل أكثر من{" "}
              <strong className="text-[#CCFF00]">66 منطقة</strong>. سواء كنت
              زبوناً يريد توصيل طلبيته أو صاحب متجر يريد توسيع نطاق مبيعاته،
              نحن هنا لك.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
              <div className="flex items-center gap-1.5 text-white/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
                <span>بدون تطبيق — واتساب فقط</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
                <span>سيارات مبردة ودراجات</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
                <span>الدفع نقداً أو بطاقة</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
                <span>تقييمك سيُراجع من فريقنا</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 text-[11px] font-bold text-white/40 flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#CCFF00] mt-0.5 shrink-0" />
              <span>
                ملاحظة: سيتم مراجعة تقييمك من أحد أعضاء فريقنا والتواصل معك
                في حال وجود أي ملاحظات تستحق المتابعة.
              </span>
            </div>
          </div>

          {/* زر الإرسال */}
          <button
            type="submit"
            disabled={isSubmitting || !isFormReady}
            className={`w-full py-4 px-6 rounded-[20px] font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 cursor-pointer disabled:cursor-not-allowed ${
              isFormReady
                ? "bg-[#CCFF00] text-black hover:bg-white shadow-[0_0_30px_rgba(204,255,0,0.3)]"
                : "bg-white/[0.05] border border-white/10 text-white/40"
            }`}
          >
            {isSubmitting ? (
              <span>جاري إرسال التقييم... ⏳</span>
            ) : !isFormReady ? (
              <span>يرجى اختيار تقييمك بالنجوم أولاً ⭐</span>
            ) : (
              <>
                <span>إرسال التقييم الآن</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
