"use client";

import React, { useState, useTransition, useEffect } from "react";
import { 
  PartnerWithBalance, 
  PartnerType, 
  createPartner, 
  syncSystemPartners, 
  getPartners,
  deletePartnersBatch,
  getUnaddedSystemPartners,
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

// أنواع التسميات باللغة العربية
const typeLabels: Record<PartnerType, string> = {
  courier: "مندوب",
  preparer: "مجهز",
  shop: "محل",
  customer: "زبون",
  external: "طرف خارجي",
  supplier: "مورد",
};

const typeBadgeStyles: Record<PartnerType, string> = {
  courier: "bg-blue-50 text-blue-700 border border-blue-200",
  preparer: "bg-purple-50 text-purple-700 border border-purple-200",
  shop: "bg-amber-50 text-amber-700 border border-amber-200",
  customer: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  external: "bg-slate-100 text-slate-700 border border-slate-200",
  supplier: "bg-pink-50 text-pink-700 border border-pink-200",
};

interface CreditBookClientProps {
  initialPartners: PartnerWithBalance[];
  isAccountant?: boolean;
}

export function CreditBookClient({ initialPartners, isAccountant = false }: CreditBookClientProps) {
  const [allPartners, setAllPartners] = useState<PartnerWithBalance[]>(initialPartners);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [balanceFilter, setBalanceFilter] = useState<string>("all");
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
  const typeFilteredPartnersForTotals = React.useMemo(() => {
    return allPartners.filter(p => selectedType === "all" || p.type === selectedType);
  }, [allPartners, selectedType]);

  const totalWeOwed = typeFilteredPartnersForTotals
    .filter((p) => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);

  const totalWeOwe = typeFilteredPartnersForTotals
    .filter((p) => p.balance < 0)
    .reduce((sum, p) => sum + Math.abs(p.balance), 0);

  const netBalance = totalWeOwed - totalWeOwe;

  // التصفية والبحث الفوري والذكي محلياً
  const filteredPartners = React.useMemo(() => {
    return allPartners.filter((p) => {
      // 1. فحص النوع
      if (selectedType !== "all" && p.type !== selectedType) return false;

      // 2. فحص رصيد الدفتر
      if (balanceFilter === "owe_us" && p.balance <= 0) return false;
      if (balanceFilter === "we_owe" && p.balance >= 0) return false;
      if (balanceFilter === "zero" && p.balance !== 0) return false;

      // 3. فحص مصطلح البحث (fuzzy match on name or phone or balance)
      if (!searchQuery.trim()) return true;

      const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return true;

      const nameStr = (p.name || "").toLowerCase();
      const phoneStr = (p.phone || "").toLowerCase();
      const typeStr = (typeLabels[p.type] || p.type || "").toLowerCase();
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
    <div className="space-y-8" dir="rtl">
      {/* البلوك الموحد لملخص الأرصدة والديون */}
      <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden text-right flex flex-col">
        {/* الجزء العلوي: صافي رصيد الدفتر (تدرج لوني تفاعلي) */}
        <div className={`p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-50 ${
          netBalance >= 0 
            ? "bg-gradient-to-br from-emerald-50/70 via-emerald-50/30 to-white" 
            : "bg-gradient-to-br from-rose-50/70 via-rose-50/30 to-white"
        }`}>
          <div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">صافي رصيد الدفتر الكلي</span>
            <h3 className={`text-3xl sm:text-4xl font-black mt-1 tabular-nums ${netBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {netBalance >= 0 ? "+" : ""}{formatDinarAsAlfWithUnit(netBalance)}
            </h3>
          </div>
          <div className={`px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 border ${
            netBalance >= 0 
              ? "bg-emerald-100/60 text-emerald-800 border-emerald-200/50" 
              : "bg-rose-100/60 text-rose-800 border-rose-200/50"
          }`}>
            <span>{netBalance >= 0 ? "🟢" : "🔴"}</span>
            <span>{netBalance >= 0 ? "الدفتر في حالة فائض إيجابي لصالحك" : "الدفتر في حالة عجز مالي لصالح الآخرين"}</span>
          </div>
        </div>

        {/* الجزء السفلي: المديونيات الفرعية جنباً إلى جنب */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100">
          {/* مطلوبات لنا */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              <span className="text-xs font-black text-emerald-500 uppercase tracking-wider block">مطلوبات لنا (نطلبهم)</span>
              <h4 className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 tabular-nums">
                {formatDinarAsAlfWithUnit(totalWeOwed)}
              </h4>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-bold">إجمالي الديون المستحقة لنا عند الآخرين</p>
          </div>

          {/* مطلوب منا */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              <span className="text-xs font-black text-rose-500 uppercase tracking-wider block">مطلوب منا (يطلبوننا)</span>
              <h4 className="text-xl sm:text-2xl font-black text-rose-600 mt-1 tabular-nums">
                {formatDinarAsAlfWithUnit(totalWeOwe)}
              </h4>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-bold">إجمالي المبالغ المستحقة للآخرين علينا</p>
          </div>
        </div>
      </div>

      {/* شريط التحكم (البحث والإجراءات) */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-100">
        {/* البحث والفرز */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="text"
            placeholder="ابحث بالاسم..."
            value={searchQuery}
            onChange={(e) => handleSearchAndFilter(e.target.value, selectedType)}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-64"
          />
          <select
            value={selectedType}
            onChange={(e) => handleSearchAndFilter(searchQuery, e.target.value)}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
          >
            <option value="all">كل الأطراف</option>
            <option value="courier">المناديب فقط</option>
            <option value="preparer">المجهزين فقط</option>
            <option value="shop">المحلات فقط</option>
            <option value="customer">الزبائن فقط</option>
            <option value="supplier">الموردين فقط</option>
            <option value="external">أطراف خارجية</option>
          </select>
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
          >
            <option value="all">كل الحالات المالية</option>
            <option value="owe_us">نطلبهم (ديون لنا)</option>
            <option value="we_owe">يطلبوننا (ديون علينا)</option>
            <option value="zero">المتصفّر (الحسابات المصفّرة)</option>
          </select>
        </div>

        {/* أزرار العمليات */}
        <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
          {selectedPartnerIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeletingBatch}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-2xl transition disabled:opacity-50"
            >
              🗑️ مسح المحدد ({selectedPartnerIds.length})
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={isPending}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition disabled:opacity-50"
          >
            🔄 مزامنة أطراف النظام
          </button>
          <Link
            href="/abo1stor3hlaa2kbr8-47/credit-book/logs"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-2xl transition"
          >
            📋 سجل التغييرات
          </Link>
          {!isAccountant && (
            <Link
              href="/abo1stor3hlaa2kbr8-47/credit-book/accountants"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition border border-indigo-100"
            >
              🔑 روابط المحاسبين
            </Link>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition shadow-md shadow-indigo-900/10"
          >
            ➕ إضافة زبون/طرف جديد
          </button>
        </div>
      </div>

      {/* مقترح إنشاء حساب جديد */}
      {searchQuery.trim() !== "" && !/\d/.test(searchQuery.trim()) && searchQuery.trim().length >= 2 && (
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl text-right flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              💡 {filteredPartners.length === 0 
                ? `لا يوجد أي حساب باسم "${searchQuery.trim()}" في الدفتر.` 
                : `لم تجد الحساب المطلوب لـ "${searchQuery.trim()}"؟`
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
            className="px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition shadow-sm whitespace-nowrap"
          >
            ➕ إنشاء حساب جديد لـ "{searchQuery.trim()}"
          </button>
        </div>
      )}

      {/* قائمة الأطراف */}
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        {isPending ? (
          <div className="py-20 text-center text-slate-500 font-bold">جاري تحميل البيانات...</div>
        ) : filteredPartners.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold">لا يوجد أطراف متوفرة تطابق خيارات التصفية حالياً.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-black border-b border-slate-100">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedPartnerIds.length === filteredPartners.length && filteredPartners.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                  </th>
                  <th className="p-4">الاسم</th>
                  <th className="p-4">رقم الهاتف</th>
                  <th className="p-4">النوع</th>
                  <th className="p-4">رصيد الدفتر اليدوي</th>
                  <th className="p-4">المحفظة / التلقائي (من النظام)</th>
                  <th className="p-4">الرصيد الإجمالي</th>
                  <th className="p-4 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedPartnerIds.includes(partner.id)}
                        onChange={(e) => handleSelectPartner(partner.id, e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/abo1stor3hlaa2kbr8-47/credit-book/${partner.id}`}
                          className={
                            partner.balance > 0 
                              ? "text-emerald-600 hover:text-emerald-700" 
                              : partner.balance < 0 
                                ? "text-rose-600 hover:text-rose-700" 
                                : "text-slate-800 hover:text-indigo-600"
                          }
                        >
                          {partner.name}
                        </Link>
                        {new Date(partner.createdAt).getTime() > Date.now() - 60 * 60 * 1000 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse">
                            🆕 جديد
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 text-sm font-semibold">{partner.phone || "—"}</td>
                    <td className="p-4 text-xs">
                      <span className={`px-2.5 py-1 rounded-full font-black ${typeBadgeStyles[partner.type] || "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                        {typeLabels[partner.type] || partner.type}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-700">
                      {partner.manualBalance > 0 ? (
                        <span className="text-emerald-600 tabular-nums">+{formatDinarAsAlfWithUnit(partner.manualBalance)}</span>
                      ) : partner.manualBalance < 0 ? (
                        <span className="text-rose-600 tabular-nums">-{formatDinarAsAlfWithUnit(Math.abs(partner.manualBalance))}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="p-4 font-bold">
                      {partner.type === "courier" || partner.type === "preparer" ? (
                        partner.autoBalance > 0 ? (
                          <div className="flex flex-col">
                            <span className="text-emerald-600 tabular-nums">+{formatDinarAsAlfWithUnit(partner.autoBalance)}</span>
                            <span className="text-[10px] text-slate-400 font-bold">متبقي المحفظة: {formatDinarAsAlfWithUnit(partner.walletRemain || 0)}</span>
                          </div>
                        ) : partner.autoBalance < 0 ? (
                          <div className="flex flex-col">
                            <span className="text-rose-600 tabular-nums">-{formatDinarAsAlfWithUnit(Math.abs(partner.autoBalance))}</span>
                            <span className="text-[10px] text-slate-400 font-bold">متبقي المحفظة: {formatDinarAsAlfWithUnit(partner.walletRemain || 0)}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-slate-400">0</span>
                            <span className="text-[10px] text-slate-400 font-bold">متبقي المحفظة: {formatDinarAsAlfWithUnit(partner.walletRemain || 0)}</span>
                          </div>
                        )
                      ) : partner.type === "shop" ? (
                        partner.autoBalance < 0 ? (
                          <span className="text-rose-600 tabular-nums">يطلبنا طلبات: {formatDinarAsAlfWithUnit(Math.abs(partner.autoBalance))}</span>
                        ) : (
                          <span className="text-slate-400">مسدد بالكامل</span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-4 font-black text-base">
                      {partner.balance > 0 ? (
                        <span className="text-emerald-600 tabular-nums">
                          نطلبه: {formatDinarAsAlfWithUnit(partner.balance)}
                        </span>
                      ) : partner.balance < 0 ? (
                        <span className="text-rose-600 tabular-nums">
                          يطلبنا: {formatDinarAsAlfWithUnit(Math.abs(partner.balance))}
                        </span>
                      ) : (
                        <span className="text-slate-400">مصفّر</span>
                      )}
                    </td>
                    <td className="p-4 text-left">
                      <Link
                        href={`/abo1stor3hlaa2kbr8-47/credit-book/${partner.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                      >
                        👁️ كشف الحساب
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* مودال إضافة زبون/طرف جديد */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl max-w-md w-full p-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-4">إضافة شريك/زبون جديد لدفتر الديون</h3>
            
            <form onSubmit={handleCreatePartner} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">الاسم بالكامل</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: علي محمد"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: 07701234567"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">النوع/التصنيف</label>
                <select
                  value={newPartnerType}
                  onChange={(e) => {
                    const type = e.target.value as PartnerType;
                    setNewPartnerType(type);
                    loadUnaddedPartners(type);
                  }}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="external">طرف خارجي (شخص أو حساب آخر)</option>
                  <option value="customer">زبون</option>
                  <option value="shop">محل</option>
                  <option value="preparer">مجهز</option>
                  <option value="courier">مندوب</option>
                  <option value="supplier">مورد</option>
                </select>
              </div>

              {newPartnerType !== "external" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">ابحث باسم الحساب</label>
                    <input
                      type="text"
                      placeholder="اكتب اسم الحساب هنا للبحث والتصفية..."
                      value={systemPartnerSearch}
                      onChange={(e) => setSystemPartnerSearch(e.target.value)}
                      className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">
                      {selectedSystemPartnerId ? "الحساب المحدد للربط التلقائي:" : "اختر الحساب للربط التلقائي:"}
                    </label>
                    
                    {selectedSystemPartnerId && (
                      <div className="mb-2.5 p-3 bg-indigo-50 text-indigo-900 rounded-2xl text-xs font-black flex justify-between items-center border border-indigo-100">
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
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-black border border-rose-200 px-2 py-0.5 rounded-lg bg-white transition"
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    )}

                    {isLoadingUnadded ? (
                      <div className="text-xs text-slate-500 py-2">جاري تحميل القائمة...</div>
                    ) : unaddedSystemPartners.length === 0 ? (
                      <div className="text-xs text-rose-500 font-bold py-2">جميع الحسابات من هذا النوع مضافة مسبقاً!</div>
                    ) : (
                      <div className="border border-slate-200 rounded-2xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
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
                                className={`w-full text-right px-4 py-3 text-xs font-bold transition flex justify-between items-center ${
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
                        {unaddedSystemPartners.filter(item => {
                          const query = systemPartnerSearch.toLowerCase();
                          const matchesName = item.name.toLowerCase().includes(query);
                          const matchesPhone = item.phone && item.phone.toLowerCase().includes(query);
                          return matchesName || matchesPhone;
                        }).length === 0 && (
                          <div className="p-3 text-xs text-rose-500 font-bold text-center">لا توجد نتائج مطابقة لمصطلح البحث</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {addError && <p className="text-xs font-bold text-rose-600">{addError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition disabled:opacity-50"
                >
                  {isAdding ? "جاري الإضافة..." : "حفق الشريك"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition"
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
