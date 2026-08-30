"use client";

import React, { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  PartnerWithBalance, 
  PartnerType, 
  createPartner, 
  syncSystemPartners, 
  getPartners,
  deletePartnersBatch,
  getUnaddedSystemPartners,
  syncOldCustomerDebts,
  getTransactionLogs,
  restoreDeletedTransaction,
  revertModifiedTransaction,
  clearTransactionLogs,
  getAccountants,
  createAccountantLink,
  revokeAccountantAccess
} from "./actions";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

// أنواع التسميات باللغة العربية مع الأيقونات
const typeLabels: Record<PartnerType, { label: string; icon: string }> = {
  courier: { label: "مندوب", icon: "🚚" },
  preparer: { label: "مجهز", icon: "📦" },
  shop: { label: "محل", icon: "🏪" },
  customer: { label: "زبون", icon: "👤" },
  external: { label: "طرف خارجي", icon: "🌐" },
  supplier: { label: "مورد", icon: "🏭" },
};

const typeBadgeStyles: Record<PartnerType, string> = {
  courier: "bg-blue-50 text-blue-700 border-blue-200/80 hover:bg-blue-100/70",
  preparer: "bg-purple-50 text-purple-700 border-purple-200/80 hover:bg-purple-100/70",
  shop: "bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70",
  customer: "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70",
  external: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70",
  supplier: "bg-pink-50 text-pink-700 border-pink-200/80 hover:bg-pink-100/70",
};

interface CreditBookClientProps {
  initialPartners: PartnerWithBalance[];
  isAccountant?: boolean;
}

