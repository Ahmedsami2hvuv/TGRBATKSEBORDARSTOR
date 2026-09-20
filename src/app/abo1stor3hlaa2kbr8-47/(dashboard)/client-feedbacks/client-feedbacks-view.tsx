"use client";

import React, { useState } from "react";
import {
  Star,
  Search,
  Store,
  User,
  Phone,
  Calendar,
  MessageSquare,
  Sparkles,
  AlertCircle,
  X,
  TrendingUp,
  Award,
  Layers,
  MousePointerClick,
  Sliders,
  CheckCircle2,
} from "lucide-react";

interface FeedbackItem {
  id: string;
  shopId: string | null;
  shopName: string;
  employeeName: string;
  employeePhone: string;
  designRating: number;
  designReason: string | null;
  buttonsRating: number;
  buttonsReason: string | null;
  fieldsRating: number;
  fieldsReason: string | null;
  easeRating: number;
  easeReason: string | null;
  generalFeedback: string | null;
  createdAt: Date | string;
  shop?: {
    id: string;
    name: string;
    phone: string;
    photoUrl: string;
    region?: { name: string };
  } | null;
}

export function ClientFeedbacksView({
  initialFeedbacks,
}: {
  initialFeedbacks: any[];
}) {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(initialFeedbacks || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [filterRating, setFilterRating] = useState<number | "all">("all");

  const filtered = feedbacks.filter((item) => {
    const text = `${item.shopName} ${item.employeeName} ${item.employeePhone} ${item.generalFeedback || ""}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());

    const avg = (item.designRating + item.buttonsRating + item.fieldsRating + item.easeRating) / 4;
    const matchesRating =
      filterRating === "all" ? true : Math.round(avg) === filterRating;

    return matchesSearch && matchesRating;
  });

  // حساب الإحصائيات العامة
  const totalCount = feedbacks.length;
  const avgOverall =
    totalCount > 0
      ? (
          feedbacks.reduce(
            (acc, curr) =>
              acc + (curr.designRating + curr.buttonsRating + curr.fieldsRating + curr.easeRating) / 4,
            0
          ) / totalCount
        ).toFixed(1)
      : "5.0";

  const avgDesign =
    totalCount > 0
      ? (feedbacks.reduce((acc, curr) => acc + curr.designRating, 0) / totalCount).toFixed(1)
      : "5.0";
  const avgButtons =
    totalCount > 0
      ? (feedbacks.reduce((acc, curr) => acc + curr.buttonsRating, 0) / totalCount).toFixed(1)
      : "5.0";
  const avgFields =
    totalCount > 0
      ? (feedbacks.reduce((acc, curr) => acc + curr.fieldsRating, 0) / totalCount).toFixed(1)
      : "5.0";
  const avgEase =
    totalCount > 0
      ? (feedbacks.reduce((acc, curr) => acc + curr.easeRating, 0) / totalCount).toFixed(1)
      : "5.0";

  const renderStars = (rating: number, size = 16) => {
    return (
      <div className="flex items-center gap-0.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            style={{ width: `${size}px`, height: `${size}px` }}
            className={`${
              star <= rating
                ? "fill-[#F59E0B] text-[#D97706]"
                : "fill-transparent text-[#CBD5E1]"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      {/* الترويسة الرئيسية */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0A3D2E] via-[#0F4D3A] to-[#0A3D2E] p-6 rounded-[24px] border-2 border-[#C9A86A] text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-6 h-6 text-[#F5D77F]" />
            <h1 className="text-xl md:text-2xl font-black text-[#F5D77F]">
              تقييمات الأكشاك والعملاء 🌟
            </h1>
          </div>
          <p className="text-sm font-bold text-slate-200">
            متابعة آراء وملاحظات وتجارب أصحاب المحلات والعملاء لتطوير الموقع باستمرار
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-[18px] border border-[#C9A86A]/40">
          <div className="text-center">
            <span className="text-[10px] font-bold text-[#F5D77F] block">التقييم العام</span>
            <span className="text-2xl font-black text-white">{avgOverall}</span>
          </div>
          <div className="h-8 w-[1px] bg-[#C9A86A]/40" />
          <div className="text-center">
            <span className="text-[10px] font-bold text-[#F5D77F] block">إجمالي التقييمات</span>
            <span className="text-2xl font-black text-white">{totalCount}</span>
          </div>
        </div>
      </div>

      {/* بطاقات المؤشرات الفرعية */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-[20px] border border-[#C9A86A]/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">🎨 التصميم والمظهر</span>
            <span className="text-lg font-black text-[#0A3D2E] mt-1 block">{avgDesign} / 5</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2E]">
            <Sparkles className="w-5 h-5 text-[#C9A86A]" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[20px] border border-[#C9A86A]/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">🔘 حركة الأزرار</span>
            <span className="text-lg font-black text-[#0A3D2E] mt-1 block">{avgButtons} / 5</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2E]">
            <MousePointerClick className="w-5 h-5 text-[#C9A86A]" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[20px] border border-[#C9A86A]/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">📝 الخانات والإدخال</span>
            <span className="text-lg font-black text-[#0A3D2E] mt-1 block">{avgFields} / 5</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2E]">
            <Sliders className="w-5 h-5 text-[#C9A86A]" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[20px] border border-[#C9A86A]/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">⚡ سهولة وسرعة الرفع</span>
            <span className="text-lg font-black text-[#0A3D2E] mt-1 block">{avgEase} / 5</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2E]">
            <TrendingUp className="w-5 h-5 text-[#C9A86A]" />
          </div>
        </div>
      </div>

      {/* البحث والفلترة */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-[20px] border border-[#C9A86A]/25 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم المحل، الموظف، أو نص الملاحظة..."
            className="w-full h-10 pr-10 pl-4 rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/30 text-xs font-bold text-slate-800 outline-none focus:border-[#0A3D2E]"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterRating("all")}
            className={`px-3 py-1.5 rounded-[12px] text-xs font-black transition whitespace-nowrap ${
              filterRating === "all"
                ? "bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A]"
                : "bg-[#FFF8F0] text-slate-600 border border-[#C9A86A]/20"
            }`}
          >
            الكل ({feedbacks.length})
          </button>
          {[5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRating(r)}
              className={`px-2.5 py-1.5 rounded-[12px] text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${
                filterRating === r
                  ? "bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A]"
                  : "bg-[#FFF8F0] text-slate-600 border border-[#C9A86A]/20"
              }`}
            >
              <span>{r}</span>
              <Star className="w-3 h-3 fill-[#F59E0B] text-[#D97706]" />
            </button>
          ))}
        </div>
      </div>

      {/* قائمة التقييمات */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-[#C9A86A]/30 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-8 h-8 text-[#C9A86A]" />
          </div>
          <h3 className="text-base font-black text-[#0A3D2E]">لا توجد تقييمات مطابقة</h3>
          <p className="text-xs font-bold text-slate-400 mt-1">
            لم يتم العثور على أي تقييم يطابق خيارات البحث الحالية
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const avg = (
              (item.designRating + item.buttonsRating + item.fieldsRating + item.easeRating) /
              4
            ).toFixed(1);
            const hasIssues =
              item.designRating < 5 ||
              item.buttonsRating < 5 ||
              item.fieldsRating < 5 ||
              item.easeRating < 5;
            const hasGeneralFeedback = !!item.generalFeedback?.trim();

            const dateStr = new Date(item.createdAt).toLocaleDateString("ar-IQ", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={item.id}
                onClick={() => setSelectedFeedback(item)}
                className="bg-white rounded-[22px] border-2 border-[#C9A86A]/35 hover:border-[#0A3D2E] p-4 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* رأس البطاقة */}
                  <div className="flex items-start justify-between gap-2 mb-3 pb-3 border-b border-[#C9A86A]/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center shrink-0">
                        <Store className="w-5 h-5 text-[#0A3D2E]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-[#0A3D2E] truncate group-hover:text-[#B45309] transition">
                          {item.shopName || "محل غير محدد"}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-[#C9A86A]" />
                            {item.employeeName || "العميل"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 bg-[#FFF8F0] border border-[#C9A86A]/30 px-2 py-0.5 rounded-full">
                        <span className="text-xs font-black text-[#0A3D2E]">{avg}</span>
                        <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#D97706]" />
                      </div>
                    </div>
                  </div>

                  {/* تفاصيل التقييمات الأربعة */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold mb-3">
                    <div className="bg-[#FFF8F0]/70 p-2 rounded-[12px] border border-[#C9A86A]/20 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">🎨 التصميم</span>
                      {renderStars(item.designRating, 12)}
                    </div>
                    <div className="bg-[#FFF8F0]/70 p-2 rounded-[12px] border border-[#C9A86A]/20 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">🔘 الأزرار</span>
                      {renderStars(item.buttonsRating, 12)}
                    </div>
                    <div className="bg-[#FFF8F0]/70 p-2 rounded-[12px] border border-[#C9A86A]/20 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">📝 الخانات</span>
                      {renderStars(item.fieldsRating, 12)}
                    </div>
                    <div className="bg-[#FFF8F0]/70 p-2 rounded-[12px] border border-[#C9A86A]/20 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">⚡ السهولة</span>
                      {renderStars(item.easeRating, 12)}
                    </div>
                  </div>

                  {/* مقتطف الملاحظات إن وجدت */}
                  {hasGeneralFeedback && (
                    <div className="bg-[#FAF6EE] border border-[#C9A86A]/30 rounded-[12px] p-2.5 mb-2 text-xs font-bold text-slate-700 leading-relaxed line-clamp-2">
                      <span className="font-black text-[#0A3D2E]">💡 مقترح: </span>
                      {item.generalFeedback}
                    </div>
                  )}

                  {hasIssues && (
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-[#B45309] bg-amber-50 border border-amber-200 px-2 py-1 rounded-[10px] w-fit">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>يوجد ملاحظات وأسباب تحسين</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-[#C9A86A]/15 flex items-center justify-between text-[10.5px] font-bold text-slate-400">
                  <span>{dateStr}</span>
                  <span className="text-[#0A3D2E] font-black underline group-hover:text-[#B45309]">
                    عرض التفاصيل ←
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة عرض تفاصيل التقييم بالكامل Modal */}
      {selectedFeedback && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#05281C]/75 backdrop-blur-md animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="relative w-full max-w-[500px] max-h-[90vh] flex flex-col rounded-[28px] border-2 border-[#C9A86A] bg-gradient-to-b from-[#FFFEFB] via-[#FFFDF7] to-[#FAF6EE] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* زر الإغلاق */}
            <button
              onClick={() => setSelectedFeedback(null)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#0A3D2E] flex items-center justify-center hover:bg-white active:scale-95 transition z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* رأس النافذة */}
            <div className="p-5 pb-3 border-b border-[#C9A86A]/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0A3D2E] to-[#164E3D] border-2 border-[#F5D77F] flex items-center justify-center text-[#F5D77F] shrink-0 shadow-md">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A3D2E]">
                    {selectedFeedback.shopName || "محل غير محدد"}
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600 mt-0.5">
                    <span>بواسطة: {selectedFeedback.employeeName || "العميل"}</span>
                    {selectedFeedback.employeePhone && (
                      <span className="font-mono text-slate-500">
                        ({selectedFeedback.employeePhone})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* محتوى النافذة مع سكرول */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* التقييمات الأربعة التفصيلية */}
              <div className="space-y-3">
                {/* التصميم */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">🎨 التصميم والمظهر</span>
                    {renderStars(selectedFeedback.designRating, 16)}
                  </div>
                  {selectedFeedback.designReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#B45309] bg-amber-50/70 p-2 rounded-[10px]">
                      <span className="font-black">السبب والمقترح: </span>
                      {selectedFeedback.designReason}
                    </div>
                  )}
                </div>

                {/* الأزرار */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">🔘 حركة الأزرار</span>
                    {renderStars(selectedFeedback.buttonsRating, 16)}
                  </div>
                  {selectedFeedback.buttonsReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#B45309] bg-amber-50/70 p-2 rounded-[10px]">
                      <span className="font-black">السبب والمقترح: </span>
                      {selectedFeedback.buttonsReason}
                    </div>
                  )}
                </div>

                {/* الخانات */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">📝 الخانات والإدخال</span>
                    {renderStars(selectedFeedback.fieldsRating, 16)}
                  </div>
                  {selectedFeedback.fieldsReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#B45309] bg-amber-50/70 p-2 rounded-[10px]">
                      <span className="font-black">السبب والمقترح: </span>
                      {selectedFeedback.fieldsReason}
                    </div>
                  )}
                </div>

                {/* السهولة */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">⚡ سهولة وسرعة الرفع</span>
                    {renderStars(selectedFeedback.easeRating, 16)}
                  </div>
                  {selectedFeedback.easeReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#B45309] bg-amber-50/70 p-2 rounded-[10px]">
                      <span className="font-black">السبب والمقترح: </span>
                      {selectedFeedback.easeReason}
                    </div>
                  )}
                </div>
              </div>

              {/* المقترحات والأفكار العامة */}
              {selectedFeedback.generalFeedback && (
                <div className="rounded-[18px] bg-white border-2 border-[#C9A86A]/40 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-[#0A3D2E]">
                    <MessageSquare className="w-4 h-4 text-[#C9A86A]" />
                    <h4 className="text-xs font-black">الأفكار والمقترحات المكتوبة:</h4>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed bg-[#FFF8F0] p-3 rounded-[12px] border border-[#C9A86A]/25 whitespace-pre-wrap">
                    {selectedFeedback.generalFeedback}
                  </p>
                </div>
              )}
            </div>

            {/* أسفل النافذة */}
            <div className="p-4 bg-[#FAF6EE] border-t border-[#C9A86A]/20 shrink-0 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                {new Date(selectedFeedback.createdAt).toLocaleString("ar-IQ")}
              </span>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="h-9 px-5 rounded-[12px] bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A] text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
