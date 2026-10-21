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
  revokeAccountantAccess,
  resetAndZeroCreditBookCompletely
} from "./actions";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { smartMatches } from "@/lib/credit-book-search";
import {
  Search,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Trash2,
  Users,
  Check,
  Copy,
  ChevronLeft,
  Scale,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Wallet,
  ShieldCheck,
  X,
  SlidersHorizontal,
  Truck,
  Package,
  Store,
  User,
  Globe,
  Factory,
} from "lucide-react";

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
  courier: "bg-[#F0F4FF] text-[#0B2E8C] border-[#D0DDFB] hover:bg-[#E2ECFF]",
  preparer: "bg-purple-50 text-purple-700 border-purple-200/80 hover:bg-purple-100/70",
  shop: "bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70",
  customer: "bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70",
  external: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70",
  supplier: "bg-indigo-50 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100/70",
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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAllPartners(initialPartners);
  }, [initialPartners]);

  useEffect(() => {
    // جلب أحدث الأرقام الحية فورياً عند فتح الصفحة لضمان مطابقة الشاشة للواقع
    refreshList();
  }, []);

  // نموذج إضافة شريك جديد
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerPhone, setNewPartnerPhone] = useState("");
  const [newPartnerType, setNewPartnerType] = useState<PartnerType>("external");
  const [unaddedSystemPartners, setUnaddedSystemPartners] = useState<{ id: string; name: string; phone: string | null; isAdded?: boolean; creditBookPartnerId?: string }[]>([]);
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
      if (balanceFilter === "active_only" && p.balance === 0) return false;
      if (balanceFilter === "owe_us" && p.balance <= 0) return false;
      if (balanceFilter === "we_owe" && p.balance >= 0) return false;
      if (balanceFilter === "zero" && p.balance !== 0) return false;
      // خيار all يظهر جميع الحسابات بالكامل مع تصدر الحسابات غير الصفرية في الأعلى

      const hasSearch = searchQuery.trim().length > 0;

      // 3. فحص مصطلح البحث الذكي والشامل (الاسم، الهاتف، النوع، الرصيد، تفاصيل وملاحظات المعاملات)
      if (!hasSearch) return true;

      const typeInfo = typeLabels[p.type]?.label || p.type || "";
      const statusText = p.balance > 0 ? "نطلبه باقي لصالحنا عليه دين" : p.balance < 0 ? "يطلبنا باقي علينا له دائن" : "مصفر صفر مسدد";
      const balanceK = Math.abs(p.balance || 0) / 1000;

      const searchTarget = [
        p.name,
        p.phone || "",
        typeInfo,
        String(p.balance || 0),
        String(Math.abs(p.balance || 0)),
        String(balanceK),
        `${balanceK} الف`,
        statusText,
        p.notesSummary || "",
      ].join(" ");

      return smartMatches(searchTarget, searchQuery);
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

  // تصفير دفتر الديون بالكامل وبدء صفحة جديدة نظيفة (0 د.ع)
  const handleResetCompletely = () => {
    if (!confirm("⚠️ تحذير مهم جداً!\n\nهل أنت متأكد من رغبتك في تصفير دفتر الديون بالكامل الآن وبدء صفحة جديدة نظيفة (0 د.ع)؟\n\n• سيتم مسح كافة المعاملات السابقة وحساب الموجود.\n• سيتم تصفير حسابات المحلات والمناديب والمجهزين إلى 0.00 د.ع.\n• ستبقى الأتمتة شغالة لطلبات الغد وما بعده لتسجيل كل حركة جديدة تلقائياً.")) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await resetAndZeroCreditBookCompletely();
        if (res && res.success) {
          alert("✅ تم تصفير دفتر الديون بالكامل بنجاح!\nالدفتر الآن مصفّر ونظيف (0 د.ع)، والآلية التلقائية جاهزة وشغالة لطلبات الغد.");
          window.location.reload();
        } else {
          alert(res?.error || "فشل تصفير الدفتر");
        }
      } catch (err: any) {
        alert(err?.message || "حدث خطأ أثناء الاتصال بالخادم");
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
    <div className="space-y-5" dir="rtl">
      {/* 1. بطاقة الرصيد الكلي الصافي بستايل وصلي المصرفي الفاخر */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0B2E8C] via-[#0E359E] to-[#1E4DB7] p-5 sm:p-6 text-white shadow-[0_10px_35px_rgba(11,46,140,0.28)] border border-[#1E4DB7]/60">
        {/* تأثيرات الإضاءة الخلفية وشعاع ذهبي ناعم */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#FFC107]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center justify-center text-center gap-3">
          {/* شارة حالة الدفتر الصافي */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-black">
            <div className="w-5 h-5 rounded-full bg-[#FFC107] flex items-center justify-center text-[#0B2E8C] shrink-0">
              <Scale className="w-3 h-3 stroke-[2.5]" />
            </div>
            <span>
              {netBalance < 0 
                ? "صافي الديون المستحقة علينا للموردين والمحلات" 
                : netBalance > 0 
                  ? "صافي الديون لصالحنا في السوق" 
                  : "صافي دفتر الديون متوازن ومصفّر بالكامل"}
            </span>
          </div>

          {/* الرقم الإجمالي الصافي */}
          <div className="my-1">
            <span className="text-4xl sm:text-6xl font-black tracking-tight tabular-nums drop-shadow-sm">
              {netBalance > 0 ? "+" : ""}{netBalance < 0 ? "-" : ""}{formatDinarAsAlfWithUnit(Math.abs(netBalance))}
            </span>
          </div>

          {/* تفكيك الأرقام بكبسولتين بلوريتين أنيقتين */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 w-full max-w-lg mt-1">
            {/* كبسولة نطلبهم */}
            <div 
              onClick={() => {
                setBalanceFilter("owe_us");
                setSelectedType("all");
              }}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-[18px] p-3 sm:p-3.5 border border-white/20 text-center transition-all cursor-pointer group shadow-xs"
              title="انقر لتصفية من نطلبهم فقط"
            >
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-white/80 group-hover:text-white">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                <span>نطلبهم في السوق</span>
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-300 tabular-nums mt-0.5">
                +{formatDinarAsAlfWithUnit(totalWeOwed)}
              </div>
              <div className="text-[10px] font-bold text-white/60 mt-0.5">
                ({countStats.oweUsCount} حساب)
              </div>
            </div>

            {/* كبسولة يطلبوننا */}
            <div 
              onClick={() => {
                setBalanceFilter("we_owe");
                setSelectedType("all");
              }}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-[18px] p-3 sm:p-3.5 border border-white/20 text-center transition-all cursor-pointer group shadow-xs"
              title="انقر لتصفية من يطلبوننا فقط"
            >
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-white/80 group-hover:text-white">
                <TrendingDown className="w-3.5 h-3.5 text-rose-300" />
                <span>يطلبوننا (موردين ومحلات)</span>
              </div>
              <div className="text-base sm:text-lg font-black text-rose-300 tabular-nums mt-0.5">
                -{formatDinarAsAlfWithUnit(totalWeOwe)}
              </div>
              <div className="text-[10px] font-bold text-white/60 mt-0.5">
                ({countStats.weOweCount} حساب)
              </div>
            </div>
          </div>

          {/* زر سريع لكشف من يطلبنا فوراً في القائمة بالأسفل */}
          {totalWeOwe > 0 && (
            <button
              type="button"
              onClick={() => {
                setBalanceFilter("we_owe");
                setSelectedType("all");
              }}
              className="mt-1 px-4 py-2 text-xs font-black text-[#0B2E8C] bg-[#FFC107] hover:bg-[#FFD54F] rounded-[14px] transition-all shadow-[0_3px_10px_rgba(255,193,7,0.3)] active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>كشف وتفصيل من يطلبنا بالاسم والمبلغ</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. شريط البحث والخيارات المنظم بثيم وصلي */}
      <div className="bg-white p-3.5 sm:p-4 rounded-[22px] border border-[#D0DDFB] shadow-[0_4px_16px_rgba(11,46,140,0.05)] space-y-3">
        {/* الصف الأول: خانة البحث في الأعلى وبجانبها أزرار الإجراءات */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* حقل البحث الذكي */}
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#1E4DB7]/60">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="ابحث بالاسم، الهاتف، أو المبلغ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-8 py-2.5 bg-[#F0F4FF]/70 border border-[#D0DDFB] rounded-[14px] text-xs sm:text-sm font-bold text-[#0B2E8C] placeholder-[#1E4DB7]/40 focus:outline-none focus:bg-white focus:border-[#0B2E8C] focus:ring-2 focus:ring-[#0B2E8C]/15 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-[#0B2E8C] font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* زر مزامنة ديون الزبائن السابقة */}
          <button
            type="button"
            disabled={isPending}
            onClick={handleSyncOldDebts}
            className="px-3 sm:px-3.5 py-2.5 text-xs font-black text-[#0B2E8C] bg-[#F0F4FF] hover:bg-[#E2ECFF] border border-[#D0DDFB] rounded-[14px] transition-all shadow-2xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 active:scale-95 cursor-pointer"
            title="فحص ومزامنة ديون الزبائن للطلبات المسلمة غير المستلمة بالكامل"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#1E4DB7]" />
            <span className="hidden sm:inline">مزامنة ديون الزبائن</span>
          </button>

          {/* زر إضافة حساب جديد */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 sm:px-4 py-2.5 text-xs font-black text-white bg-[#0B2E8C] hover:bg-[#1E4DB7] rounded-[14px] transition-all shadow-[0_3px_10px_rgba(11,46,140,0.22)] flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
            title="إضافة حساب جديد"
          >
            <Plus className="w-4 h-4 text-[#FFC107]" strokeWidth={3} />
            <span className="hidden sm:inline">إضافة حساب</span>
          </button>

          {/* زر تصفير الدفتر بالكامل */}
          {!isAccountant && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleResetCompletely}
              className="px-3 sm:px-3.5 py-2.5 text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-[14px] transition flex items-center gap-1.5 shrink-0 shadow-2xs active:scale-95 cursor-pointer"
              title="تصفير الدفتر بالكامل وبدء صفحة جديدة (0 د.ع)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تصفير الدفتر</span>
            </button>
          )}

          {/* زر إعدادات دفتر الديون */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="px-3 sm:px-3.5 py-2.5 text-xs font-black text-[#0B2E8C] bg-[#F0F4FF] hover:bg-[#E2ECFF] border border-[#D0DDFB] rounded-[14px] transition flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
            title="إعدادات دفتر الديون والعمليات"
          >
            <Settings className="w-3.5 h-3.5 text-[#1E4DB7]" />
            <span className="hidden sm:inline">الإعدادات</span>
          </button>
        </div>

        {/* الصف الثاني: فلاتر التصنيف جنباً إلى جنب */}
        <div className="grid grid-cols-2 gap-2">
          {/* فلتر نوع الطرف */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 bg-[#F0F4FF]/80 border border-[#D0DDFB] rounded-[14px] text-xs font-black text-[#0B2E8C] focus:outline-none focus:border-[#0B2E8C] transition-all cursor-pointer truncate"
          >
            <option value="all">👥 جميع الأطراف والجهات</option>
            <option value="courier">🚚 المناديب فقط</option>
            <option value="preparer">📦 المجهزين فقط</option>
            <option value="shop">🏪 المحلات فقط</option>
            <option value="customer">👤 الزبائن فقط</option>
            <option value="supplier">🏭 الموردين فقط</option>
            <option value="external">🌐 أطراف خارجية</option>
          </select>

          {/* فلتر حالة الرصيد */}
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[#F0F4FF]/80 border border-[#D0DDFB] rounded-[14px] text-xs font-black text-[#0B2E8C] focus:outline-none focus:border-[#0B2E8C] transition-all cursor-pointer truncate"
          >
            <option value="all">📋 جميع الحسابات (مع إبراز الديون أولاً)</option>
            <option value="active_only">⚡ الحسابات النشطة فقط (غير المصفّرة)</option>
            <option value="owe_us">🟢 نطلبهم (ديون لصالحنا)</option>
            <option value="we_owe">🔴 يطلبوننا (ديون علينا)</option>
            <option value="zero">⚪ الحسابات المصفّرة (0 د.ع)</option>
          </select>
        </div>

        {/* شريط الإجراءات الجماعية يظهر فقط عند التحديد */}
        {selectedPartnerIds.length > 0 && (
          <div className="pt-2 border-t border-[#D0DDFB] flex items-center justify-between gap-2 flex-wrap animate-in fade-in">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={isDeletingBatch}
                className="px-3.5 py-1.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-[12px] transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح المحدد ({selectedPartnerIds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPartnerIds([])}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-[#0B2E8C]"
              >
                إلغاء التحديد
              </button>
            </div>
            <span className="text-xs font-bold text-[#1E4DB7]/70">
              تم تحديد {selectedPartnerIds.length} من {filteredPartners.length}
            </span>
          </div>
        )}
      </div>

      {/* اقتراح سريع عند البحث باسم غير موجود */}
      {searchQuery.trim() !== "" && !/\d/.test(searchQuery.trim()) && searchQuery.trim().length >= 2 && (
        <div className="p-4 bg-[#F0F4FF] border border-[#D0DDFB] rounded-[20px] text-right flex flex-col sm:flex-row justify-between items-center gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FFC107] text-[#0B2E8C] flex items-center justify-center font-black shrink-0 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-[#0B2E8C]">
              {filteredPartners.length === 0 
                ? `لا يوجد أي حساب باسم "${searchQuery.trim()}" في الدفتر حالياً.` 
                : `هل ترغب في إنشاء حساب جديد باسم "${searchQuery.trim()}"؟`
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
            className="px-4 py-2 text-xs font-black text-white bg-[#0B2E8C] hover:bg-[#1E4DB7] rounded-[14px] transition shadow-[0_3px_10px_rgba(11,46,140,0.2)] whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#FFC107]" strokeWidth={3} />
            <span>إنشاء حساب لـ "{searchQuery.trim()}"</span>
          </button>
        </div>
      )}

      {/* 3. عرض الحسابات (نظام البلوكات الرشيق بثيم وصلي) */}
      {isPending ? (
        <div className="py-20 text-center bg-white rounded-[24px] border border-[#D0DDFB] shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#F0F4FF] text-[#0B2E8C] mx-auto flex items-center justify-center animate-spin mb-3">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div className="text-[#0B2E8C] font-black text-sm">جاري تحديث بيانات الدفتر...</div>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[24px] border border-[#D0DDFB] p-8 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#F0F4FF] text-[#1E4DB7]/60 mx-auto flex items-center justify-center mb-3">
            <Users className="w-7 h-7" />
          </div>
          <div className="text-[#0B2E8C] font-black text-base">لا توجد حسابات مطابقة للتصفية حالياً</div>
          <p className="text-[#1E4DB7]/70 text-xs font-bold mt-1">تأكد من شروط البحث أو الفرز المالي أعلاه</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPartners.map((partner) => {
            const isSelected = selectedPartnerIds.includes(partner.id);
            const isNew = new Date(partner.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000;
            const typeInfo = typeLabels[partner.type] || { label: partner.type, icon: "👤" };

            return (
              <Link
                key={partner.id}
                href={`/abo1stor3hlaa2kbr8-47/credit-book/${partner.id}`}
                className={`group relative bg-white rounded-[20px] p-3.5 sm:p-4 border-[1.5px] transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 no-underline shadow-[0_2px_10px_rgba(11,46,140,0.04)] hover:shadow-[0_6px_20px_rgba(11,46,140,0.09)] hover:-translate-y-0.5 active:scale-[0.99] ${
                  isSelected 
                    ? "border-[#0B2E8C] ring-2 ring-[#0B2E8C]/25 bg-[#F0F5FF]" 
                    : partner.balance > 0
                      ? "border-[#D0DDFB] hover:border-emerald-400"
                      : partner.balance < 0
                        ? "border-[#D0DDFB] hover:border-rose-400"
                        : "border-[#D0DDFB] hover:border-[#1E4DB7]/50"
                }`}
              >
                {/* الجانب الأيمن: التحديد + اسم الحساب + النوع والهاتف */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div 
                    className="shrink-0 flex items-center"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectPartner(partner.id, e.target.checked);
                      }}
                      className="rounded-[6px] border-[#D0DDFB] text-[#0B2E8C] focus:ring-[#0B2E8C] h-4 w-4 cursor-pointer accent-[#0B2E8C]"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-[#0B2E8C] group-hover:text-[#1E4DB7] transition-colors text-[14px] sm:text-[15px] truncate">
                        {partner.name}
                      </span>
                      {isNew && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[#FFC107] text-[#0B2E8C] shadow-2xs">
                          جديد
                        </span>
                      )}
                      {partner.type === "shop" && (partner.orderCount || 0) >= 150 && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#F0F4FF] text-[#0B2E8C] border border-[#D0DDFB]" title={`محل مميز ونشط: لديه ${partner.orderCount} طلب`}>
                          🔥 أكثر من 150 طلب
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-slate-500">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${typeBadgeStyles[partner.type] || "bg-slate-100 text-slate-700"}`}>
                        {typeInfo.label}
                      </span>
                      {partner.phone && (
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:text-[#0B2E8C] transition-colors"
                          onClick={(e) => handleCopyPhone(e, partner.id, partner.phone!)}
                          title="انقر لنسخ رقم الهاتف"
                        >
                          <span dir="ltr" className="font-mono font-bold text-slate-600 group-hover:text-slate-800">
                            {partner.phone}
                          </span>
                          {copiedPhoneId === partner.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400 opacity-60 hover:opacity-100" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* الجانب الأيسر: المبلغ الرصيدي مع سهم وصلي */}
                <div className="shrink-0 flex items-center gap-2 text-left" dir="ltr">
                  <div className={`px-3 py-1.5 rounded-[14px] font-black text-sm sm:text-[15px] tabular-nums flex flex-col items-end shadow-2xs ${
                    partner.balance > 0
                      ? "bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]"
                      : partner.balance < 0
                        ? "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]"
                        : "bg-[#F8FAFC] text-slate-500 border border-slate-200"
                  }`}>
                    <span className="tracking-tight">
                      {partner.balance > 0 ? "+" : ""}{partner.balance < 0 ? "-" : ""}{formatDinarAsAlfWithUnit(Math.abs(partner.balance))}
                    </span>
                    <span className="text-[9px] font-black opacity-90 mt-0.5" dir="rtl">
                      {partner.balance > 0 ? "نطلبه" : partner.balance < 0 ? "يطلبنا" : "مصفّر"}
                    </span>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-[#F0F4FF] text-[#0B2E8C] group-hover:bg-[#0B2E8C] group-hover:text-[#FFC107] flex items-center justify-center transition-all shadow-2xs shrink-0">
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* نافذة إعدادات دفتر الديون المنبثقة بثيم وصلي */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-[#0B2E8C]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-[#D0DDFB] shadow-2xl max-w-sm w-full p-5 sm:p-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-[#D0DDFB] pb-3">
              <h3 className="text-base font-black text-[#0B2E8C] flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#FFC107] text-[#0B2E8C] flex items-center justify-center shadow-2xs">
                  <Settings className="w-4 h-4" />
                </div>
                <span>إعدادات دفتر الديون</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-7 h-7 rounded-full bg-[#F0F4FF] text-slate-500 hover:text-[#0B2E8C] flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {/* تحديد كافة الحسابات */}
              <button
                type="button"
                onClick={() => {
                  handleSelectAll(selectedPartnerIds.length !== filteredPartners.length);
                  setShowSettingsModal(false);
                }}
                className="w-full p-3 rounded-[14px] bg-[#F0F4FF] hover:bg-[#E2ECFF] border border-[#D0DDFB] text-right flex items-center justify-between text-xs font-black text-[#0B2E8C] transition active:scale-95 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#FFC107]" />
                  <span>{selectedPartnerIds.length === filteredPartners.length && filteredPartners.length > 0 ? "إلغاء تحديد الكل" : "تحديد كافة الحسابات"}</span>
                </div>
                <span className="text-[10px] text-[#1E4DB7]/70">({filteredPartners.length} حساب)</span>
              </button>

              {/* مزامنة أطراف النظام */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setShowSettingsModal(false);
                  handleSync();
                }}
                className="w-full p-3 rounded-[14px] bg-[#F0F4FF] hover:bg-[#E2ECFF] border border-[#D0DDFB] text-right flex items-center justify-between text-xs font-black text-[#0B2E8C] transition disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#1E4DB7]" />
                  <span>مزامنة أطراف النظام</span>
                </div>
                <span className="text-[10px] text-[#1E4DB7]/70">استيراد جهات النظام</span>
              </button>

              {/* مزامنة ديون الزبائن التاريخية */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setShowSettingsModal(false);
                  handleSyncOldDebts();
                }}
                className="w-full p-3 rounded-[14px] bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 text-right flex items-center justify-between text-xs font-black text-emerald-800 transition disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>مزامنة ديون الزبائن السابقة</span>
                </div>
                <span className="text-[10px] text-emerald-600">فحص بأثر رجعي</span>
              </button>

              {/* سجل التغييرات */}
              <Link
                href="/abo1stor3hlaa2kbr8-47/credit-book/logs"
                onClick={() => setShowSettingsModal(false)}
                className="w-full p-3 rounded-[14px] bg-[#F0F4FF] hover:bg-[#E2ECFF] border border-[#D0DDFB] text-right flex items-center justify-between text-xs font-black text-[#0B2E8C] transition active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#1E4DB7]" />
                  <span>سجل التغييرات والعمليات</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-[#1E4DB7]" />
              </Link>

              {/* روابط المحاسبين */}
              {!isAccountant && (
                <Link
                  href="/abo1stor3hlaa2kbr8-47/credit-book/accountants"
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full p-3 rounded-[14px] bg-[#F0F4FF] hover:bg-[#E2ECFF] border border-[#D0DDFB] text-right flex items-center justify-between text-xs font-black text-[#0B2E8C] transition active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#1E4DB7]" />
                    <span>روابط المحاسبين</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-[#1E4DB7]" />
                </Link>
              )}

              {/* زر تصفير دفتر الديون بالكامل */}
              {!isAccountant && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setShowSettingsModal(false);
                    handleResetCompletely();
                  }}
                  className="w-full p-3 rounded-[14px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-right flex items-center justify-between text-xs font-black text-rose-700 transition disabled:opacity-50 mt-1 active:scale-95 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-rose-600" />
                    <span>تصفير الدفتر وبدء صفحة جديدة (0 د.ع)</span>
                  </div>
                  <span className="text-[10px] text-rose-600 font-bold">تصفير</span>
                </button>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-[#D0DDFB]">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-2.5 text-xs font-black text-[#0B2E8C] bg-[#F0F4FF] hover:bg-[#E2ECFF] rounded-[14px] transition active:scale-95 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال إضافة زبون/طرف جديد بثيم وصلي */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#0B2E8C]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-[#D0DDFB] shadow-2xl max-w-md w-full p-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-[#D0DDFB] pb-3">
              <h3 className="text-base font-black text-[#0B2E8C] flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#FFC107] text-[#0B2E8C] flex items-center justify-center shadow-2xs">
                  <Plus className="w-4 h-4" strokeWidth={3} />
                </div>
                <span>إضافة حساب جديد لدفتر الديون</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-[#F0F4FF] text-slate-500 hover:text-[#0B2E8C] flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreatePartner} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#0B2E8C] mb-1.5">الاسم بالكامل</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: علي محمد أو متجر السلام"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#F0F4FF]/70 border border-[#D0DDFB] text-sm font-bold text-[#0B2E8C] placeholder-[#1E4DB7]/40 focus:bg-white focus:border-[#0B2E8C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#0B2E8C] mb-1.5">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: 07701234567"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#F0F4FF]/70 border border-[#D0DDFB] text-sm font-bold text-[#0B2E8C] placeholder-[#1E4DB7]/40 focus:bg-white focus:border-[#0B2E8C] focus:outline-none text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#0B2E8C] mb-1.5">النوع / التصنيف</label>
                <select
                  value={newPartnerType}
                  onChange={(e) => {
                    const type = e.target.value as PartnerType;
                    setNewPartnerType(type);
                    loadUnaddedPartners(type);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#F0F4FF]/70 border border-[#D0DDFB] text-xs font-black text-[#0B2E8C] focus:bg-white focus:border-[#0B2E8C] focus:outline-none"
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
                <div className="space-y-2.5 p-3.5 bg-[#F0F4FF]/60 rounded-[16px] border border-[#D0DDFB]">
                  <div>
                    <label className="block text-[11px] font-black text-[#0B2E8C] mb-1">ابحث باسم الحساب في النظام</label>
                    <input
                      type="text"
                      placeholder="اكتب للبحث والتصفية..."
                      value={systemPartnerSearch}
                      onChange={(e) => setSystemPartnerSearch(e.target.value)}
                      className="w-full px-3 py-2 rounded-[12px] bg-white border border-[#D0DDFB] text-xs font-bold text-[#0B2E8C] focus:outline-none focus:border-[#0B2E8C]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-black text-[#0B2E8C] mb-1">
                      {selectedSystemPartnerId ? "الحساب المحدد للربط:" : "اختر الحساب للربط التلقائي:"}
                    </label>
                    
                    {selectedSystemPartnerId && (
                      <div className="mb-2 p-2.5 bg-[#F0F4FF] text-[#0B2E8C] rounded-[12px] text-xs font-black flex justify-between items-center border border-[#D0DDFB]">
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
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-black border border-rose-200 px-2 py-0.5 rounded-[8px] bg-white transition cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    )}

                    {isLoadingUnadded ? (
                      <div className="text-xs text-[#1E4DB7]/70 py-2">جاري التحميل...</div>
                    ) : unaddedSystemPartners.length === 0 ? (
                      <div className="text-xs text-[#1E4DB7]/70 font-bold py-1">لا توجد حسابات مسجلة في النظام من هذا النوع</div>
                    ) : (
                      <div className="border border-[#D0DDFB] rounded-[14px] max-h-48 overflow-y-auto divide-y divide-[#D0DDFB]/50 bg-white">
                        {unaddedSystemPartners
                          .filter(item => {
                            if (!systemPartnerSearch.trim()) return true;
                            const query = systemPartnerSearch.toLowerCase().trim();
                            const matchesName = item.name.toLowerCase().includes(query);
                            const matchesPhone = item.phone && item.phone.toLowerCase().includes(query);
                            return matchesName || matchesPhone;
                          })
                          .map((item) => {
                            const isSelected = selectedSystemPartnerId === item.id;
                            const isAlreadyInBook = !!item.isAdded;

                            return (
                              <div
                                key={item.id}
                                className={`w-full text-right px-3 py-2 text-xs transition flex justify-between items-center gap-2 ${
                                  isSelected 
                                    ? "bg-[#F0F4FF] text-[#0B2E8C] font-black border-r-4 border-[#0B2E8C]" 
                                    : isAlreadyInBook
                                      ? "bg-emerald-50/40 hover:bg-emerald-50/70 text-slate-800"
                                      : "hover:bg-[#F0F4FF]/50 text-slate-700"
                                }`}
                              >
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold truncate text-[#0B2E8C]">{item.name}</span>
                                    {item.phone && <span className="text-[10px] text-slate-500" dir="ltr">({item.phone})</span>}
                                  </div>
                                  {isAlreadyInBook && (
                                    <span className="text-[10px] text-emerald-700 font-black flex items-center gap-1">
                                      <span>✅</span>
                                      <span>مضاف مسبقاً في دفتر الديون</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isAlreadyInBook ? (
                                    <Link
                                      href={`/abo1stor3hlaa2kbr8-47/credit-book/${item.creditBookPartnerId}`}
                                      onClick={() => setShowAddModal(false)}
                                      className="px-2.5 py-1 text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-[10px] transition flex items-center gap-1 shadow-2xs"
                                    >
                                      <span>فتح حسابه</span>
                                      <span>↗️</span>
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedSystemPartnerId(item.id);
                                        setNewPartnerName(item.name);
                                        setNewPartnerPhone(item.phone || "");
                                      }}
                                      className={`px-3 py-1 text-[11px] font-black rounded-[10px] transition cursor-pointer ${
                                        isSelected
                                          ? "bg-[#0B2E8C] text-white"
                                          : "bg-[#F0F4FF] hover:bg-[#E2ECFF] text-[#0B2E8C] border border-[#D0DDFB]"
                                      }`}
                                    >
                                      {isSelected ? "محدد ✅" : "اختيار للربط ➕"}
                                    </button>
                                  )}
                                </div>
                              </div>
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
                  className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-[#0B2E8C] hover:bg-[#1E4DB7] rounded-[14px] transition disabled:opacity-50 shadow-[0_3px_10px_rgba(11,46,140,0.22)] active:scale-95 cursor-pointer"
                >
                  {isAdding ? "جاري الحفظ..." : "حفظ الحساب"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-black text-[#0B2E8C] bg-[#F0F4FF] hover:bg-[#E2ECFF] rounded-[14px] transition active:scale-95 cursor-pointer"
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

