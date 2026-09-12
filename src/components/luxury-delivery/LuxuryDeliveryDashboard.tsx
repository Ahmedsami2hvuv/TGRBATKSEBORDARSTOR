"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Search,
  Truck,
  Zap,
  FileText,
  Smartphone,
  Edit3,
  MapPin,
  X,
  ArrowLeft,
  ChevronDown,
  Sparkles,
  Check
} from "lucide-react";

interface OrderItem {
  id: string;
  orderNumber: string;
  destinationBadge: string;
  mandobBadge: string;
  priceCircle: string;
  rightText: string;
  leftText: string;
  phone: string;
  hasTwoDestinations?: boolean;
  hasNoLocation?: boolean;
  status: "new" | "assigned" | "delivered" | "inspection";
  deliveryType: string;
  notes?: string;
  createdAt: string;
}

const INITIAL_ORDERS: OrderItem[] = [
  {
    id: "2426",
    orderNumber: "2426",
    destinationBadge: "الاسمدة إلى باب طويل",
    mandobBadge: "إسناد للمندوب",
    priceCircle: "20",
    rightText: "توصيل فقط",
    leftText: "توصيل فقط - غدا",
    phone: "07835098348",
    hasTwoDestinations: true,
    hasNoLocation: true,
    status: "new",
    deliveryType: "توصيل فوري",
    createdAt: "11 أيلول 2026"
  },
  {
    id: "2419",
    orderNumber: "2419",
    destinationBadge: "مطبخ البركات إلى محيلة السوق",
    mandobBadge: "إسناد للمندوب",
    priceCircle: "29",
    rightText: "معجنات كبه",
    leftText: "غدا 11 صباحا",
    phone: "07725426930",
    hasTwoDestinations: false,
    hasNoLocation: true,
    status: "new",
    deliveryType: "توصيل غداً",
    createdAt: "11 أيلول 2026"
  }
];

