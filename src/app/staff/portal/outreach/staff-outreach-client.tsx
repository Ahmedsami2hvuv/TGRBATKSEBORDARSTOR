"use client";

import { useEffect, useState, useTransition, useMemo, useRef } from "react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import {
  getOutreachDataAction,
  createOutreachListAction,
  updateItemStatusAction,
  deleteItemAction,
  clearListAction,
  saveTemplateAction,
  deleteTemplateAction,
  resetDefaultTemplatesAction,
  extractPhonesFromImageWithAIAction,
  bulkDeleteItemsAction,
  bulkUpdateItemStatusAction,
  DEFAULT_OUTREACH_TEMPLATES,
} from "./actions";

interface OutreachItem {
  id: string;
  phone: string;
  originalInput: string;
  status: "pending" | "whatsapp_opened" | "completed";
  templateUsed: string | null;
  openedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface OutreachTemplate {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
}

interface OutreachList {
  id: string;
  title: string;
  createdAt: string;
  items: OutreachItem[];
}

export function StaffOutreachClient({
  staffId,
  token,
  sig,
  authQ,
  icons,
}: {
  staffId: string;
  token: string;
  sig: string;
  authQ: string;
  icons: GlobalIconsConfig | null;
}) {
  const [list, setList] = useState<OutreachList | null>(null);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "templates">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // التحديد المتعدد (Multi-Select)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // معالجة صور الذكاء الاصطناعي
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // النوافذ المنبثقة
  const [showAddListModal, setShowAddListModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedCompletedItem, setSelectedCompletedItem] = useState<OutreachItem | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ id?: string; title: string; content: string } | null>(null);

  // حقول إضافة القائمة
  const [rawTextInput, setRawTextInput] = useState("");
  const [listTitleInput, setListTitleInput] = useState("");
  const [appendToExisting, setAppendToExisting] = useState(false);

  // إشعار سريع
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // مفتاح التخزين المؤقت في المتصفح
  const cacheKey = `kse:outreach:${staffId}`;

