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
  Truck,
  MapPin,
  ExternalLink,
  MessageCircle,
  Clock,
  ChevronLeft,
  Filter,
} from "lucide-react";
import { whatsappMeUrl } from "@/lib/whatsapp";

// واجهة تقييم الأكشاك والعملاء
interface ClientFeedbackItem {
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

// واجهة تقييم المندوب من قبل الزبائن
interface DriverRatingItem {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  customerPhone: string;
  customerRegion: string;
  customerLandmark: string;
  shopName: string;
  courierId: string | null;
  courierName: string;
  mannerRating: number;
  mannerReason: string | null;
  speedRating: number;
  speedReason: string | null;
  overallRating: number;
  overallReason: string | null;
  notes: string | null;
  createdAt: Date | string;
  order?: {
    id: string;
    orderNumber: number;
    totalAmount: any;
    status: string;
    deliveryPrice: any;
    createdAt: Date | string;
    customerLocationUrl: string;
    shop?: { id: string; name: string; phone: string } | null;
    courier?: { id: string; name: string; phone: string } | null;
  } | null;
}

interface Props {
  initialClientFeedbacks?: ClientFeedbackItem[];
  initialDriverRatings?: DriverRatingItem[];
  // للتوافق مع النداءات القديمة
  initialFeedbacks?: ClientFeedbackItem[];
}

export function ClientFeedbacksView({
  initialClientFeedbacks = [],
  initialDriverRatings = [],
  initialFeedbacks = [],
}: Props) {
  // التبويب النشط: "driver_ratings" (تقييمات الزبائن) أو "client_feedbacks" (تقييمات العملاء)
  const [activeTab, setActiveTab] = useState<"driver_ratings" | "client_feedbacks">("driver_ratings");

  // بيانات تقييمات العملاء
  const [clientFeedbacks] = useState<ClientFeedbackItem[]>(
    initialClientFeedbacks.length > 0 ? initialClientFeedbacks : initialFeedbacks
  );
  // بيانات تقييمات المندوبين من الزبائن
  const [driverRatings] = useState<DriverRatingItem[]>(initialDriverRatings);

  // حالات البحث والفلترة
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRating, setFilterRating] = useState<number | "all" | "issues">("all");

  // النوافذ المنبثقة
  const [selectedClientFeedback, setSelectedClientFeedback] = useState<ClientFeedbackItem | null>(null);
  const [selectedDriverRating, setSelectedDriverRating] = useState<DriverRatingItem | null>(null);