export function CreditBookClient({ initialPartners, isAccountant = false }: CreditBookClientProps) {
  const router = useRouter();
  const [allPartners, setAllPartners] = useState<PartnerWithBalance[]>(initialPartners);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [balanceFilter, setBalanceFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"blocks" | "table">("blocks");
  const [isPending, startTransition] = useTransition();

  // نموذج إضافة شريك جديد
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerPhone, setNewPartnerPhone] = useState("");
  const [newPartnerType, setNewPartnerType] = useState<PartnerType>("external");
  const [unaddedSystemPartners, setUnaddedSystemPartners] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [systemPartnerSearch, setSystemPartnerSearch] = useState("");
  const [selectedSystemPartnerId, setSelectedSystemPartnerId] = useState("");
  const [isLoadingUnadded, setIsLoadingUnadded] = useState(false);
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  const loadUnaddedPartners = async (type: PartnerType) => {
    setSystemPartnerSearch("");
    if (type === "external") {
      setUnaddedSystemPartners([]);
      setSelectedSystemPartnerId("");
      return;
    }
    setIsLoadingUnadded(true);
    const list = await getUnaddedSystemPartners(type);
    setUnaddedSystemPartners(list);
    setIsLoadingUnadded(false);
    setSelectedSystemPartnerId("");
  };

  // حالة التحديد الجماعي
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // حساب الأرقام الكلية للنوع المحدد مستقراً أثناء البحث بالاسم
  const typeFilteredPartnersForTotals = useMemo(() => {
    return allPartners.filter(p => selectedType === "all" || p.type === selectedType);
  }, [allPartners, selectedType]);

  const totalWeOwed = useMemo(() => {
    return typeFilteredPartnersForTotals
      .filter((p) => p.balance > 0)
      .reduce((sum, p) => sum + p.balance, 0);
  }, [typeFilteredPartnersForTotals]);

  const totalWeOwe = useMemo(() => {
    return typeFilteredPartnersForTotals
      .filter((p) => p.balance < 0)
      .reduce((sum, p) => sum + Math.abs(p.balance), 0);
  }, [typeFilteredPartnersForTotals]);

  const netBalance = totalWeOwed - totalWeOwe;

  // إحصائيات سريعة للعدد
  const countStats = useMemo(() => {
    let oweUsCount = 0;
    let weOweCount = 0;
    let zeroCount = 0;
    typeFilteredPartnersForTotals.forEach(p => {
      if (p.balance > 0) oweUsCount++;
      else if (p.balance < 0) weOweCount++;
      else zeroCount++;
    });
    return {
      total: typeFilteredPartnersForTotals.length,
      oweUsCount,
      weOweCount,
      zeroCount
    };
  }, [typeFilteredPartnersForTotals]);

  // التصفية والبحث الفوري والذكي محلياً
  const filteredPartners = useMemo(() => {
    return allPartners.filter((p) => {
      // 1. فحص النوع
      if (selectedType !== "all" && p.type !== selectedType) return false;

      // 2. فحص رصيد الدفتر
      if (balanceFilter === "all" && p.balance === 0) return false;
      if (balanceFilter === "owe_us" && p.balance <= 0) return false;
      if (balanceFilter === "we_owe" && p.balance >= 0) return false;
      if (balanceFilter === "zero" && p.balance !== 0) return false;

      // 3. فحص مصطلح البحث (fuzzy match on name or phone or balance)
      if (!searchQuery.trim()) return true;

      const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return true;

      const nameStr = (p.name || "").toLowerCase();
      const phoneStr = (p.phone || "").toLowerCase();
      const typeStr = (typeLabels[p.type]?.label || p.type || "").toLowerCase();
      const balanceStr = String(Math.abs(p.balance || 0));
      const balanceAlfStr = String(Math.abs(p.balance || 0) / 1000);

      return tokens.every((token) => {
        if (nameStr.includes(token)) return true;
        if (phoneStr.includes(token)) return true;
        if (typeStr.includes(token)) return true;
        if (balanceStr.includes(token)) return true;
        if (balanceAlfStr.includes(token)) return true;

        // التقارب اللفظي وترتيب الحروف بالاسم
        let charIdx = 0;
        for (let i = 0; i < nameStr.length; i++) {
          if (nameStr[i] === token[charIdx]) {
            charIdx++;
            if (charIdx === token.length) return true;
          }
        }
        return false;
      });
    });
  }, [allPartners, searchQuery, selectedType, balanceFilter]);

  // تحديث القائمة بعد العمليات
  const refreshList = async () => {
    const fresh = await getPartners();
    setAllPartners(fresh);
    setSelectedPartnerIds([]); // تصفير التحديد
  };

  // نسخ رقم الهاتف
  const handleCopyPhone = (e: React.MouseEvent, partnerId: string, phone: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(partnerId);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  // معالجة البحث والفرز فورياً ومحلياً
  const handleSearchAndFilter = (query: string, type: string) => {
    setSearchQuery(query);
    setSelectedType(type);
  };

  // إضافة شريك جديد
  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) {
      setAddError("الرجاء إدخال الاسم");
      return;
    }
    setIsAdding(true);
    setAddError("");
    const res = await createPartner(
      newPartnerName,
      newPartnerPhone || null,
      newPartnerType,
      selectedSystemPartnerId || undefined
    );
    setIsAdding(false);
    if (res.success) {
      setNewPartnerName("");
      setNewPartnerPhone("");
      setNewPartnerType("external");
      setSelectedSystemPartnerId("");
      setUnaddedSystemPartners([]);
      setShowAddModal(false);
      refreshList();
    } else {
      setAddError(res.error || "حدث خطأ ما");
    }
  };

  // مزامنة الأطراف من النظام تلقائياً
  const handleSync = () => {
    if (!confirm("هل تريد استيراد ومزامنة المناديب والمجهزين والمحلات والزبائن من قاعدة البيانات كأطراف ديون؟")) {
      return;
    }
    startTransition(async () => {
      const res = await syncSystemPartners();
      if (res.success) {
        alert(`تمت المزامنة بنجاح! تم استيراد ${res.importedCount} أطراف جديدة.`);
        refreshList();
      } else {
        alert(res.error || "فشلت المزامنة");
      }
    });
  };

  // مزامنة ديون الزبائن التاريخية بأثر رجعي
  const handleSyncOldDebts = () => {
    if (!confirm("هل تريد فحص كافة الطلبيات القديمة المسلمة وتوليد الديون الناقصة للزبائن تلقائياً بأثر رجعي؟ قد تستغرق هذه العملية عدة ثوانٍ.")) {
      return;
    }
    startTransition(async () => {
      const res = await syncOldCustomerDebts();
      if (res.success) {
        alert(`اكتملت المزامنة التاريخية بنجاح!\n---------------------------------\nعدد الطلبات المفحوصة: ${res.checkedCount}\nحسابات الزبائن الجديدة: ${res.createdPartnersCount}\nحركات الديون الجديدة: ${res.createdTransactionsCount}\nملاحظات الديون القديمة المحدثة: ${res.updatedTxsCount || 0}\nإجمالي الديون المسجلة: ${res.totalDebtAmount?.toLocaleString() || 0} د.ع`);
        refreshList();
      } else {
        alert(res.error || "فشلت المزامنة التاريخية للزبائن");
      }
    });
  };

  // التحديد الجماعي
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPartnerIds(filteredPartners.map(p => p.id));
    } else {
      setSelectedPartnerIds([]);
    }
  };

  const handleSelectPartner = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedPartnerIds(prev => [...prev, id]);
    } else {
      setSelectedPartnerIds(prev => prev.filter(pId => pId !== id));
    }
  };

  // حذف الأطراف المحددة دفعة واحدة
  const handleDeleteSelected = async () => {
    if (selectedPartnerIds.length === 0) return;
    
    if (!confirm(`هل أنت متأكد من رغبتك في حذف ${selectedPartnerIds.length} من الأطراف المحددة بالكامل مع كافة سجلاتهم؟`)) {
      return;
    }

    setIsDeletingBatch(true);
    const res = await deletePartnersBatch(selectedPartnerIds);
    setIsDeletingBatch(false);

    if (res.success) {
      alert("تم حذف الأطراف المحددة بنجاح.");
      refreshList();
    } else {
      alert(res.error || "فشل مسح الأطراف المحددة");
    }
  };

  // تم نقل تسميات الأنواع وتنسيقات البطاقات كأعضاء عامة خارج المكون لتجنب تكرار التعريف

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. بطاقة الرصيد الكلي المدمجة والقصيرة والأنيقة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* صافي رصيد الدفتر */}
        <div className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 border transition-all shadow-sm flex flex-col justify-between ${
          netBalance >= 0 
            ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border-emerald-200/80" 
            : "bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-white border-rose-200/80"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-slate-600 flex items-center gap-1.5">
              <span>{netBalance >= 0 ? "🟢" : "🔴"}</span>
              صافي رصيد الدفتر العام
            </span>
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              netBalance >= 0 
                ? "bg-emerald-100/80 text-emerald-800 border-emerald-200" 
                : "bg-rose-100/80 text-rose-800 border-rose-200"
            }`}>
              {netBalance >= 0 ? "فائض لصالحك" : "عجز مطلوب منك"}
            </span>
          </div>

          <div className="my-2 text-right">
            <h2 className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
              netBalance >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}>
              {netBalance >= 0 ? "+" : ""}{formatDinarAsAlfWithUnit(netBalance)}
            </h2>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-1 border-t border-slate-100/80">
            <span>إجمالي الحسابات: {countStats.total}</span>
            <span>المصفّرة: {countStats.zeroCount}</span>
          </div>
        </div>

        {/* مطلوبات لنا (نطلبهم) */}
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 border border-emerald-100 bg-white shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              مطلوبات لنا (نطلبهم)
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              {countStats.oweUsCount} حساب
            </span>
          </div>

          <div className="my-2 text-right">
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 tabular-nums tracking-tight">
              +{formatDinarAsAlfWithUnit(totalWeOwed)}
            </h3>
          </div>

          <div className="text-[11px] font-bold text-slate-400 pt-1 border-t border-slate-50">
            ديون ومستحقات لصالحك بذمة الآخرين
          </div>
        </div>

        {/* مطلوب منا (يطلبوننا) */}
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 border border-rose-100 bg-white shadow-sm flex flex-col justify-between hover:border-rose-200 transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-rose-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              مطلوب منا (يطلبوننا)
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">
              {countStats.weOweCount} حساب
            </span>
          </div>

          <div className="my-2 text-right">
            <h3 className="text-2xl sm:text-3xl font-black text-rose-600 tabular-nums tracking-tight">
              -{formatDinarAsAlfWithUnit(totalWeOwe)}
            </h3>
          </div>

          <div className="text-[11px] font-bold text-slate-400 pt-1 border-t border-slate-50">
            مبالغ والتزامات مستحقة للآخرين بذمتك
          </div>
        </div>
      </div>

      {/* 2. شريط الخيارات والبحث والأزرار المنظم */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        {/* صف الفلاتر والبحث */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* حقل البحث */}
          <div className="relative lg:col-span-4">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              🔍
            </div>
            <input
              type="text"
              placeholder="ابحث بالاسم، الهاتف، أو المبلغ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* فلتر نوع الطرف */}
          <div className="lg:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">👥 جميع الأطراف والجهات</option>
              <option value="courier">🚚 المناديب فقط</option>
              <option value="preparer">📦 المجهزين فقط</option>
              <option value="shop">🏪 المحلات فقط</option>
              <option value="customer">👤 الزبائن فقط</option>
              <option value="supplier">🏭 الموردين فقط</option>
              <option value="external">🌐 أطراف خارجية</option>
            </select>
          </div>

          {/* فلتر حالة الرصيد */}
          <div className="lg:col-span-3">
            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">💳 الحسابات النشطة (غير المصفّرة)</option>
              <option value="owe_us">🟢 نطلبهم (ديون لصالحنا)</option>
              <option value="we_owe">🔴 يطلبوننا (ديون علينا)</option>
              <option value="zero">⚪ الحسابات المصفّرة (0 د.ع)</option>
            </select>
          </div>

          {/* زر التبديل بين البلوكات والجدول */}
          <div className="lg:col-span-2 flex items-center justify-end">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl w-full justify-center">
              <button
                type="button"
                onClick={() => setViewMode("blocks")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === "blocks"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="عرض البلوكات (كروت مريحة بدون سحب)"
              >
                <span>🔲</span>
                <span>بلوكات</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === "table"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="عرض الجدول"
              >
                <span>📋</span>
                <span>جدول</span>
              </button>
            </div>
          </div>
        </div>

        {/* صف الأزرار والعمليات المجمعة */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          {/* إجراءات التحديد والحذف الجماعي */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectAll(selectedPartnerIds.length !== filteredPartners.length)}
              className="px-3 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5"
            >
              <span>{selectedPartnerIds.length === filteredPartners.length && filteredPartners.length > 0 ? "☑️" : "🔲"}</span>
              <span>{selectedPartnerIds.length === filteredPartners.length && filteredPartners.length > 0 ? "إلغاء تحديد الكل" : "تحديد الكل"}</span>
            </button>

            {selectedPartnerIds.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={isDeletingBatch}
                className="px-3.5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-rose-600/20 animate-in fade-in"
              >
                <span>🗑️</span>
                <span>مسح المحدد ({selectedPartnerIds.length})</span>
              </button>
            )}

            <span className="text-xs font-bold text-slate-400 mr-1 hidden sm:inline">
              عرض ({filteredPartners.length}) من ({allPartners.length}) حساب
            </span>
          </div>

          {/* أزرار العمليات الإدارية والإضافة */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleSync}
              disabled={isPending}
              className="px-3 py-2 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition disabled:opacity-50 flex items-center gap-1"
              title="مزامنة وتحديث أطراف النظام من قاعدة البيانات"
            >
              <span>🔄</span>
              <span>مزامنة النظام</span>
            </button>

            <button
              type="button"
              onClick={handleSyncOldDebts}
              disabled={isPending}
              className="px-3 py-2 text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl transition disabled:opacity-50 flex items-center gap-1"
              title="فحص الطلبات المسلمة وتوليد ديون الزبائن بأثر رجعي"
            >
              <span>📊</span>
              <span>ديون الزبائن السابقة</span>
            </button>

            <Link
              href="/abo1stor3hlaa2kbr8-47/credit-book/logs"
              className="px-3 py-2 text-xs font-black text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center gap-1"
            >
              <span>📋</span>
              <span>سجل التغييرات</span>
            </Link>

            {!isAccountant && (
              <Link
                href="/abo1stor3hlaa2kbr8-47/credit-book/accountants"
                className="px-3 py-2 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition flex items-center gap-1"
              >
                <span>🔑</span>
                <span>المحاسبين</span>
              </Link>
            )}

            {/* الزر الرئيسي المميز */}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-xl transition shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <span>➕</span>
              <span>إضافة حساب جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* اقتراح سريع عند البحث باسم غير موجود */}
      {searchQuery.trim() !== "" && !/\d/.test(searchQuery.trim()) && searchQuery.trim().length >= 2 && (
        <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-right flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <p className="text-xs font-bold text-indigo-900">
              {filteredPartners.length === 0 
                ? `لا يوجد أي حساب باسم "${searchQuery.trim()}" في الدفتر.` 
                : `هل تبحث عن إضافة حساب جديد باسم "${searchQuery.trim()}"؟`
              }
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewPartnerName(searchQuery.trim());
              setNewPartnerPhone("");
              setNewPartnerType("external");
              setSelectedSystemPartnerId("");
              setShowAddModal(true);
            }}
            className="px-3.5 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm whitespace-nowrap"
          >
            ➕ إنشاء حساب لـ "{searchQuery.trim()}"
          </button>
        </div>
      )}

      {/* 3. عرض الحسابات (نظام البلوكات الافتراضي بدون سحب أفقي، أو الجدول المطور) */}
      {isPending ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-100">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <div className="text-slate-500 font-bold text-sm">جاري تحميل البيانات...</div>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-100 p-6">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-slate-600 font-black text-base">لا توجد حسابات مطابقة للتصفية حالياً</div>
          <p className="text-slate-400 text-xs font-bold mt-1">جرب تغيير شروط البحث أو الفرز أعلاه</p>
        </div>
      ) : viewMode === "blocks" ? (
        /* ========== نظام البلوكات الرشيق (اسم المحل والمبلغ فقط) ========== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredPartners.map((partner) => {
            const isSelected = selectedPartnerIds.includes(partner.id);
            const isNew = new Date(partner.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000;
            const typeInfo = typeLabels[partner.type] || { label: partner.type, icon: "👤" };

            return (
              <div
                key={partner.id}
                onClick={() => router.push(`/abo1stor3hlaa2kbr8-47/credit-book/${partner.id}`)}
                className={`group relative bg-white rounded-2xl p-3 sm:p-3.5 border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 hover:shadow-sm ${
                  isSelected 
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10" 
                    : partner.balance > 0
                      ? "border-slate-200/80 hover:border-emerald-300"
                      : partner.balance < 0
                        ? "border-slate-200/80 hover:border-rose-300"
                        : "border-slate-200/80 hover:border-slate-300"
                }`}
              >
                {/* الجانب الأيمن: التحديد + اسم المحل/الحساب + النوع والهاتف */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div 
                    className="shrink-0 flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectPartner(partner.id, e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors text-sm sm:text-base truncate">
                        {partner.name}
                      </span>
                      {isNew && (
                        <span className="px-1 py-0.2 rounded text-[8px] font-black bg-indigo-100 text-indigo-700">
                          جديد
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] font-bold text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <span>{typeInfo.icon}</span>
                        <span>{typeInfo.label}</span>
                      </span>
                      {partner.phone && (
                        <>
                          <span>•</span>
                          <span dir="ltr" className="text-slate-500">{partner.phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* الجانب الأيسر: شكد المبلغ فقط مع السهم */}
                <div className="shrink-0 flex items-center gap-2 text-left" dir="ltr">
                  <div className={`px-3 py-1.5 rounded-xl font-black text-sm sm:text-base tabular-nums flex flex-col items-end ${
                    partner.balance > 0
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                      : partner.balance < 0
                        ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                        : "bg-slate-100 text-slate-500 border border-slate-200/60"
                  }`}>
                    <span>
                      {partner.balance > 0 ? "+" : ""}{partner.balance < 0 ? "-" : ""}{formatDinarAsAlfWithUnit(Math.abs(partner.balance))}
                    </span>
                    <span className="text-[9px] font-black opacity-80" dir="rtl">
                      {partner.balance > 0 ? "نطلبه" : partner.balance < 0 ? "يطلبنا" : "مصفّر"}
                    </span>
                  </div>

                  <span className="text-slate-300 group-hover:text-indigo-600 group-hover:-translate-x-0.5 transition-all text-xs font-bold">
                    ◀
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========== نظام الجدول المطور (Table View) لمن يفضله ========== */
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-black border-b border-slate-100">
                  <th className="p-3.5 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedPartnerIds.length === filteredPartners.length && filteredPartners.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5">الاسم</th>
                  <th className="p-3.5">رقم الهاتف</th>
                  <th className="p-3.5">النوع</th>
                  <th className="p-3.5">رصيد الدفتر اليدوي</th>
                  <th className="p-3.5">المحفظة / التلقائي</th>
                  <th className="p-3.5">الرصيد الإجمالي</th>
                  <th className="p-3.5 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPartners.map((partner) => {
                  const typeInfo = typeLabels[partner.type] || { label: partner.type, icon: "👤" };
                  return (
                    <tr 
                      key={partner.id} 
                      className="hover:bg-indigo-50/30 transition cursor-pointer"
                      onClick={() => router.push(`/abo1stor3hlaa2kbr8-47/credit-book/${partner.id}`)}
                    >
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedPartnerIds.includes(partner.id)}
                          onChange={(e) => handleSelectPartner(partner.id, e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <Link 
                            href={`/abo1stor3hlaa2kbr8-47/credit-book/${partner.id}`}
                            className="text-slate-800 hover:text-indigo-600 font-black text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {partner.name}
                          </Link>
                          {new Date(partner.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-100 text-indigo-800">
                              جديد
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-500 text-xs font-bold" onClick={(e) => e.stopPropagation()}>
                        {partner.phone ? (
                          <div className="flex items-center gap-1.5">
                            <a href={`tel:${partner.phone}`} className="hover:text-indigo-600" dir="ltr">
                              {partner.phone}
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleCopyPhone(e, partner.id, partner.phone!)}
                              className="text-[9px] text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded bg-slate-100"
                            >
                              {copiedPhoneId === partner.id ? "✓" : "نسخ"}
                            </button>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="p-3.5 text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full font-black border text-[11px] ${typeBadgeStyles[partner.type] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-xs">
                        {partner.manualBalance > 0 ? (
                          <span className="text-emerald-600 tabular-nums">+{formatDinarAsAlfWithUnit(partner.manualBalance)}</span>
                        ) : partner.manualBalance < 0 ? (
                          <span className="text-rose-600 tabular-nums">-{formatDinarAsAlfWithUnit(Math.abs(partner.manualBalance))}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-xs">
                        {partner.type === "courier" || partner.type === "preparer" ? (
                          <div className="flex flex-col">
                            <span className={`tabular-nums ${partner.autoBalance > 0 ? "text-emerald-600" : partner.autoBalance < 0 ? "text-rose-600" : "text-slate-400"}`}>
                              {partner.autoBalance > 0 ? "+" : ""}{formatDinarAsAlfWithUnit(partner.autoBalance)}
                            </span>
                            <span className="text-[9px] text-slate-400">متبقي: {formatDinarAsAlfWithUnit(partner.walletRemain || 0)}</span>
                          </div>
                        ) : partner.type === "shop" ? (
                          <span className={partner.autoBalance < 0 ? "text-rose-600 tabular-nums" : "text-slate-400"}>
                            {partner.autoBalance < 0 ? `يطلبنا: ${formatDinarAsAlfWithUnit(Math.abs(partner.autoBalance))}` : "مسدد بالكامل"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5 font-black text-sm">
                        {partner.balance > 0 ? (
                          <span className="text-emerald-600 tabular-nums">+{formatDinarAsAlfWithUnit(partner.balance)}</span>
                        ) : partner.balance < 0 ? (
                          <span className="text-rose-600 tabular-nums">-{formatDinarAsAlfWithUnit(Math.abs(partner.balance))}</span>
                        ) : (
                          <span className="text-slate-400">0 (مصفّر)</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-xs font-black text-indigo-600 hover:text-indigo-800">
                          فتح ⬅️
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال إضافة زبون/طرف جديد */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>➕</span>
                <span>إضافة حساب جديد لدفتر الديون</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreatePartner} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-600 mb-1.5">الاسم بالكامل</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: علي محمد أو متجر السلام"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 mb-1.5">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: 07701234567"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 mb-1.5">النوع / التصنيف</label>
                <select
                  value={newPartnerType}
                  onChange={(e) => {
                    const type = e.target.value as PartnerType;
                    setNewPartnerType(type);
                    loadUnaddedPartners(type);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  <option value="external">🌐 طرف خارجي (شخص أو حساب آخر)</option>
                  <option value="customer">👤 زبون</option>
                  <option value="shop">🏪 محل</option>
                  <option value="preparer">📦 مجهز</option>
                  <option value="courier">🚚 مندوب</option>
                  <option value="supplier">🏭 مورد</option>
                </select>
              </div>

              {newPartnerType !== "external" && (
                <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 mb-1">ابحث باسم الحساب في النظام</label>
                    <input
                      type="text"
                      placeholder="اكتب للبحث والتصفية..."
                      value={systemPartnerSearch}
                      onChange={(e) => setSystemPartnerSearch(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 mb-1">
                      {selectedSystemPartnerId ? "الحساب المحدد للربط:" : "اختر الحساب للربط التلقائي:"}
                    </label>
                    
                    {selectedSystemPartnerId && (
                      <div className="mb-2 p-2.5 bg-indigo-50 text-indigo-900 rounded-lg text-xs font-black flex justify-between items-center border border-indigo-100">
                        <span>
                          📍 {newPartnerName} {newPartnerPhone ? `(${newPartnerPhone})` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSystemPartnerId("");
                            setNewPartnerName("");
                            setNewPartnerPhone("");
                          }}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-black border border-rose-200 px-2 py-0.5 rounded bg-white transition"
                        >
                          إلغاء
                        </button>
                      </div>
                    )}

                    {isLoadingUnadded ? (
                      <div className="text-xs text-slate-500 py-2">جاري التحميل...</div>
                    ) : unaddedSystemPartners.length === 0 ? (
                      <div className="text-xs text-slate-500 font-bold py-1">جميع الحسابات من هذا النوع مضافة مسبقاً!</div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white">
                        {unaddedSystemPartners
                          .filter(item => {
                            const query = systemPartnerSearch.toLowerCase();
                            const matchesName = item.name.toLowerCase().includes(query);
                            const matchesPhone = item.phone && item.phone.toLowerCase().includes(query);
                            return matchesName || matchesPhone;
                          })
                          .map((item) => {
                            const isSelected = selectedSystemPartnerId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSystemPartnerId(item.id);
                                  setNewPartnerName(item.name);
                                  setNewPartnerPhone(item.phone || "");
                                }}
                                className={`w-full text-right px-3 py-2 text-xs font-bold transition flex justify-between items-center ${
                                  isSelected 
                                    ? "bg-indigo-50 text-indigo-700 font-black border-r-4 border-indigo-600" 
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span>{item.name} {item.phone ? `(${item.phone})` : ""}</span>
                                {isSelected && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black">محدد ✅</span>}
                              </button>
                            );
                          })
                        }
                      </div>
                    )}
                  </div>
                </div>
              )}

              {addError && <p className="text-xs font-bold text-rose-600">{addError}</p>}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 shadow-sm"
                >
                  {isAdding ? "جاري الحفظ..." : "حفظ الحساب"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