export default function LuxuryDeliveryDashboard() {
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [activeFilter, setActiveFilter] = useState<string>("الكل");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [cardsCols, setCardsCols] = useState<number>(1);
  const [showCardsMenu, setShowCardsMenu] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isProfitModalOpen, setIsProfitModalOpen] = useState<boolean>(false);
  const [quickSelectMode, setQuickSelectMode] = useState<boolean>(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // حقول إضافة طلب جديد
  const [newOrder, setNewOrder] = useState({
    shopName: "",
    region: "",
    price: "25",
    phone: "",
    notes: "توصيل فوري",
    deliveryTime: "اليوم"
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // تصفية الطلبات
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.orderNumber.includes(searchQuery) ||
        order.phone.includes(searchQuery) ||
        order.destinationBadge.includes(searchQuery) ||
        order.rightText.includes(searchQuery);

      if (!matchesSearch) return false;

      if (activeFilter === "الكل") return true;
      if (activeFilter === "جديد") return order.status === "new";
      if (activeFilter === "مسند") return order.status === "assigned";
      if (activeFilter === "مسلّم") return order.status === "delivered";
      if (activeFilter === "فحص") return order.status === "inspection";
      return true;
    });
  }, [orders, searchQuery, activeFilter]);

  // إحصائيات
  const counts = useMemo(() => {
    return {
      all: orders.length,
      new: orders.filter((o) => o.status === "new").length,
      assigned: orders.filter((o) => o.status === "assigned").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      inspection: orders.filter((o) => o.status === "inspection").length,
    };
  }, [orders]);

  // تبديل اختيار في التحديد السريع
  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // معالجة تغيير الحالة
  const handleStatusChange = (id: string, newStatus: OrderItem["status"], statusLabel: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
    showToast(`تم تحديث الطلب #${id} إلى: ${statusLabel}`);
  };

  // حذف أو رفض الطلب
  const handleDeleteOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    showToast(`تم حذف/رفض الطلب #${id} بنجاح`);
  };

  // إضافة طلب جديد
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.phone || !newOrder.shopName) {
      showToast("يرجى ملء اسم المحل ورقم الهاتف");
      return;
    }

    const nextId = (Math.floor(Math.random() * 900) + 2400).toString();
    const created: OrderItem = {
      id: nextId,
      orderNumber: nextId,
      destinationBadge: `${newOrder.shopName} إلى ${newOrder.region || "بغداد"}`,
      mandobBadge: "إسناد للمندوب",
      priceCircle: newOrder.price || "25",
      rightText: newOrder.notes || "توصيل فقط",
      leftText: newOrder.deliveryTime || "اليوم",
      phone: newOrder.phone,
      hasTwoDestinations: false,
      hasNoLocation: true,
      status: "new",
      deliveryType: "طلب إدارة",
      createdAt: "11 أيلول 2026"
    };

    setOrders((prev) => [created, ...prev]);
    setIsAddModalOpen(false);
    setNewOrder({
      shopName: "",
      region: "",
      price: "25",
      phone: "",
      notes: "توصيل فوري",
      deliveryTime: "اليوم"
    });
    showToast(`تمت إضافة الطلب الملكي الجديد #${nextId} بنجاح ⚜️`);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#FFF8F0] text-[#0A3D2E] font-['Cairo',sans-serif] selection:bg-[#C9A86A]/30 pb-20 relative overflow-x-hidden antialiased"
      style={{
        fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif"
      }}
    >
      {/* ستايلات الذهب والزخارف المخصصة */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        
        .royal-gold-text {
          background: linear-gradient(135deg, #FFF0D0 0%, #F5D77F 40%, #C9A86A 80%, #9E7D3B 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gold-border-glow {
          box-shadow: 0 0 15px rgba(201, 168, 106, 0.35), inset 0 0 10px rgba(201, 168, 106, 0.2);
        }

        .gold-card-shadow {
          box-shadow: 0 10px 30px -5px rgba(10, 61, 46, 0.08), 0 4px 15px rgba(201, 168, 106, 0.15);
        }

        .damask-bg {
          background-color: #0A3D2E;
          background-image: 
            radial-gradient(circle at 50% 50%, rgba(201, 168, 106, 0.12) 1px, transparent 1px),
            linear-gradient(45deg, rgba(201, 168, 106, 0.06) 25%, transparent 25%, transparent 75%, rgba(201, 168, 106, 0.06) 75%, rgba(201, 168, 106, 0.06)),
            linear-gradient(-45deg, rgba(201, 168, 106, 0.06) 25%, transparent 25%, transparent 75%, rgba(201, 168, 106, 0.06) 75%, rgba(201, 168, 106, 0.06));
          background-size: 24px 24px, 48px 48px, 48px 48px;
        }

        .gold-gradient-btn {
          background: linear-gradient(180deg, #F9E7B9 0%, #E8CA82 45%, #C9A86A 100%);
          border: 1px solid #D8BC7D;
          box-shadow: 0 4px 12px rgba(201, 168, 106, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.8);
        }

        .emerald-gradient-btn {
          background: linear-gradient(180deg, #0F4D3A 0%, #0A3D2E 100%);
          border: 1px solid #C9A86A;
          box-shadow: 0 4px 14px rgba(10, 61, 46, 0.4), inset 0 1px 1px rgba(201, 168, 106, 0.3);
        }

        .velvet-badge {
          background: linear-gradient(180deg, #8E2323 0%, #6E1818 100%);
          border: 1px solid rgba(201, 168, 106, 0.5);
          box-shadow: 0 2px 6px rgba(110, 24, 24, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* الحاوية الأساسية المضبوطة لمظهر الموبايل الفاخر */}
      <div className="max-w-[430px] mx-auto min-h-screen bg-[#FFF8F0] shadow-[0_0_80px_rgba(10,61,46,0.18)] border-x border-[#C9A86A]/30 relative flex flex-col">
        
        {/* 1. شريط حالة الموبايل الأنيق (Status Bar) */}
        <div className="h-[36px] bg-[#0A3D2E] text-white/90 flex items-center justify-between px-5 text-[12px] font-semibold tracking-wide border-b border-[#C9A86A]/20">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold">2:38</span>
            <span className="text-[11px] opacity-80">⏰</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] bg-[#C9A86A]/20 text-[#E8D5A8] px-1.5 py-0.5 rounded font-mono">4G</span>
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-1 h-1.5 bg-[#C9A86A] rounded-xs"></span>
              <span className="w-1 h-2 bg-[#C9A86A] rounded-xs"></span>
              <span className="w-1 h-2.5 bg-[#C9A86A] rounded-xs"></span>
              <span className="w-1 h-3 bg-[#C9A86A] rounded-xs"></span>
            </div>
            <div className="w-5 h-2.5 border border-[#C9A86A] rounded-xs p-0.5 flex items-center">
              <div className="w-3.5 h-full bg-[#C9A86A] rounded-2xs"></div>
            </div>
          </div>
        </div>

        {/* 2. الهيدر الملكي الفاخر بزخارف الدمقس وإكليل الغار الذهبي */}
        <div className="relative damask-bg px-4 pt-3 pb-6 overflow-hidden border-b-2 border-[#C9A86A]">
          {/* زخارف أطراف إسلامية ذهبية لامعة */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#C9A86A] via-[#FFF0D0] to-[#C9A86A] opacity-80" />

          <div className="relative z-10 flex items-center justify-between mt-1">
            {/* زر تفاصيل الأرباح */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsProfitModalOpen(true)}
              className="h-9 px-4 rounded-full bg-gradient-to-b from-[#F0D9A0] to-[#C9A86A] text-[#0A3D2E] text-[13px] font-extrabold flex items-center gap-1.5 border border-[#FFF0D0] shadow-[0_3px_10px_rgba(201,168,106,0.35)] hover:brightness-105 transition"
            >
              <span>تفاصيل</span>
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            </motion.button>

            {/* العنوان المركزي: أرباح اليوم الصافية مع إكليل الغار ورقم 2 */}
            <div className="flex items-center gap-2.5">
              <div className="text-right">
                <h1 className="text-white text-[17px] font-black leading-tight drop-shadow-sm">
                  أرباح اليوم
                </h1>
                <p className="text-[#E8D5A8] text-[15px] font-extrabold leading-tight">
                  الصافية
                </p>
              </div>

              {/* دائرة إكليل الغار الذهبية الملكية */}
              <div className="relative flex items-center justify-center">
                <svg
                  viewBox="0 0 100 100"
                  className="w-[64px] h-[64px] text-[#C9A86A] drop-shadow-[0_2px_8px_rgba(201,168,106,0.5)]"
                >
                  <g fill="currentColor">
                    <path d="M 24 75 C 15 55 18 30 38 18 C 36 24 38 32 44 38 C 32 35 27 50 32 68 Z" opacity="0.9" />
                    <path d="M 76 75 C 85 55 82 30 62 18 C 64 24 62 32 56 38 C 68 35 73 50 68 68 Z" opacity="0.9" />
                    <ellipse cx="20" cy="45" rx="6" ry="3" transform="rotate(-30 20 45)" fill="#F5D77F" />
                    <ellipse cx="24" cy="32" rx="6" ry="3" transform="rotate(-45 24 32)" fill="#C9A86A" />
                    <ellipse cx="33" cy="22" rx="5" ry="2.5" transform="rotate(-60 33 22)" fill="#F5D77F" />
                    <ellipse cx="80" cy="45" rx="6" ry="3" transform="rotate(30 80 45)" fill="#F5D77F" />
                    <ellipse cx="76" cy="32" rx="6" ry="3" transform="rotate(45 76 32)" fill="#C9A86A" />
                    <ellipse cx="67" cy="22" rx="5" ry="2.5" transform="rotate(60 67 22)" fill="#F5D77F" />
                    <circle cx="50" cy="80" r="4" fill="#F5D77F" />
                  </g>
                </svg>

                {/* الرقم 2 الذهبي البارز في قلب الإكليل */}
                <span className="absolute text-[32px] font-black royal-gold-text drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] select-none">
                  2
                </span>
              </div>
            </div>

            {/* زر القائمة الدائري الذهبي الأيمن */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => showToast("القائمة الملكية")}
              className="w-10 h-10 rounded-full bg-gradient-to-b from-[#F9E7B9] to-[#C9A86A] flex items-center justify-center border border-[#FFF0D0] shadow-[0_3px_10px_rgba(201,168,106,0.4)] hover:brightness-105 transition"
            >
              <div className="flex flex-col gap-1 items-center justify-center">
                <span className="w-4 h-[2.5px] bg-[#0A3D2E] rounded-full"></span>
                <span className="w-4 h-[2.5px] bg-[#0A3D2E] rounded-full"></span>
                <span className="w-4 h-[2.5px] bg-[#0A3D2E] rounded-full"></span>
              </div>
            </motion.button>
          </div>
        </div>

        {/* 3. جسم الصفحة الرئيسي */}
        <div className="flex-1 px-3.5 pt-4 pb-12 space-y-3.5">
          
          {/* زرين الإجراءات العلوية الكبيرة (Pill Buttons) */}
          <div className="grid grid-cols-2 gap-3">
            {/* زر إضافة طلب من الإدارة */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsAddModalOpen(true)}
              className="gold-gradient-btn h-[48px] rounded-full px-3 text-[#0A3D2E] font-black text-[13.5px] flex items-center justify-center gap-1.5 transition"
            >
              <span>إضافة طلب من الإدارة</span>
              <span className="text-[16px] text-[#0A3D2E]">⚜️</span>
            </motion.button>

            {/* زر الطلبات الجديدة */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setActiveFilter("جديد");
                showToast("تم تحديد عرض الطلبات الجديدة ✨");
              }}
              className="emerald-gradient-btn h-[48px] rounded-full px-3 text-white font-black text-[14px] flex items-center justify-center gap-1.5 transition"
            >
              <Sparkles className="w-4 h-4 text-[#F5D77F] animate-pulse" />
              <span>الطلبات الجديدة</span>
            </motion.button>
          </div>

          {/* فلاتر الحالات (Filter Chips) */}
          <div className="flex gap-2 overflow-x-auto pb-1.5 pt-1 -mx-1 px-1 scrollbar-none">
            {[
              { label: "الكل", count: counts.all, key: "الكل" },
              { label: "جديد", count: counts.new, key: "جديد", badgeGold: true },
              { label: "مسند", count: counts.assigned, key: "مسند" },
              { label: "مسلّم", count: counts.delivered, key: "مسلّم" },
              { label: "فحص", count: counts.inspection, key: "فحص" },
            ].map((chip) => {
              const isSelected = activeFilter === chip.key;
              return (
                <motion.button
                  key={chip.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveFilter(chip.key)}
                  className={`shrink-0 h-[38px] px-4 rounded-full text-[13px] font-extrabold border transition-all flex items-center gap-1.5 shadow-xs ${
                    isSelected
                      ? "bg-[#0A3D2E] text-white border-[#C9A86A] gold-border-glow"
                      : "bg-white text-[#0A3D2E] border-[#C9A86A]/70 hover:border-[#C9A86A] hover:bg-[#FFF8F0]"
                  }`}
                >
                  <span>{chip.label}</span>
                  {chip.count !== undefined && chip.count > 0 && (
                    <span
                      className={`min-w-[20px] h-[20px] rounded-full text-[11px] font-black flex items-center justify-center px-1 ${
                        isSelected
                          ? "bg-gradient-to-b from-[#F5D77F] to-[#C9A86A] text-[#0A3D2E]"
                          : chip.badgeGold
                          ? "bg-[#C9A86A] text-white"
                          : "bg-[#0A3D2E]/10 text-[#0A3D2E]"
                      }`}
                    >
                      {chip.count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* شريط البحث البيضاوي الفاخر */}
          <div className="relative">
            <div className="h-[46px] rounded-full bg-white border-[1.5px] border-[#C9A86A] flex items-center px-4 gap-2 shadow-[0_2px_12px_rgba(201,168,106,0.18)] focus-within:shadow-[0_4px_18px_rgba(201,168,106,0.35)] transition-all">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="...بحث"
                className="flex-1 bg-transparent outline-none text-[14px] font-bold text-[#0A3D2E] placeholder:text-[#0A3D2E]/40"
              />
              <Search className="w-5 h-5 text-[#C9A86A] shrink-0 stroke-[2.5]" />
            </div>
          </div>

          {/* شريط أدوات العرض (تحديد سريع، 1 البطاقات، الجدول) */}
          <div className="flex items-center justify-between gap-2 relative">
            {/* زر تحديد سريع */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setQuickSelectMode(!quickSelectMode);
                showToast(
                  !quickSelectMode
                    ? "تم تفعيل وضع التحديد السريع ⚡"
                    : "تم إلغاء التحديد السريع"
                );
              }}
              className={`flex-1 h-[40px] px-3 rounded-full text-[13px] font-black flex items-center justify-center gap-1.5 border transition shadow-xs ${
                quickSelectMode
                  ? "bg-[#0A3D2E] text-[#F5D77F] border-[#C9A86A]"
                  : "bg-white text-[#0A3D2E] border-[#C9A86A]/70 hover:border-[#C9A86A]"
              }`}
            >
              <Zap className="w-4 h-4 text-[#C9A86A] fill-[#C9A86A]" />
              <span>تحديد سريع</span>
            </motion.button>

            {/* زر نمط البطاقات مع قائمة لاختيار 1 أو 2 أو 3 */}
            <div className="relative flex-1">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setViewMode("cards");
                  setShowCardsMenu(!showCardsMenu);
                }}
                className={`w-full h-[40px] px-3 rounded-full text-[13px] font-black flex items-center justify-center gap-1 border transition shadow-xs ${
                  viewMode === "cards"
                    ? "bg-white text-[#0A3D2E] border-[#C9A86A] gold-border-glow"
                    : "bg-white text-[#0A3D2E] border-[#C9A86A]/70"
                }`}
              >
                <Smartphone className="w-4 h-4 text-[#C9A86A]" />
                <span>{cardsCols} البطاقات</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#C9A86A] stroke-[3]" />
              </motion.button>

              {/* القائمة المنسدلة لخيارات البطاقات */}
              <AnimatePresence>
                {showCardsMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-11 right-0 left-0 bg-white border-2 border-[#C9A86A] rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-1"
                  >
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          setCardsCols(num);
                          setShowCardsMenu(false);
                          showToast(`تم ضبط العرض إلى ${num} بطاقة`);
                        }}
                        className={`py-2 px-3 rounded-xl text-[12px] font-extrabold flex items-center justify-between ${
                          cardsCols === num
                            ? "bg-[#0A3D2E] text-[#F5D77F]"
                            : "hover:bg-[#FFF8F0] text-[#0A3D2E]"
                        }`}
                      >
                        <span>{num} بطاقات</span>
                        {cardsCols === num && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* زر الجدول */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setViewMode(viewMode === "table" ? "cards" : "table");
                showToast(
                  viewMode === "table" ? "تم التحويل لعرض البطاقات" : "تم التحويل لعرض الجدول"
                );
              }}
              className={`flex-1 h-[40px] px-3 rounded-full text-[13px] font-black flex items-center justify-center gap-1.5 border transition shadow-xs ${
                viewMode === "table"
                  ? "bg-[#0A3D2E] text-white border-[#C9A86A]"
                  : "bg-white text-[#0A3D2E] border-[#C9A86A]/70 hover:border-[#C9A86A]"
              }`}
            >
              <FileText className="w-4 h-4 text-[#C9A86A]" />
              <span>الجدول</span>
            </motion.button>
          </div>

          {/* شريط التاريخ والملخص الإحصائي الزخرفي (Ornate Emerald Date Banner) */}
          <div className="relative my-4">
            <div className="damask-bg rounded-[14px] border-y-2 border-[#C9A86A] py-2.5 px-4 flex items-center justify-between text-[#FFF8F0] shadow-md relative overflow-hidden">
              <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A86A] to-transparent" />
              <div className="absolute inset-x-4 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A86A] to-transparent" />

              {/* أيقونة الروزنامة / التاريخ في اليمين */}
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-b from-[#F5D77F] to-[#C9A86A] text-[#0A3D2E] flex flex-col items-center justify-center leading-none shadow-xs border border-[#FFF0D0]">
                  <span className="text-[8px] font-black">SEP</span>
                  <span className="text-[14px] font-black -mt-0.5">17</span>
                </div>
              </div>

              {/* نص التاريخ وإجمالي الطلبات */}
              <div className="flex items-center gap-2 text-[14px] font-black">
                <span>الجمعة، 11 أيلول 2026</span>
                <span className="text-[#C9A86A]">طلب 202 طلب</span>
              </div>

              {/* أيقونة شارة ملكية صغيرة في اليسار */}
              <div className="w-7 h-7 rounded-full bg-[#C9A86A]/20 border border-[#C9A86A]/50 flex items-center justify-center text-[#F5D77F]">
                ⚜️
              </div>
            </div>
          </div>

          {/* 4. قسم بطاقات الطلبات الفاخرة (Cards Section) */}
          {viewMode === "cards" ? (
            <div className={`space-y-4 ${cardsCols > 1 ? `grid grid-cols-${cardsCols} gap-3 space-y-0` : ""}`}>
              <AnimatePresence>
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-[#C9A86A]/40 p-6">
                    <p className="text-[#0A3D2E] font-bold text-[15px]">
                      لا توجد طلبات مطابقة للبحث أو التصفية الحالية
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setActiveFilter("الكل");
                      }}
                      className="mt-3 px-4 py-1.5 rounded-full bg-[#0A3D2E] text-[#F5D77F] text-[12px] font-bold"
                    >
                      إعادة ضبط الفلاتر
                    </button>
                  </div>
                ) : (
                  filteredOrders.map((order) => {
                    const isSelected = selectedOrderIds.includes(order.id);
                    return (
                      <motion.div
                        key={order.id}
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative"
                      >
                        {/* إطار البطاقة الملكي ذو الزوايا المنحوتة والإطار المزدوج */}
                        <div
                          className={`rounded-[22px] p-[2px] bg-gradient-to-b from-[#C9A86A] via-[#E8D5A8] to-[#C9A86A] gold-card-shadow transition-all ${
                            isSelected ? "ring-3 ring-[#0A3D2E]" : ""
                          }`}
                        >
                          <div className="rounded-[20px] bg-white p-4 relative overflow-hidden">
                            
                            {/* زخارف الزوايا الأربع المنحوتة */}
                            <span className="pointer-events-none absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#C9A86A] rounded-tr-md opacity-80" />
                            <span className="pointer-events-none absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#C9A86A] rounded-tl-md opacity-80" />
                            <span className="pointer-events-none absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#C9A86A] rounded-br-md opacity-80" />
                            <span className="pointer-events-none absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#C9A86A] rounded-bl-md opacity-80" />

                            {/* زر التحديد السريع إن كان مفعل */}
                            {quickSelectMode && (
                              <div className="mb-2 flex justify-end">
                                <button
                                  onClick={() => toggleSelectOrder(order.id)}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition ${
                                    isSelected
                                      ? "bg-[#0A3D2E] border-[#C9A86A] text-white"
                                      : "border-[#C9A86A] bg-white"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}

                            {/* السطر العلوي في البطاقة (رقم الطلب + شارة الوجهة المخملية + شارة إسناد للمندوب) */}
                            <div className="flex items-center justify-between gap-1.5 mb-3">
                              {/* شارة إسناد للمندوب في اليمين */}
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  handleStatusChange(order.id, "assigned", "تم الإسناد للمندوب 🚚")
                                }
                                className="px-3 py-1 rounded-full bg-[#0A3D2E] text-white text-[12px] font-black flex items-center gap-1.5 border border-[#C9A86A]/50 shadow-xs hover:brightness-110 transition shrink-0"
                              >
                                <Truck className="w-3.5 h-3.5 text-[#F5D77F]" />
                                <span>{order.mandobBadge}</span>
                              </motion.button>

                              {/* شارة الوجهة المخملية العنابية في الوسط */}
                              <div className="velvet-badge px-3 py-1 rounded-full text-white text-[11.5px] font-black text-center truncate max-w-[190px]">
                                {order.destinationBadge}
                              </div>

                              {/* رقم الطلب بخط عريض أقصى اليسار */}
                              <div className="text-[20px] font-black text-[#0A3D2E] tracking-tight shrink-0 font-mono">
                                #{order.orderNumber}
                              </div>
                            </div>

                            {/* وسط البطاقة: الدائرة الزمردية المركزية الضخمة والنصوص يميناً ويساراً */}
                            <div className="flex items-center justify-between py-2 px-1">
                              {/* النص الأيمن (مثال: توصيل فقط / معجنات كبه) */}
                              <div className="text-[14px] font-extrabold text-[#0A3D2E] text-center w-[90px] leading-snug">
                                {order.rightText}
                              </div>

                              {/* الدائرة الزمردية الملكية الضخمة برقم السعر الذهبي البارز */}
                              <div className="relative">
                                <div className="w-[76px] h-[76px] rounded-full bg-gradient-to-b from-[#0F4D3A] to-[#0A3D2E] border-[3.5px] border-[#C9A86A] flex items-center justify-center shadow-[0_4px_16px_rgba(10,61,46,0.35)] relative">
                                  <div className="absolute inset-1 rounded-full border border-[#FFF0D0]/20 pointer-events-none" />
                                  <span className="text-[32px] font-black royal-gold-text select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                    {order.priceCircle}
                                  </span>
                                </div>
                                <span className="absolute -top-1 -right-1 text-[11px] text-[#C9A86A] drop-shadow-xs">✦</span>
                                <span className="absolute -bottom-1 -left-1 text-[11px] text-[#C9A86A] drop-shadow-xs">✦</span>
                              </div>

                              {/* النص الأيسر الأحمر العنابي (مثال: توصيل فقط - غدا / غدا 11 صباحا) */}
                              <div className="text-[13px] font-black text-[#7A1F1F] text-center w-[90px] leading-snug">
                                {order.leftText}
                              </div>
                            </div>

                            {/* شريط رقم الهاتف العاجي الفاخر */}
                            <div className="flex items-center justify-between mt-2.5 mb-3 bg-[#FFF8F0] rounded-full px-3.5 h-[42px] border border-[#C9A86A]/40 shadow-2xs">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#F5D77F] to-[#C9A86A] flex items-center justify-center shadow-xs">
                                  <Phone className="w-3.5 h-3.5 text-[#0A3D2E] stroke-[2.5]" />
                                </div>
                                <span className="font-extrabold text-[#0A3D2E] text-[14.5px] tracking-wide font-mono">
                                  {order.phone}
                                </span>
                              </div>

                              {/* زر الحذف أو الرفض الدائري البرتقالي X بجانب الهاتف */}
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDeleteOrder(order.id)}
                                title="رفض أو حذف الطلب"
                                className="w-7 h-7 rounded-full bg-gradient-to-b from-[#F5A623] to-[#D97706] text-white flex items-center justify-center border border-[#FFF0D0] shadow-xs hover:brightness-110 transition"
                              >
                                <X className="w-4 h-4 stroke-[3]" />
                              </motion.button>
                            </div>

                            {/* أزرار الإجراءات السفلية داخل البطاقة */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {/* زر استلام ⚡ (أخضر زمردي مع برق ذهبي) */}
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  handleStatusChange(order.id, "delivered", "تم استلام الطلب ⚡")
                                }
                                className="h-[38px] px-4 rounded-full bg-[#0A3D2E] text-white text-[13px] font-black flex items-center gap-1.5 border border-[#C9A86A] shadow-xs hover:brightness-110 transition"
                              >
                                <Zap className="w-3.5 h-3.5 text-[#F5D77F] fill-[#F5D77F]" />
                                <span>استلام</span>
                              </motion.button>

                              {/* زر كيس النقود 💰 */}
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => showToast(`المبلغ المستحق للطلب #${order.id}: ${order.priceCircle},000 د.ع`)}
                                className="w-[38px] h-[38px] rounded-full bg-gradient-to-b from-[#F9E7B9] to-[#C9A86A] text-[#0A3D2E] flex items-center justify-center border border-[#FFF0D0] shadow-xs hover:scale-105 transition"
                              >
                                <span className="text-[16px]">💰</span>
                              </motion.button>

                              {/* زر القلم للتعديل ✏️ */}
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => showToast(`تعديل الطلب #${order.id}`)}
                                className="w-[38px] h-[38px] rounded-full bg-gradient-to-b from-[#F9E7B9] to-[#C9A86A] text-[#0A3D2E] flex items-center justify-center border border-[#FFF0D0] shadow-xs hover:scale-105 transition"
                              >
                                <Edit3 className="w-4 h-4 text-[#0A3D2E] stroke-[2.5]" />
                              </motion.button>

                              {/* زر وجهتين ➔ */}
                              {order.hasTwoDestinations && (
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => showToast("طلب متعدد الوجهات")}
                                  className="h-[38px] px-3.5 rounded-full bg-[#0A3D2E] text-white text-[12px] font-black flex items-center gap-1 border border-[#C9A86A]/40 shadow-xs hover:brightness-110 transition"
                                >
                                  <span>وجهتين</span>
                                  <span className="text-[14px]">➔</span>
                                </motion.button>
                              )}

                              {/* زر بدون لوكيشن 📍 */}
                              {order.hasNoLocation && (
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => showToast("الطلب مسجل بدون تحديد موقع جغرافي")}
                                  className="h-[38px] px-3 rounded-full velvet-badge text-white text-[12px] font-black flex items-center gap-1 transition"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-[#F5D77F]" />
                                  <span>بدون لوكيشن</span>
                                </motion.button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* عرض الجدول الملكي المنسق */
            <div className="bg-white rounded-2xl border-2 border-[#C9A86A] overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[13px]">
                  <thead className="bg-[#0A3D2E] text-[#F5D77F] font-black">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">الوجهة والمحل</th>
                      <th className="p-3">السعر</th>
                      <th className="p-3">الهاتف</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C9A86A]/20">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-[#FFF8F0] font-bold">
                        <td className="p-3 text-[#0A3D2E] font-mono">#{o.orderNumber}</td>
                        <td className="p-3">{o.destinationBadge}</td>
                        <td className="p-3 text-[#0A3D2E] font-black font-mono">{o.priceCircle}K</td>
                        <td className="p-3 font-mono" dir="ltr">{o.phone}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded-full bg-[#0A3D2E] text-white text-[11px]">
                            {o.status === "new" ? "جديد" : o.status === "assigned" ? "مسند" : "مكتمل"}
                          </span>
                        </td>
                        <td className="p-3 flex items-center gap-1">
                          <button
                            onClick={() => handleStatusChange(o.id, "delivered", "تم الاستلام")}
                            className="p-1.5 rounded-lg bg-[#0A3D2E] text-[#F5D77F]"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(o.id)}
                            className="p-1.5 rounded-lg bg-red-600 text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. عداد الطلبات في أسفل الصفحة */}
          <div className="pt-6 pb-4 text-center">
            <p className="text-[#0A3D2E] font-black text-[15px] tracking-wide">
              عدد الطلبات في هذه الصفحة:{" "}
              <span className="text-[#0A3D2E] font-black font-mono text-[17px]">
                {filteredOrders.length}
              </span>
            </p>
            <div className="mt-3 mx-auto w-32 h-[1.5px] bg-gradient-to-r from-transparent via-[#C9A86A] to-transparent" />
          </div>
        </div>

        {/* 6. شريط الملاحة السفلي للهاتف (Bottom Navigation) */}
        <div className="h-[60px] bg-white/95 backdrop-blur-md border-t-2 border-[#C9A86A]/40 flex items-center justify-around px-8 shadow-lg mt-auto">
          <button
            onClick={() => showToast("الواجهة الرئيسية")}
            className="w-10 h-10 rounded-xl border-2 border-[#C9A86A] flex items-center justify-center text-[#C9A86A] hover:bg-[#FFF8F0] transition shadow-xs"
          >
            <span className="w-3.5 h-3.5 border-2 border-current rounded-xs block"></span>
          </button>
          
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveFilter("الكل");
              showToast("تحديث الصفحة");
            }}
            className="w-11 h-11 rounded-full border-2 border-[#C9A86A] flex items-center justify-center text-[#0A3D2E] bg-[#FFF8F0] shadow-[0_2px_8px_rgba(201,168,106,0.3)] hover:scale-105 transition"
          >
            <span className="w-4 h-4 border-2 border-current rounded-full block"></span>
          </button>

          <button
            onClick={() => showToast("رجوع")}
            className="w-10 h-10 rounded-xl border-2 border-[#C9A86A]/70 flex items-center justify-center text-[#C9A86A] hover:bg-[#FFF8F0] transition shadow-xs"
          >
            <span className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-current block transform rotate-90"></span>
          </button>
        </div>
      </div>

      {/* نافذة مودال: إضافة طلب من الإدارة */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl border-2 border-[#C9A86A] overflow-hidden shadow-2xl"
            >
              <div className="damask-bg p-4 border-b-2 border-[#C9A86A] flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <span className="text-[20px]">⚜️</span>
                  <h2 className="text-[17px] font-black text-[#FFF0D0]">
                    إضافة طلب جديد من الإدارة
                  </h2>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                >
                  <X className="w-4 h-4 text-[#FFF0D0]" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="p-5 space-y-4">
                <div>
                  <label className="block text-[13px] font-black text-[#0A3D2E] mb-1">
                    اسم المتجر / المحل *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مطبخ البركات"
                    value={newOrder.shopName}
                    onChange={(e) => setNewOrder({ ...newOrder, shopName: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-[#C9A86A] bg-[#FFF8F0] font-bold text-[#0A3D2E] outline-none focus:ring-2 focus:ring-[#C9A86A]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-black text-[#0A3D2E] mb-1">
                    المنطقة / الوجهة
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: محيلة السوق"
                    value={newOrder.region}
                    onChange={(e) => setNewOrder({ ...newOrder, region: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-[#C9A86A] bg-[#FFF8F0] font-bold text-[#0A3D2E] outline-none focus:ring-2 focus:ring-[#C9A86A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-black text-[#0A3D2E] mb-1">
                      المبلغ (آلاف) *
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="25"
                      value={newOrder.price}
                      onChange={(e) => setNewOrder({ ...newOrder, price: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-[#C9A86A] bg-[#FFF8F0] font-black text-[#0A3D2E] outline-none focus:ring-2 focus:ring-[#C9A86A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-black text-[#0A3D2E] mb-1">
                      رقم هاتف الزبون *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="078XXXXXXXX"
                      value={newOrder.phone}
                      onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-[#C9A86A] bg-[#FFF8F0] font-bold text-[#0A3D2E] outline-none focus:ring-2 focus:ring-[#C9A86A]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 h-12 rounded-full gold-gradient-btn text-[#0A3D2E] font-black text-[14px] flex items-center justify-center gap-1.5"
                  >
                    <span>حفظ الطلب الفاخر</span>
                    <span>✨</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 h-12 rounded-full bg-gray-100 text-gray-700 font-bold text-[13px]"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* نافذة مودال: تفاصيل الأرباح الصافية */}
      <AnimatePresence>
        {isProfitModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl border-2 border-[#C9A86A] overflow-hidden shadow-2xl text-center"
            >
              <div className="damask-bg p-6 border-b-2 border-[#C9A86A] text-white">
                <span className="text-[32px] block mb-1">👑</span>
                <h3 className="text-[18px] font-black text-[#FFF0D0]">
                  تفاصيل أرباح اليوم الصافية
                </h3>
                <div className="mt-3 text-[38px] font-black royal-gold-text">
                  49,000 د.ع
                </div>
                <p className="text-[12px] text-[#E8D5A8] mt-1 font-bold">
                  إجمالي 2 طلبات منجزة لليوم
                </p>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-[#C9A86A]/20 text-[13px] font-bold">
                  <span>طلب #2426 (الاسمدة)</span>
                  <span className="font-mono font-black text-[#0A3D2E]">20,000 د.ع</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#C9A86A]/20 text-[13px] font-bold">
                  <span>طلب #2419 (مطبخ البركات)</span>
                  <span className="font-mono font-black text-[#0A3D2E]">29,000 د.ع</span>
                </div>
                <button
                  onClick={() => setIsProfitModalOpen(false)}
                  className="w-full h-11 mt-3 rounded-full bg-[#0A3D2E] text-[#F5D77F] font-black text-[13px]"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* رسالة إشعار Toast ملكية عائمة */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0A3D2E] text-white px-5 py-3 rounded-full border-2 border-[#C9A86A] shadow-2xl flex items-center gap-2 text-[13px] font-black"
          >
            <Sparkles className="w-4 h-4 text-[#F5D77F]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