  // -------------------------------------------------------------
  // معالجة تقييمات المندوبين (الزبائن)
  // -------------------------------------------------------------
  const filteredDriverRatings = driverRatings.filter((item) => {
    const text = `${item.customerPhone} ${item.customerRegion} ${item.customerLandmark || ""} ${item.courierName} ${item.shopName} ${item.notes || ""} ${item.mannerReason || ""} ${item.speedReason || ""} ${item.overallReason || ""}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());

    const avg = (item.mannerRating + item.speedRating + item.overallRating) / 3;
    const hasIssues = item.mannerRating < 5 || item.speedRating < 5 || item.overallRating < 5;

    let matchesRating = true;
    if (filterRating === "issues") {
      matchesRating = hasIssues;
    } else if (filterRating !== "all") {
      matchesRating = Math.round(avg) === filterRating;
    }

    return matchesSearch && matchesRating;
  });

  const totalDriverCount = driverRatings.length;
  const avgDriverOverall =
    totalDriverCount > 0
      ? (
          driverRatings.reduce(
            (acc, curr) => acc + (curr.mannerRating + curr.speedRating + curr.overallRating) / 3,
            0
          ) / totalDriverCount
        ).toFixed(1)
      : "5.0";

  const avgDriverManner =
    totalDriverCount > 0
      ? (driverRatings.reduce((acc, curr) => acc + curr.mannerRating, 0) / totalDriverCount).toFixed(1)
      : "5.0";

  const avgDriverSpeed =
    totalDriverCount > 0
      ? (driverRatings.reduce((acc, curr) => acc + curr.speedRating, 0) / totalDriverCount).toFixed(1)
      : "5.0";

  // -------------------------------------------------------------
  // معالجة تقييمات العملاء (الأكشاك)
  // -------------------------------------------------------------
  const filteredClientFeedbacks = clientFeedbacks.filter((item) => {
    const text = `${item.shopName} ${item.employeeName} ${item.employeePhone} ${item.generalFeedback || ""}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());

    const avg = (item.designRating + item.buttonsRating + item.fieldsRating + item.easeRating) / 4;
    const hasIssues =
      item.designRating < 5 || item.buttonsRating < 5 || item.fieldsRating < 5 || item.easeRating < 5;

    let matchesRating = true;
    if (filterRating === "issues") {
      matchesRating = hasIssues;
    } else if (filterRating !== "all") {
      matchesRating = Math.round(avg) === filterRating;
    }

    return matchesSearch && matchesRating;
  });

  const totalClientCount = clientFeedbacks.length;
  const avgClientOverall =
    totalClientCount > 0
      ? (
          clientFeedbacks.reduce(
            (acc, curr) =>
              acc + (curr.designRating + curr.buttonsRating + curr.fieldsRating + curr.easeRating) / 4,
            0
          ) / totalClientCount
        ).toFixed(1)
      : "5.0";

  const avgDesign =
    totalClientCount > 0
      ? (clientFeedbacks.reduce((acc, curr) => acc + curr.designRating, 0) / totalClientCount).toFixed(1)
      : "5.0";
  const avgButtons =
    totalClientCount > 0
      ? (clientFeedbacks.reduce((acc, curr) => acc + curr.buttonsRating, 0) / totalClientCount).toFixed(1)
      : "5.0";
  const avgFields =
    totalClientCount > 0
      ? (clientFeedbacks.reduce((acc, curr) => acc + curr.fieldsRating, 0) / totalClientCount).toFixed(1)
      : "5.0";
  const avgEase =
    totalClientCount > 0
      ? (clientFeedbacks.reduce((acc, curr) => acc + curr.easeRating, 0) / totalClientCount).toFixed(1)
      : "5.0";

  // رسم النجوم
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

  // توليد رابط الواتساب المباشر
  const buildWaUrl = (phone: string, text = "") => {
    return whatsappMeUrl(phone, text);
  };

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {/* الترويسة الرئيسية */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0A3D2E] via-[#0F4D3A] to-[#0A3D2E] p-6 rounded-[24px] border-2 border-[#C9A86A] text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-7 h-7 text-[#F5D77F]" />
            <h1 className="text-xl md:text-2xl font-black text-[#F5D77F]">
              مركز التقييمات الشامل 🌟
            </h1>
          </div>
          <p className="text-xs md:text-sm font-bold text-slate-200">
            متابعة آراء الزبائن عن المندوبين، وتقييمات أصحاب المحلات والأكشاك لتطوير الخدمة
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-[20px] border border-[#C9A86A]/40">
          <div className="text-center">
            <span className="text-[10px] font-bold text-[#F5D77F] block">تقييمات الزبائن</span>
            <span className="text-xl md:text-2xl font-black text-white">{totalDriverCount}</span>
          </div>
          <div className="h-8 w-[1px] bg-[#C9A86A]/40" />
          <div className="text-center">
            <span className="text-[10px] font-bold text-[#F5D77F] block">تقييمات العملاء</span>
            <span className="text-xl md:text-2xl font-black text-white">{totalClientCount}</span>
          </div>
        </div>
      </div>

      {/* شريط التبويبات الفاخر بين الفرعين */}
      <div className="flex items-center gap-2 p-1.5 bg-[#FFF8F0] rounded-[20px] border-2 border-[#C9A86A]/40 shadow-inner">
        <button
          onClick={() => {
            setActiveTab("driver_ratings");
            setSearchTerm("");
            setFilterRating("all");
          }}
          className={`flex-1 py-3 px-4 rounded-[16px] text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "driver_ratings"
              ? "bg-gradient-to-r from-[#0A3D2E] to-[#134E3D] text-[#F5D77F] shadow-md border border-[#C9A86A]"
              : "text-slate-600 hover:text-[#0A3D2E] hover:bg-white/60"
          }`}
        >
          <Truck className="w-4 h-4 md:w-5 md:h-5 text-[#F5D77F]" />
          <span>تقييمات الزبائن (المندوبين)</span>
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#F5D77F]/20 text-[#F5D77F]">
            {totalDriverCount}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("client_feedbacks");
            setSearchTerm("");
            setFilterRating("all");
          }}
          className={`flex-1 py-3 px-4 rounded-[16px] text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "client_feedbacks"
              ? "bg-gradient-to-r from-[#0A3D2E] to-[#134E3D] text-[#F5D77F] shadow-md border border-[#C9A86A]"
              : "text-slate-600 hover:text-[#0A3D2E] hover:bg-white/60"
          }`}
        >
          <Store className="w-4 h-4 md:w-5 md:h-5 text-[#F5D77F]" />
          <span>تقييمات العملاء (الأكشاك والمحلات)</span>
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#F5D77F]/20 text-[#F5D77F]">
            {totalClientCount}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* الفرع الأول: تقييمات الزبائن (المندوبين) */}
      {/* ========================================================================= */}
      {activeTab === "driver_ratings" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* كروت المؤشرات الخاصة بتقييمات المندوبين */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-[20px] border border-[#C9A86A]/30 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">⭐ التقييم الإجمالي للمندوبين</span>
                <span className="text-xl font-black text-[#0A3D2E] mt-1 block">{avgDriverOverall} / 5</span>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2E]">
                <Award className="w-6 h-6 text-[#C9A86A]" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-[20px] border border-[#C9A86A]/30 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">💬 أسلوب وتعامل المندوب</span>
                <span className="text-xl font-black text-[#0A3D2E] mt-1 block">{avgDriverManner} / 5</span>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2E]">
                <MessageSquare className="w-6 h-6 text-[#C9A86A]" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-[20px] border border-[#C9A86A]/30 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">⚡ سهولة وسرعة التوصيل</span>
                <span className="text-xl font-black text-[#0A3D2E] mt-1 block">{avgDriverSpeed} / 5</span>
              </div>
              <div className="w-11 h-11 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2E]">
                <Truck className="w-6 h-6 text-[#C9A86A]" />
              </div>
            </div>
          </div>

          {/* شريط البحث والفلترة */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-[20px] border border-[#C9A86A]/25 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث برقم هاتف الزبون، المنطقة، اسم المندوب، أو المحل..."
                className="w-full h-10 pr-10 pl-4 rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/30 text-xs font-bold text-slate-800 outline-none focus:border-[#0A3D2E]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <button
                onClick={() => setFilterRating("all")}
                className={`px-3 py-1.5 rounded-[12px] text-xs font-black transition whitespace-nowrap cursor-pointer ${
                  filterRating === "all"
                    ? "bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A]"
                    : "bg-[#FFF8F0] text-slate-600 border border-[#C9A86A]/20 hover:bg-slate-100"
                }`}
              >
                الكل ({driverRatings.length})
              </button>

              <button
                onClick={() => setFilterRating("issues")}
                className={`px-3 py-1.5 rounded-[12px] text-xs font-black transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  filterRating === "issues"
                    ? "bg-amber-600 text-white border border-amber-700"
                    : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>أقل من 5 نجوم (الملاحظات)</span>
              </button>

              {[5, 4, 3, 2, 1].map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRating(r)}
                  className={`px-2.5 py-1.5 rounded-[12px] text-xs font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
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

          {/* قائمة كروت تقييمات الزبائن */}
          {filteredDriverRatings.length === 0 ? (
            <div className="bg-white rounded-[24px] border border-[#C9A86A]/30 p-12 text-center shadow-sm">
              <div className="w-16 h-16 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center mx-auto mb-3">
                <Truck className="w-8 h-8 text-[#C9A86A]" />
              </div>
              <h3 className="text-base font-black text-[#0A3D2E]">لا توجد تقييمات زبائن مطابقة</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                لم يتم العثور على أي تقييم يطابق خيارات البحث الحالية
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDriverRatings.map((item) => {
                const avg = ((item.mannerRating + item.speedRating + item.overallRating) / 3).toFixed(1);
                const hasIssues = item.mannerRating < 5 || item.speedRating < 5 || item.overallRating < 5;
                const hasNotes = !!item.notes?.trim();

                const dateStr = new Date(item.createdAt).toLocaleDateString("ar-IQ", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const waUrl = buildWaUrl(
                  item.customerPhone,
                  `السلام عليكم زبوننا العزيز، نتواصل معك بخصوص طلبك من ${item.shopName} وتقييمك لخدمة التوصيل...`
                );

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-[24px] border-2 border-[#C9A86A]/35 hover:border-[#0A3D2E] p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div>
                      {/* ترويسة البطاقة: الزبون والمنطقة */}
                      <div className="flex items-start justify-between gap-2 mb-3 pb-3 border-b border-[#C9A86A]/20">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#0A3D2E] to-[#14532D] text-[#F5D77F] border border-[#C9A86A]/50 flex items-center justify-center shrink-0 shadow-sm font-black text-sm">
                            <User className="w-5 h-5 text-[#F5D77F]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-[#0A3D2E] font-mono" dir="ltr">
                                {item.customerPhone || "بدون رقم"}
                              </span>
                              {item.orderNumber && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/30 text-[#B45309]">
                                  #{item.orderNumber}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-[#C9A86A] shrink-0" />
                              <span className="truncate">{item.customerRegion || "منطقة غير محددة"}</span>
                            </div>
                          </div>
                        </div>

                        {/* التقييم العام */}
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1 bg-[#FFF8F0] border border-[#C9A86A]/30 px-2 py-0.5 rounded-full">
                            <span className="text-xs font-black text-[#0A3D2E]">{avg}</span>
                            <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#D97706]" />
                          </div>
                        </div>
                      </div>

                      {/* بيانات المندوب والمحل */}
                      <div className="bg-[#FAF6EE] p-2.5 rounded-[14px] border border-[#C9A86A]/25 mb-3 text-xs font-bold space-y-1">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-[#0A3D2E]" />
                            <span>المندوب:</span>
                          </span>
                          <span className="font-black text-[#0A3D2E]">{item.courierName || "غير محدد"}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-[#C9A86A]" />
                            <span>المحل:</span>
                          </span>
                          <span className="font-bold text-slate-800">{item.shopName || "غير محدد"}</span>
                        </div>
                      </div>

                      {/* التقييمات الثلاثية */}
                      <div className="space-y-1.5 mb-3">
                        <div className="bg-[#FFFDF9] p-2 rounded-[12px] border border-[#C9A86A]/20 flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-600">💬 أسلوب المندوب</span>
                          {renderStars(item.mannerRating, 13)}
                        </div>
                        <div className="bg-[#FFFDF9] p-2 rounded-[12px] border border-[#C9A86A]/20 flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-600">⚡ سهولة وسرعة التوصيل</span>
                          {renderStars(item.speedRating, 13)}
                        </div>
                        <div className="bg-[#FFFDF9] p-2 rounded-[12px] border border-[#C9A86A]/20 flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-600">⭐ التقييم العام</span>
                          {renderStars(item.overallRating, 13)}
                        </div>
                      </div>

                      {/* أسباب التقييم الأقل من 5 نجوم إن وجدت */}
                      {(item.mannerReason || item.speedReason || item.overallReason) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-[14px] p-2.5 mb-3 text-xs font-bold space-y-1">
                          <div className="flex items-center gap-1 text-amber-900 font-black mb-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>سبب عدم إعطاء 5 نجوم:</span>
                          </div>
                          {item.mannerReason && (
                            <p className="text-slate-700 leading-relaxed text-[11.5px]">
                              • <strong className="text-amber-800">الأسلوب:</strong> {item.mannerReason}
                            </p>
                          )}
                          {item.speedReason && (
                            <p className="text-slate-700 leading-relaxed text-[11.5px]">
                              • <strong className="text-amber-800">التوصيل:</strong> {item.speedReason}
                            </p>
                          )}
                          {item.overallReason && (
                            <p className="text-slate-700 leading-relaxed text-[11.5px]">
                              • <strong className="text-amber-800">العام:</strong> {item.overallReason}
                            </p>
                          )}
                        </div>
                      )}

                      {/* الملاحظات الإضافية */}
                      {hasNotes && (
                        <div className="bg-[#FAF6EE] border border-[#C9A86A]/30 rounded-[14px] p-2.5 mb-3 text-xs font-bold text-slate-700 leading-relaxed">
                          <span className="font-black text-[#0A3D2E]">📝 ملاحظات الزبون: </span>
                          <span>{item.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* أزرار الإجراءات وأسفل البطاقة */}
                    <div className="pt-3 border-t border-[#C9A86A]/20 flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-bold text-slate-400">
                        {dateStr}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* زر التواصل عبر الواتساب */}
                        {item.customerPhone && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-8 px-2.5 rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 shadow-sm transition active:scale-95"
                            title="فتح محادثة واتساب مع الزبون"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </a>
                        )}

                        {/* زر تفاصيل الطلب والمندوب */}
                        <button
                          onClick={() => setSelectedDriverRating(item)}
                          className="h-8 px-3 rounded-[10px] bg-[#0A3D2E] hover:bg-[#124E3D] text-[#F5D77F] border border-[#C9A86A] text-[11px] font-black flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          <span>التفاصيل</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* الفرع الثاني: تقييمات العملاء (الأكشاك والمحلات) */}
      {/* ========================================================================= */}
      {activeTab === "client_feedbacks" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* بطاقات المؤشرات الفرعية لتقييمات الأكشاك */}
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

          {/* البحث والفلترة للأكشاك */}
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
                className={`px-3 py-1.5 rounded-[12px] text-xs font-black transition whitespace-nowrap cursor-pointer ${
                  filterRating === "all"
                    ? "bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A]"
                    : "bg-[#FFF8F0] text-slate-600 border border-[#C9A86A]/20"
                }`}
              >
                الكل ({clientFeedbacks.length})
              </button>
              {[5, 4, 3, 2, 1].map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRating(r)}
                  className={`px-2.5 py-1.5 rounded-[12px] text-xs font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
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

          {/* قائمة تقييمات الأكشاك */}
          {filteredClientFeedbacks.length === 0 ? (
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
              {filteredClientFeedbacks.map((item) => {
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
                    onClick={() => setSelectedClientFeedback(item)}
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

                      {/* مقتطف الملاحظات */}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* نافذة تفاصيل تقييم الزبون والمندوب Modal */}
      {/* ========================================================================= */}
      {selectedDriverRating && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#05281C]/75 backdrop-blur-md animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-[28px] border-2 border-[#C9A86A] bg-gradient-to-b from-[#FFFEFB] via-[#FFFDF7] to-[#FAF6EE] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* زر الإغلاق */}
            <button
              onClick={() => setSelectedDriverRating(null)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#0A3D2E] flex items-center justify-center hover:bg-white active:scale-95 transition z-10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* رأس النافذة */}
            <div className="p-5 pb-3 border-b border-[#C9A86A]/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0A3D2E] to-[#164E3D] border-2 border-[#F5D77F] flex items-center justify-center text-[#F5D77F] shrink-0 shadow-md">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A3D2E]">
                    تفاصيل تقييم الزبون للمندوب
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mt-0.5">
                    <span className="font-mono text-slate-700" dir="ltr">
                      {selectedDriverRating.customerPhone}
                    </span>
                    {selectedDriverRating.orderNumber && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/30 text-[#B45309] font-bold">
                        طلب #{selectedDriverRating.orderNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* محتوى النافذة */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* بطاقة ملخص الأطراف (الزبون، المحل، المندوب) */}
              <div className="grid grid-cols-2 gap-2 text-xs font-bold bg-[#FAF6EE] p-3 rounded-[16px] border border-[#C9A86A]/25">
                <div>
                  <span className="text-slate-400 block text-[11px]">المندوب:</span>
                  <span className="text-[#0A3D2E] font-black">{selectedDriverRating.courierName || "غير محدد"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">المحل:</span>
                  <span className="text-slate-800 font-bold">{selectedDriverRating.shopName || "غير محدد"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">منطقة الزبون:</span>
                  <span className="text-slate-800 font-bold">{selectedDriverRating.customerRegion || "غير محدد"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">أقرب نقطة دالة:</span>
                  <span className="text-slate-800 font-bold">{selectedDriverRating.customerLandmark || "—"}</span>
                </div>
              </div>

              {/* التقييمات الثلاثة التفصيلية */}
              <div className="space-y-3">
                {/* أسلوب المندوب */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">💬 أسلوب وتعامل المندوب</span>
                    {renderStars(selectedDriverRating.mannerRating, 16)}
                  </div>
                  {selectedDriverRating.mannerReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-[12px] border border-amber-200">
                      <span className="font-black text-amber-800">السبب والملاحظة: </span>
                      {selectedDriverRating.mannerReason}
                    </div>
                  )}
                </div>

                {/* سرعة وسهولة التوصيل */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">⚡ سهولة وسرعة التوصيل</span>
                    {renderStars(selectedDriverRating.speedRating, 16)}
                  </div>
                  {selectedDriverRating.speedReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-[12px] border border-amber-200">
                      <span className="font-black text-amber-800">السبب والملاحظة: </span>
                      {selectedDriverRating.speedReason}
                    </div>
                  )}
                </div>

                {/* التقييم العام */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">⭐ التقييم العام للخدمة</span>
                    {renderStars(selectedDriverRating.overallRating, 16)}
                  </div>
                  {selectedDriverRating.overallReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-[12px] border border-amber-200">
                      <span className="font-black text-amber-800">السبب والملاحظة: </span>
                      {selectedDriverRating.overallReason}
                    </div>
                  )}
                </div>
              </div>

              {/* ملاحظات الزبون الإضافية */}
              {selectedDriverRating.notes && (
                <div className="rounded-[18px] bg-white border-2 border-[#C9A86A]/40 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-[#0A3D2E]">
                    <MessageSquare className="w-4 h-4 text-[#C9A86A]" />
                    <h4 className="text-xs font-black">الملاحظات والاقتراحات المكتوبة:</h4>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed bg-[#FFF8F0] p-3 rounded-[12px] border border-[#C9A86A]/25 whitespace-pre-wrap">
                    {selectedDriverRating.notes}
                  </p>
                </div>
              )}
            </div>

            {/* أسفل النافذة */}
            <div className="p-4 bg-[#FAF6EE] border-t border-[#C9A86A]/20 shrink-0 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500">
                {new Date(selectedDriverRating.createdAt).toLocaleString("ar-IQ")}
              </span>

              <div className="flex items-center gap-2">
                {selectedDriverRating.customerPhone && (
                  <a
                    href={buildWaUrl(
                      selectedDriverRating.customerPhone,
                      `السلام عليكم زبوننا العزيز، نتواصل معك بخصوص تقييمك لطلبك من ${selectedDriverRating.shopName}...`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-4 rounded-[12px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>مراسلة عبر واتساب</span>
                  </a>
                )}

                <button
                  onClick={() => setSelectedDriverRating(null)}
                  className="h-9 px-4 rounded-[12px] bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A] text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* نافذة تفاصيل تقييم العميل (الكشك) Modal */}
      {/* ========================================================================= */}
      {selectedClientFeedback && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#05281C]/75 backdrop-blur-md animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="relative w-full max-w-[500px] max-h-[90vh] flex flex-col rounded-[28px] border-2 border-[#C9A86A] bg-gradient-to-b from-[#FFFEFB] via-[#FFFDF7] to-[#FAF6EE] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* زر الإغلاق */}
            <button
              onClick={() => setSelectedClientFeedback(null)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#0A3D2E] flex items-center justify-center hover:bg-white active:scale-95 transition z-10 cursor-pointer"
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
                    {selectedClientFeedback.shopName || "محل غير محدد"}
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600 mt-0.5">
                    <span>بواسطة: {selectedClientFeedback.employeeName || "العميل"}</span>
                    {selectedClientFeedback.employeePhone && (
                      <span className="font-mono text-slate-500">
                        ({selectedClientFeedback.employeePhone})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* محتوى النافذة مع سكرول */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-3">
                {/* التصميم */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">🎨 التصميم والمظهر</span>
                    {renderStars(selectedClientFeedback.designRating, 16)}
                  </div>
                  {selectedClientFeedback.designReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#B45309] bg-amber-50/70 p-2 rounded-[10px]">
                      <span className="font-black">السبب والمقترح: </span>
                      {selectedClientFeedback.designReason}
                    </div>
                  )}
                </div>

                {/* الأزرار */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">🔘 حركة الأزرار</span>
                    {renderStars(selectedClientFeedback.buttonsRating, 16)}
                  </div>
                  {selectedClientFeedback.buttonsReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#B45309] bg-amber-50/70 p-2 rounded-[10px]">
                      <span className="font-black">السبب والمقترح: </span>
                      {selectedClientFeedback.buttonsReason}
                    </div>
                  )}
                </div>

                {/* الخانات */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">📝 الخانات والإدخال</span>
                    {renderStars(selectedClientFeedback.fieldsRating, 16)}
                  </div>
                  {selectedClientFeedback.fieldsReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#B45309] bg-amber-50/70 p-2 rounded-[10px]">
                      <span className="font-black">السبب والمقترح: </span>
                      {selectedClientFeedback.fieldsReason}
                    </div>
                  )}
                </div>

                {/* السهولة */}
                <div className="rounded-[16px] bg-white border border-[#C9A86A]/30 p-3.5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-[#0A3D2E]">⚡ سهولة وسرعة الرفع</span>
                    {renderStars(selectedClientFeedback.easeRating, 16)}
                  </div>
                  {selectedClientFeedback.easeReason && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold text-[#B45309] bg-amber-50/70 p-2 rounded-[10px]">
                      <span className="font-black">السبب والمقترح: </span>
                      {selectedClientFeedback.easeReason}
                    </div>
                  )}
                </div>
              </div>

              {/* المقترحات والأفكار العامة */}
              {selectedClientFeedback.generalFeedback && (
                <div className="rounded-[18px] bg-white border-2 border-[#C9A86A]/40 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-[#0A3D2E]">
                    <MessageSquare className="w-4 h-4 text-[#C9A86A]" />
                    <h4 className="text-xs font-black">الأفكار والمقترحات المكتوبة:</h4>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed bg-[#FFF8F0] p-3 rounded-[12px] border border-[#C9A86A]/25 whitespace-pre-wrap">
                    {selectedClientFeedback.generalFeedback}
                  </p>
                </div>
              )}
            </div>

            {/* أسفل النافذة */}
            <div className="p-4 bg-[#FAF6EE] border-t border-[#C9A86A]/20 shrink-0 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                {new Date(selectedClientFeedback.createdAt).toLocaleString("ar-IQ")}
              </span>
              <button
                onClick={() => setSelectedClientFeedback(null)}
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
