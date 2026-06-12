"use client";

import React, { useState, useTransition } from "react";
import { 
  PartnerWithBalance, 
  PartnerType, 
  createPartner, 
  syncSystemPartners, 
  getPartners,
  deletePartnersBatch,
  getUnaddedSystemPartners
} from "./actions";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

interface CreditBookClientProps {
  initialPartners: PartnerWithBalance[];
}

export function CreditBookClient({ initialPartners }: CreditBookClientProps) {
  const [partners, setPartners] = useState<PartnerWithBalance[]>(initialPartners);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
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

  // حساب الأرقام الكلية
  const totalWeOwed = partners
    .filter((p) => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);

  const totalWeOwe = partners
    .filter((p) => p.balance < 0)
    .reduce((sum, p) => sum + Math.abs(p.balance), 0);

  const netBalance = totalWeOwed - totalWeOwe;

  // تحديث القائمة بعد العمليات
  const refreshList = async () => {
    const fresh = await getPartners(searchQuery, selectedType);
    setPartners(fresh);
    setSelectedPartnerIds([]); // تصفير التحديد
  };

  // معالجة البحث والفرز
  const handleSearchAndFilter = async (query: string, type: string) => {
    setSearchQuery(query);
    setSelectedType(type);
    startTransition(async () => {
      const filtered = await getPartners(query, type);
      setPartners(filtered);
    });
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
      setSelectedPartnerIds(partners.map(p => p.id));
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

  // أنواع التسميات باللغة العربية
  const typeLabels: Record<PartnerType, string> = {
    courier: "مندوب",
    preparer: "مجهز",
    shop: "محل",
    customer: "زبون",
    external: "طرف خارجي",
  };

  const typeBadgeStyles: Record<PartnerType, string> = {
    courier: "bg-blue-50 text-blue-700 border border-blue-200",
    preparer: "bg-purple-50 text-purple-700 border border-purple-200",
    shop: "bg-amber-50 text-amber-700 border border-amber-200",
    customer: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    external: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* صناديق ملخص الأرصدة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-emerald-100 p-6 rounded-3xl shadow-sm text-right flex flex-col justify-between">
          <div>
            <span className="text-xs font-black text-emerald-500 uppercase tracking-wider">مطلوبات لنا (نطلبهم)</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-2 tabular-nums">
              {formatDinarAsAlfWithUnit(totalWeOwed)}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-4 font-bold">إجمالي الديون المستحقة لنا عند الآخرين</p>
        </div>

        <div className="bg-white border border-rose-100 p-6 rounded-3xl shadow-sm text-right flex flex-col justify-between">
          <div>
            <span className="text-xs font-black text-rose-500 uppercase tracking-wider">مطلوب منا (يطلبوننا)</span>
            <h3 className="text-2xl font-black text-rose-600 mt-2 tabular-nums">
              {formatDinarAsAlfWithUnit(totalWeOwe)}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-4 font-bold">إجمالي المبالغ المستحقة للآخرين علينا</p>
        </div>

        <div className={`border p-6 rounded-3xl shadow-sm text-right flex flex-col justify-between ${
          netBalance >= 0 
            ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" 
            : "bg-rose-50/50 border-rose-200 text-rose-900"
        }`}>
          <div>
            <span className="text-xs font-black uppercase tracking-wider">صافي رصيد الدفتر</span>
            <h3 className={`text-2xl font-black mt-2 tabular-nums ${netBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {netBalance >= 0 ? "+" : ""}{formatDinarAsAlfWithUnit(netBalance)}
            </h3>
          </div>
          <p className="text-[11px] mt-4 font-bold opacity-75">
            {netBalance >= 0 ? "الدفتر في حالة فائض إيجابي لصالحك" : "الدفتر في حالة عجز مالي لصالح الآخرين"}
          </p>
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
            <option value="external">أطراف خارجية</option>
          </select>
        </div>

        {/* أزرار العمليات */}
        <div className="flex gap-3 w-full lg:w-auto justify-end">
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
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition shadow-md shadow-indigo-900/10"
          >
            ➕ إضافة زبون/طرف جديد
          </button>
        </div>
      </div>

      {/* قائمة الأطراف */}
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        {isPending ? (
          <div className="py-20 text-center text-slate-500 font-bold">جاري تحميل البيانات...</div>
        ) : partners.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold">لا يوجد أطراف متوفرة في دفتر الديون حالياً.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-black border-b border-slate-100">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedPartnerIds.length === partners.length && partners.length > 0}
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
                {partners.map((partner) => (
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
                          className="hover:text-indigo-600"
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
                      <span className={`px-2.5 py-1 rounded-full font-black ${typeBadgeStyles[partner.type]}`}>
                        {typeLabels[partner.type]}
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
                    <label className="block text-xs font-black text-slate-500 mb-1.5">اختر من الحسابات المصفاة</label>
                    {isLoadingUnadded ? (
                      <div className="text-xs text-slate-500 py-2">جاري تحميل القائمة...</div>
                    ) : unaddedSystemPartners.length === 0 ? (
                      <div className="text-xs text-rose-500 font-bold py-2">جميع الحسابات من هذا النوع مضافة مسبقاً!</div>
                    ) : (
                      <select
                        value={selectedSystemPartnerId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSystemPartnerId(val);
                          const found = unaddedSystemPartners.find(p => p.id === val);
                          if (found) {
                            setNewPartnerName(found.name);
                            setNewPartnerPhone(found.phone || "");
                          } else {
                            setNewPartnerName("");
                            setNewPartnerPhone("");
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                      >
                        <option value="">-- اختر حساباً للربط التلقائي --</option>
                        {unaddedSystemPartners
                          .filter(item => item.name.toLowerCase().includes(systemPartnerSearch.toLowerCase()))
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} {item.phone ? `(${item.phone})` : ""}
                            </option>
                          ))
                        }
                      </select>
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