  // تحميل البيانات الأولية
  const loadData = async (useCache = true) => {
    if (useCache) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.list) setList(parsed.list);
          if (parsed.templates) setTemplates(parsed.templates);
          setLoading(false);
        }
      } catch {}
    }

    const res = await getOutreachDataAction(staffId, token, sig);
    if (res.ok && res.data) {
      setList(res.data.list);
      setTemplates(res.data.templates);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch {}
    } else if (!useCache) {
      showToast(res.error || "تعذر جلب البيانات");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData(true);
  }, [staffId]);

  // تحديث التخزين المحلي عند تغير القائمة
  useEffect(() => {
    if (list && templates) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ list, templates }));
      } catch {}
    }
  }, [list, templates]);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    if (!list || !list.items) {
      return { total: 0, pending: 0, whatsappOpened: 0, completed: 0, remaining: 0 };
    }
    const total = list.items.length;
    const pending = list.items.filter((i) => i.status === "pending").length;
    const whatsappOpened = list.items.filter((i) => i.status === "whatsapp_opened").length;
    const completed = list.items.filter((i) => i.status === "completed").length;
    const remaining = pending + whatsappOpened;
    return { total, pending, whatsappOpened, completed, remaining };
  }, [list]);

  // تصفية العناصر
  const filteredActiveItems = useMemo(() => {
    if (!list) return [];
    return list.items
      .filter((i) => i.status === "pending" || i.status === "whatsapp_opened")
      .filter((i) => {
        if (!searchQuery.trim()) return true;
        return i.phone.includes(searchQuery.trim()) || i.originalInput.includes(searchQuery.trim());
      });
  }, [list, searchQuery]);

  const filteredCompletedItems = useMemo(() => {
    if (!list) return [];
    return list.items
      .filter((i) => i.status === "completed")
      .filter((i) => {
        if (!searchQuery.trim()) return true;
        return i.phone.includes(searchQuery.trim()) || i.originalInput.includes(searchQuery.trim());
      });
  }, [list, searchQuery]);

  // العناصر الحالية المعروضة بحسب التبويب النشط
  const currentTabItems = activeTab === "active" ? filteredActiveItems : filteredCompletedItems;

  // اختيار نموذج رسالة عشوائي
  const getRandomTemplate = (): OutreachTemplate => {
    const activeTemplates = templates.filter((t) => t.isActive);
    if (activeTemplates.length === 0) {
      return {
        id: "default",
        title: "رسالة ترحيبية",
        content: "مرحباً بك عزيزي الزبون، يسعدنا تواصلك مع أبو الأكبر للتوصيل والخدمات السريعة 🚗📦",
        isActive: true,
      };
    }
    const randomIndex = Math.floor(Math.random() * activeTemplates.length);
    return activeTemplates[randomIndex];
  };

  // التعامل مع النقر على رقم في قائمة العمل
  const handleItemClick = async (item: OutreachItem) => {
    if (isSelectMode) {
      toggleSelectItem(item.id);
      return;
    }

    if (item.status === "pending") {
      // 1. اختيار رسالة عشوائية
      const template = getRandomTemplate();

      // 2. تحديث الحالة فورياً في الواجهة للون الأخضر
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id
              ? { ...i, status: "whatsapp_opened", templateUsed: template.title, openedAt: new Date().toISOString() }
              : i
          ),
        };
      });

      // 3. فتح الواتساب
      const encodedMsg = encodeURIComponent(template.content);
      const whatsappUrl = `https://wa.me/${item.phone}?text=${encodedMsg}`;
      window.open(whatsappUrl, "_blank");

      showToast(`تم فتح الواتساب بنموذج: ${template.title} 💬`);

      // 4. الحفظ في السيرفر بالخلفية
      updateItemStatusAction(staffId, token, sig, {
        itemId: item.id,
        status: "whatsapp_opened",
        templateUsed: template.title,
      });
    } else if (item.status === "whatsapp_opened") {
      // 1. تحديث الحالة للون الأزرق وانتقاله للمكتمل
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id
              ? { ...i, status: "completed", completedAt: new Date().toISOString() }
              : i
          ),
        };
      });

      // 2. توجيه الموظف لتطبيق الاتصال للحفظ
      window.location.href = `tel:${item.phone}`;

      showToast("تم فتح الاتصال للحفظ وتحويل الرقم إلى المكتمل 🔵");

      // 3. الحفظ في السيرفر بالخلفية
      updateItemStatusAction(staffId, token, sig, {
        itemId: item.id,
        status: "completed",
      });
    }
  };

  // التحكم في التحديد الفردي
  const toggleSelectItem = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // تحديد الكل / إلغاء تحديد الكل
  const handleToggleSelectAll = () => {
    if (selectedIds.size === currentTabItems.length && currentTabItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentTabItems.map((i) => i.id)));
    }
  };

  // حذف الأرقام المحددة (Bulk Delete)
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`هل أنت متأكد من مسح ${count} أرقام محددة نهائياً؟`)) return;

    const idsToDelete = Array.from(selectedIds);

    // تحديث الواجهة فورياً
    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((i) => !selectedIds.has(i.id)),
      };
    });

    setSelectedIds(new Set());
    setIsSelectMode(false);
    showToast(`تم مسح ${count} أرقام بنجاح 🗑️`);

    await bulkDeleteItemsAction(staffId, token, sig, { itemIds: idsToDelete });
  };

  // نقل الأرقام المحددة إلى المكتمل (Bulk Complete)
  const handleBulkComplete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const idsToUpdate = Array.from(selectedIds);

    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          selectedIds.has(i.id) ? { ...i, status: "completed", completedAt: new Date().toISOString() } : i
        ),
      };
    });

    setSelectedIds(new Set());
    setIsSelectMode(false);
    showToast(`تم تحويل ${count} أرقام إلى المكتمل 🔵`);

    await bulkUpdateItemStatusAction(staffId, token, sig, { itemIds: idsToUpdate, status: "completed" });
  };

  // إعادة الأرقام المحددة لقائمة العمل (Bulk Reset to Pending)
  const handleBulkResetPending = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const idsToUpdate = Array.from(selectedIds);

    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          selectedIds.has(i.id) ? { ...i, status: "pending", openedAt: null, completedAt: null } : i
        ),
      };
    });

    setSelectedIds(new Set());
    setIsSelectMode(false);
    showToast(`تمت إعادة ${count} أرقام لقائمة العمل 🚀`);

    await bulkUpdateItemStatusAction(staffId, token, sig, { itemIds: idsToUpdate, status: "pending" });
  };

  // معالجة رفع صورة واستخراج الأرقام بالذكاء الاصطناعي (AI OCR)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // إعادة تعيين الـ input ليسمح باختيار نفس الصورة مجدداً إن أراد
    if (fileInputRef.current) fileInputRef.current.value = "";

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setIsAiProcessing(true);
      showToast("جاري فحص الصورة واستخراج الأرقام بالذكاء الاصطناعي... 🤖");

      try {
        const res = await extractPhonesFromImageWithAIAction(staffId, token, sig, base64Data);
        if (res.ok && res.rawText) {
          showToast(`تم استخراج ${res.count} رقم بنجاح بواسطة الذكاء الاصطناعي! ✨`);
          setRawTextInput((prev) => (prev.trim() ? `${prev.trim()}\n${res.rawText}` : res.rawText));
          setShowAddListModal(true);
        } else {
          showToast(res.error || "لم يتمكن الذكاء الاصطناعي من استخراج أرقام من هذه الصورة");
        }
      } catch (err: any) {
        showToast(err?.message || "حدث خطأ أثناء فحص الصورة");
      } finally {
        setIsAiProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // إضافة قائمة جديدة
  const handleCreateList = async () => {
    if (!rawTextInput.trim()) {
      showToast("يرجى لصق قائمة الأرقام أو الروابط أولاً");
      return;
    }

    startTransition(async () => {
      const res = await createOutreachListAction(staffId, token, sig, {
        title: listTitleInput,
        rawText: rawTextInput,
        appendToExisting,
      });

      if (res.ok) {
        showToast(res.message || "تمت إضافة الأرقام بنجاح ✅");
        setRawTextInput("");
        setListTitleInput("");
        setShowAddListModal(false);
        loadData(false);
      } else {
        showToast(res.error || "حدث خطأ أثناء الإضافة");
      }
    });
  };

  // حذف رقم
  const handleDeleteItem = async (itemId: string) => {
    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((i) => i.id !== itemId),
      };
    });
    setSelectedCompletedItem(null);
    showToast("تم حذف الرقم من القائمة");
    await deleteItemAction(staffId, token, sig, { itemId });
  };

  // تفريغ القائمة
  const handleClearList = async (onlyCompleted = false) => {
    if (!list) return;
    const confirmMsg = onlyCompleted
      ? "هل أنت متأكد من مسح جميع الأرقام المكتملة؟"
      : "هل أنت متأكد من مسح جميع الأرقام في هذه القائمة؟";
    if (!window.confirm(confirmMsg)) return;

    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: onlyCompleted ? prev.items.filter((i) => i.status !== "completed") : [],
      };
    });
    showToast("تم مسح الأرقام بنجاح");
    await clearListAction(staffId, token, sig, { listId: list.id, onlyCompleted });
  };

  // حفظ نموذج
  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.title.trim() || !editingTemplate.content.trim()) {
      showToast("يرجى ملء عنوان ونص الرسالة");
      return;
    }

    startTransition(async () => {
      const res = await saveTemplateAction(staffId, token, sig, {
        templateId: editingTemplate.id,
        title: editingTemplate.title,
        content: editingTemplate.content,
      });

      if (res.ok) {
        showToast("تم حفظ النموذج بنجاح ✨");
        setEditingTemplate(null);
        setShowTemplateModal(false);
        loadData(false);
      } else {
        showToast(res.error || "فشل في حفظ النموذج");
      }
    });
  };

  // حذف نموذج
  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا النموذج؟")) return;
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    showToast("تم حذف النموذج");
    await deleteTemplateAction(staffId, token, sig, { templateId });
  };

  // استعادة النماذج الـ 24
  const handleResetTemplates = async () => {
    if (!window.confirm("هل تريد استعادة النماذج الـ 24 الأصلية؟ سيتم استبدال النماذج الحالية.")) return;
    startTransition(async () => {
      const res = await resetDefaultTemplatesAction(staffId, token, sig);
      if (res.ok) {
        showToast("تمت استعادة 24 نموذج بنجاح 🚀");
        loadData(false);
      } else {
        showToast(res.error || "حدث خطأ");
      }
    });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* إشعار عائم Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-slate-900/95 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur border border-white/20 animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* مؤشر فحص الذكاء الاصطناعي للصورة */}
      {isAiProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-md animate-in fade-in">
          <div className="rounded-3xl bg-white p-8 text-center shadow-2xl border border-sky-200 max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-3xl animate-bounce">
              🤖
            </div>
            <h3 className="mt-4 text-base font-black text-slate-900">جاري قراءة الصورة بالذكاء الاصطناعي...</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              يقوم الذكاء الاصطناعي الآن بمسح الصورة واستخراج جميع أرقام الهواتف وروابط الواتساب منها بدقة.
            </p>
            <div className="mt-4 flex justify-center">
              <span className="inline-block h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full w-full bg-sky-500 animate-pulse"></span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* مدخل ملف مخفي لرفع الصورة */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* بطاقة العنوان العلوية مع زر الإضافة السريع وزر الذكاء الاصطناعي */}
      <div className="rounded-3xl bg-gradient-to-br from-sky-600 via-indigo-600 to-purple-700 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-sky-100">
                إدارة مهام التواصل والتسويق
              </span>
              <h1 className="mt-1 text-2xl font-black">مراسلة الزبائن والإعلانات 🎯</h1>
            </div>
            <span className="text-3xl">📱</span>
          </div>

          <p className="mt-2 text-xs font-bold text-sky-100 leading-relaxed">
            مراسلة مئات الزبائن بالواتساب بنماذج عشوائية وحفظ أرقامهم في هاتفك، مع دعم الاستخراج الذكي من الصور.
          </p>

          {/* أزرار الإجراءات السريعة العلوية */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={() => {
                setAppendToExisting(false);
                setShowAddListModal(true);
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-indigo-900 shadow-md transition active:scale-95 hover:bg-slate-50"
            >
              <span>➕</span>
              <span>إضافة قائمة جديدة</span>
            </button>

            {/* زر رفع صورة واستخراج الأرقام بالذكاء الاصطناعي */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 px-4 py-3 text-xs font-black shadow-md transition active:scale-95"
            >
              <span>📷</span>
              <span>استخراج من صورة (AI)</span>
            </button>

            {list && list.items.length > 0 && (
              <button
                onClick={() => {
                  setAppendToExisting(true);
                  setShowAddListModal(true);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 border border-white/30 px-4 py-3 text-xs font-black text-white shadow-sm transition active:scale-95 hover:bg-white/30"
              >
                <span>📥</span>
                <span>دمج أرقام إضافية</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("templates")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-purple-500/40 border border-purple-200/30 px-4 py-3 text-xs font-black text-white shadow-sm transition active:scale-95 hover:bg-purple-500/60"
            >
              <span>📝</span>
              <span>النماذج ({templates.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* شريط الإحصائيات الذكي */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm border border-slate-200">
          <p className="text-[10px] font-black text-slate-400">إجمالي الأرقام</p>
          <p className="mt-1 text-xl font-black text-slate-800">{stats.total}</p>
        </div>

        <div className="rounded-2xl bg-amber-50 p-3 shadow-sm border border-amber-200">
          <p className="text-[10px] font-black text-amber-600">بانتظار البدء</p>
          <p className="mt-1 text-xl font-black text-amber-700">{stats.pending}</p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-3 shadow-sm border border-emerald-200">
          <p className="text-[10px] font-black text-emerald-600">تم الواتساب 🟢</p>
          <p className="mt-1 text-xl font-black text-emerald-700">{stats.whatsappOpened}</p>
        </div>

        <div className="rounded-2xl bg-sky-50 p-3 shadow-sm border border-sky-200">
          <p className="text-[10px] font-black text-sky-600">مكتمل ومخزن 🔵</p>
          <p className="mt-1 text-xl font-black text-sky-700">{stats.completed}</p>
        </div>
      </div>

      {/* التبويبات الرئيسية */}
      <div className="flex rounded-2xl bg-slate-200/70 p-1 font-black text-xs">
        <button
          onClick={() => {
            setActiveTab("active");
            setSelectedIds(new Set());
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition active:scale-95 ${
            activeTab === "active"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🚀 قيد العمل</span>
          {stats.remaining > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white">
              {stats.remaining}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("completed");
            setSelectedIds(new Set());
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition active:scale-95 ${
            activeTab === "completed"
              ? "bg-white text-sky-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🏁 المكتمل</span>
          {stats.completed > 0 && (
            <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] text-white">
              {stats.completed}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("templates");
            setSelectedIds(new Set());
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition active:scale-95 ${
            activeTab === "templates"
              ? "bg-white text-purple-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>📑 النماذج ({templates.length})</span>
        </button>
      </div>

      {/* شريط البحث وخيارات التحديد والإفراغ */}
      {(activeTab === "active" || activeTab === "completed") && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن رقم أو نص..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 pr-9 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-sm focus:border-sky-500 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* زر تفعيل وضع التحديد */}
            {currentTabItems.length > 0 && (
              <button
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) setSelectedIds(new Set());
                }}
                className={`rounded-2xl px-3.5 py-2.5 text-xs font-black transition shadow-sm whitespace-nowrap active:scale-95 ${
                  isSelectMode
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isSelectMode ? "إلغاء التحديد" : "تحديد أرقام ☑️"}
              </button>
            )}

            {list && list.items.length > 0 && !isSelectMode && (
              <button
                onClick={() => handleClearList(activeTab === "completed")}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] font-black text-rose-700 hover:bg-rose-100 active:scale-95 transition whitespace-nowrap shadow-sm"
              >
                {activeTab === "completed" ? "مسح المكتمل 🗑️" : "مسح الكل 🗑️"}
              </button>
            )}
          </div>

          {/* شريط أدوات التحديد المتعدد السريع */}
          {isSelectMode && currentTabItems.length > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-indigo-50 border border-indigo-200 p-3 text-xs font-bold text-indigo-950 animate-in fade-in">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleSelectAll}
                  className="rounded-xl bg-white border border-indigo-300 px-3 py-1.5 text-xs font-black text-indigo-900 shadow-sm active:scale-95 transition"
                >
                  {selectedIds.size === currentTabItems.length ? "إلغاء تحديد الكل" : "تحديد الكل (Select All) ☑️"}
                </button>
                <span>تم تحديد: <strong>{selectedIds.size}</strong> من {currentTabItems.length}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* دليل خطوة بخطوة للموظف */}
      {activeTab === "active" && filteredActiveItems.length > 0 && !isSelectMode && (
        <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-3 text-[11px] font-bold text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <span>
              <strong>طريقة العمل:</strong> انقر أولاً لفتح الواتساب (يصبح أخضر 🟢)، ثم انقر ثانياً لفتح الاتصال لحفظ الرقم (يصبح أزرق 🔵).
            </span>
          </div>
        </div>
      )}

      {/* محتوى التبويب 1: الأرقام الحالية (قيد العمل) */}
      {activeTab === "active" && (
        <div className="space-y-2.5">
          {loading ? (
            <div className="py-12 text-center font-bold text-slate-400">جاري تحميل الأرقام...</div>
          ) : filteredActiveItems.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 p-8 text-center shadow-sm">
              <span className="text-4xl">🎉</span>
              <h3 className="mt-3 text-base font-black text-slate-800">
                {list && list.items.length > 0
                  ? "أحسنت! لا توجد أرقام متبقية في هذه القائمة."
                  : "لا توجد قائمة أرقام حالياً"}
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {list && list.items.length > 0
                  ? "جميع الأرقام تم إكمالها وانتقلت لخانة المكتمل بنجاح."
                  : "انقر على زر (إضافة قائمة جديدة) أو (استخراج من صورة) للبدء فوراً."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => {
                    setAppendToExisting(false);
                    setShowAddListModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-xs font-black text-white shadow-md transition active:scale-95 hover:bg-sky-700"
                >
                  <span>➕</span>
                  <span>إضافة قائمة أرقام أو روابط</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-xs font-black text-slate-900 shadow-md transition active:scale-95 hover:bg-amber-300"
                >
                  <span>📷</span>
                  <span>رفع صورة بالذكاء الاصطناعي</span>
                </button>
              </div>
            </div>
          ) : (
            filteredActiveItems.map((item, index) => {
              const isGreen = item.status === "whatsapp_opened";
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-2xl transition-all duration-200 shadow-md ${
                    isSelected
                      ? "ring-4 ring-indigo-500 border-indigo-600"
                      : ""
                  } ${
                    isGreen
                      ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white border-2 border-emerald-400"
                      : "bg-white text-slate-800 border-2 border-slate-200 hover:border-sky-400"
                  }`}
                >
                  <div className="flex items-center">
                    {/* خانة التحديد في وضع التحديد */}
                    {isSelectMode && (
                      <div className="px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          className="h-5 w-5 rounded-lg border-2 border-slate-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => handleItemClick(item)}
                      className="w-full p-4 text-right flex items-center justify-between gap-3 active:scale-[0.99] transition flex-1"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-inner ${
                            isGreen ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isGreen ? "🟢 2" : `${index + 1}`}
                        </span>

                        <div>
                          <p className={`text-base font-black tracking-wider ${isGreen ? "text-white" : "text-slate-900"}`} dir="ltr">
                            {item.phone}
                          </p>

                          <p className={`text-xs font-bold mt-0.5 flex items-center gap-1.5 ${isGreen ? "text-emerald-100" : "text-slate-500"}`}>
                            {isGreen ? (
                              <span>📞 الخطوة 2: انقر لفتح تطبيق الاتصال وحفظ الرقم</span>
                            ) : (
                              <span>💬 الخطوة 1: انقر لفتح الواتساب بالرسالة الإعلانية</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-left">
                        <span
                          className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black shadow-sm ${
                            isGreen
                              ? "bg-white text-emerald-800 animate-pulse font-black"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isGreen ? "فتح الاتصال 📞" : "فتح الواتساب 💬"}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* محتوى التبويب 2: الأرقام المكتملة */}
      {activeTab === "completed" && (
        <div className="space-y-2.5">
          {filteredCompletedItems.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 p-8 text-center shadow-sm">
              <span className="text-4xl">⏳</span>
              <h3 className="mt-3 text-base font-black text-slate-800">لا توجد أرقام مكتملة بعد</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                عند النقر على الرقم مرتين (واتساب ثم اتصال)، سيتحول للون الأزرق ويظهر هنا.
              </p>
            </div>
          ) : (
            filteredCompletedItems.map((item, index) => {
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md border-2 border-sky-400 transition flex items-center ${
                    isSelected ? "ring-4 ring-indigo-400" : ""
                  }`}
                >
                  {isSelectMode && (
                    <div className="px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        className="h-5 w-5 rounded-lg border-2 border-white text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                  )}

                  <div
                    onClick={() => {
                      if (isSelectMode) toggleSelectItem(item.id);
                      else setSelectedCompletedItem(item);
                    }}
                    className="flex-1 p-4 cursor-pointer flex items-center justify-between active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-xs font-black text-white">
                        ✅ {index + 1}
                      </span>
                      <div>
                        <p className="text-base font-black tracking-wider text-white" dir="ltr">
                          {item.phone}
                        </p>
                        <p className="text-[11px] font-bold text-sky-100 mt-0.5">
                          {item.templateUsed ? `النموذج: ${item.templateUsed}` : "مكتمل ومخزن"}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-black text-white border border-white/30">
                        خيارات ⚙️
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* محتوى التبويب 3: نماذج الرسائل الإعلانية */}
      {activeTab === "templates" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800">النماذج الإعلانية المتوفرة ({templates.length})</h3>
              <p className="text-xs font-bold text-slate-500">
                يتم اختيار نموذج عشوائي تلقائياً عند مراسلة كل زبون لضمان التنويع.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResetTemplates}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-black text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
              >
                استعادة الـ 24 🔄
              </button>
              <button
                onClick={() => {
                  setEditingTemplate({ title: `نموذج إعلاني ${templates.length + 1}`, content: "" });
                  setShowTemplateModal(true);
                }}
                className="rounded-xl bg-purple-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-purple-700 active:scale-95 transition"
              >
                ➕ إضافة نموذج
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {templates.map((tpl, idx) => (
              <div
                key={tpl.id}
                className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 hover:border-purple-300 transition"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-purple-900">
                    {idx + 1}. {tpl.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingTemplate({ id: tpl.id, title: tpl.title, content: tpl.content });
                        setShowTemplateModal(true);
                      }}
                      className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                    >
                      تعديل ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700 hover:bg-rose-100 active:scale-95 transition"
                    >
                      حذف 🗑️
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {tpl.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* شريط الإجراءات العائم السفلي عند تحديد أرقام (Bottom Floating Action Bar) */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-md rounded-3xl bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md border border-white/20 text-white animate-in slide-in-from-bottom-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <span className="text-xs font-black text-sky-400">
              تم تحديد ({selectedIds.size}) أرقام
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] font-bold text-slate-400 hover:text-white"
            >
              إلغاء التحديد ✕
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-rose-600 hover:bg-rose-700 py-3 text-xs font-black text-white shadow-md active:scale-95 transition"
            >
              <span>🗑️</span>
              <span>مسح المحدد ({selectedIds.size})</span>
            </button>

            {activeTab === "active" ? (
              <button
                onClick={handleBulkComplete}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-sky-600 hover:bg-sky-700 py-3 text-xs font-black text-white shadow-md active:scale-95 transition"
              >
                <span>🔵</span>
                <span>تعيين كمكتمل</span>
              </button>
            ) : (
              <button
                onClick={handleBulkResetPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-amber-600 hover:bg-amber-700 py-3 text-xs font-black text-white shadow-md active:scale-95 transition"
              >
                <span>🔄</span>
                <span>إعادة لقائمة العمل</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* نافذة إضافة قائمة جديدة (Modal) */}
      {showAddListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {appendToExisting ? "📥 دمج أرقام إضافية في القائمة الحالية" : "➕ إضافة قائمة أرقام أو روابط جديدة"}
              </h3>
              <button
                onClick={() => setShowAddListModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* زر رفع صورة مباشر داخل النافذة */}
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <span className="text-xl">📷</span>
                  <span>هل لديك صورة أو سكرين شوت تحتوي على أرقام؟</span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-2 text-xs font-black text-slate-950 shadow-sm active:scale-95 transition whitespace-nowrap"
                >
                  استخراج بالذكاء الاصطناعي ✨
                </button>
              </div>

              {!appendToExisting && (
                <div>
                  <label className="text-xs font-black text-slate-700">اسم القائمة (اختياري)</label>
                  <input
                    type="text"
                    value={listTitleInput}
                    onChange={(e) => setListTitleInput(e.target.value)}
                    placeholder="مثال: قائمة زبائن الكرادة والمنصور"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-black text-slate-700">
                  الصق الأرقام أو الروابط هنا (يدعم روابط wa.me وأرقام مختلفة في أسطر)
                </label>
                <textarea
                  rows={8}
                  value={rawTextInput}
                  onChange={(e) => setRawTextInput(e.target.value)}
                  placeholder={`https://wa.me/9647707663735\n07765058901\n07882910055\n+9647812986658\nhttps://wa.me/9647726614525`}
                  className="mt-1 w-full rounded-2xl border border-slate-200 p-3 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none"
                  dir="ltr"
                />
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  ✨ سيقوم النظام تلقائياً بتنظيف الأرقام، استخراجها، ومنع التكرار.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  disabled={isPending}
                  onClick={handleCreateList}
                  className="flex-1 rounded-2xl bg-sky-600 py-3 text-xs font-black text-white shadow-md hover:bg-sky-700 active:scale-95 transition disabled:opacity-50"
                >
                  {isPending ? "جاري المعالجة والإضافة..." : "حفظ واستخراج الأرقام ✅"}
                </button>
                <button
                  onClick={() => setShowAddListModal(false)}
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-xs font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة خيارات الرقم المكتمل (Modal) */}
      {selectedCompletedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-2xl text-sky-700">
              🔵
            </div>

            <h3 className="mt-3 text-lg font-black text-slate-900" dir="ltr">
              {selectedCompletedItem.phone}
            </h3>

            <p className="mt-1 text-xs font-bold text-slate-500">
              هذا الرقم مكتمل. ما الإجراء الذي ترغب بتنفيذه؟
            </p>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  const tpl = getRandomTemplate();
                  const encoded = encodeURIComponent(tpl.content);
                  window.open(`https://wa.me/${selectedCompletedItem.phone}?text=${encoded}`, "_blank");
                  showToast("تم فتح محادثة الواتساب 💬");
                }}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <span>💬</span>
                <span>فتح محادثة الواتساب</span>
              </button>

              <button
                onClick={() => {
                  window.location.href = `tel:${selectedCompletedItem.phone}`;
                }}
                className="w-full rounded-2xl bg-sky-600 py-3 text-xs font-black text-white shadow-md hover:bg-sky-700 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <span>📞</span>
                <span>فتح تطبيق الاتصال</span>
              </button>

              <button
                onClick={() => handleResetItemToPending(selectedCompletedItem)}
                className="w-full rounded-2xl border border-amber-300 bg-amber-50 py-3 text-xs font-black text-amber-800 hover:bg-amber-100 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <span>🔄</span>
                <span>إعادة الرقم لقائمة العمل (غير مكتمل)</span>
              </button>

              <button
                onClick={() => handleDeleteItem(selectedCompletedItem.id)}
                className="w-full rounded-2xl border border-rose-200 bg-rose-50 py-3 text-xs font-black text-rose-700 hover:bg-rose-100 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>حذف من القائمة نهائياً</span>
              </button>

              <button
                onClick={() => setSelectedCompletedItem(null)}
                className="w-full rounded-2xl bg-slate-100 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-200 active:scale-95 transition mt-2"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة وتعديل النموذج (Modal) */}
      {showTemplateModal && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingTemplate.id ? "✏️ تعديل النموذج الإعلاني" : "➕ إضافة نموذج إعلاني جديد"}
              </h3>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-700">عنوان النموذج</label>
                <input
                  type="text"
                  value={editingTemplate.title}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  placeholder="مثال: نموذج عروض نهاية الأسبوع"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700">نص الرسالة الإعلانية</label>
                <textarea
                  rows={6}
                  value={editingTemplate.content}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  placeholder="اكتب نص الرسالة هنا..."
                  className="mt-1 w-full rounded-2xl border border-slate-200 p-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  disabled={isPending}
                  onClick={handleSaveTemplate}
                  className="flex-1 rounded-2xl bg-purple-600 py-3 text-xs font-black text-white shadow-md hover:bg-purple-700 active:scale-95 transition disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ..." : "حفظ النموذج ✅"}
                </button>
                <button
                  onClick={() => {
                    setShowTemplateModal(false);
                    setEditingTemplate(null);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-xs font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
