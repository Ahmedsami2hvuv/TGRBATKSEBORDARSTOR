"use client";

import { useEffect, useState, useTransition, useMemo, useRef } from "react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DEFAULT_OUTREACH_TEMPLATES } from "./constants";

interface OutreachItem {
  id: string;
  phone: string;
  originalInput: string;
  status: "pending" | "whatsapp_opened" | "completed";
  templateUsed: string | null;
  source?: string;
  availableAt?: string | null;
  priority?: number;
  openedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  isDuplicateHistory?: boolean;
  duplicateSource?: string;
  isExistingCustomer?: boolean;
  regions?: string[];
  ordersCount?: number;
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

  // معالجة صور الذكاء الاصطناعي المتعددة التدريجية
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ current: number; total: number; count: number }>({
    current: 0,
    total: 0,
    count: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

  // النوافذ المنبثقة
  const [showAddListModal, setShowAddListModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showAiSummaryModal, setShowAiSummaryModal] = useState(false);
  const [aiSummaryData, setAiSummaryData] = useState<{
    totalExtracted: number;
    newCount: number;
    newUsernamesCount: number;
    newPhonesCount: number;
    duplicateCompletedCount: number;
    duplicateCompletedPhones: string[];
    duplicateActiveCount: number;
    reactivatedCount: number;
  } | null>(null);
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

  // دالة الاتصال المباشر والآمن بالـ API
  const callApi = async (action: string, payload: any = {}) => {
    try {
      const res = await fetch("/api/staff/outreach/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffEmployeeId: staffId,
          token,
          sig,
          action,
          payload,
        }),
      });
      return await res.json();
    } catch (err: any) {
      return { ok: false, error: err?.message || "فشل الاتصال بالخادم" };
    }
  };

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

    const res = await callApi("get_data");
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

  // فحص هل حان موعد ظهور العنصر (أو ليس له موعد مؤجل)
  const isItemAvailable = (item: OutreachItem) => {
    if (!item.availableAt) return true;
    return new Date(item.availableAt).getTime() <= Date.now();
  };

  // حساب الإحصائيات مع إحصائيات التكرار والزبائن السابقين
  const stats = useMemo(() => {
    if (!list || !list.items) {
      return { total: 0, pending: 0, whatsappOpened: 0, completed: 0, remaining: 0, existingCustomers: 0, duplicates: 0 };
    }
    const availableItems = list.items.filter(isItemAvailable);
    const total = availableItems.length;
    const pending = availableItems.filter((i) => i.status === "pending").length;
    const whatsappOpened = availableItems.filter((i) => i.status === "whatsapp_opened").length;
    const completed = availableItems.filter((i) => i.status === "completed").length;
    const remaining = pending + whatsappOpened;
    const existingCustomers = availableItems.filter((i) => i.isExistingCustomer).length;
    const duplicates = availableItems.filter((i) => i.isDuplicateHistory).length;
    return { total, pending, whatsappOpened, completed, remaining, existingCustomers, duplicates };
  }, [list]);

  // دالة الفرز الصارم المتطابق مع السيرفر وتطبيق الهاتف
  const sortOutreachItems = (a: OutreachItem, b: OutreachItem) => {
    const prioA = a.priority ?? 0;
    const prioB = b.priority ?? 0;
    if (prioB !== prioA) return prioB - prioA;
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  };

  // تصفية وترتيب العناصر النشطة من الأعلى للأسفل
  const filteredActiveItems = useMemo(() => {
    if (!list) return [];
    return list.items
      .filter(isItemAvailable)
      .filter((i) => i.status === "pending" || i.status === "whatsapp_opened")
      .sort(sortOutreachItems)
      .filter((i) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          i.phone.toLowerCase().includes(q) ||
          i.originalInput.toLowerCase().includes(q) ||
          (i.regions && i.regions.some((r) => r.toLowerCase().includes(q)))
        );
      });
  }, [list, searchQuery]);

  const filteredCompletedItems = useMemo(() => {
    if (!list) return [];
    return list.items
      .filter(isItemAvailable)
      .filter((i) => i.status === "completed")
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
      .filter((i) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          i.phone.toLowerCase().includes(q) ||
          i.originalInput.toLowerCase().includes(q) ||
          (i.regions && i.regions.some((r) => r.toLowerCase().includes(q)))
        );
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

  const normalizeWaPhone = (p: string) => {
    let clean = (p || "").replace(/\D/g, "");
    while (clean.startsWith("00")) clean = clean.substring(2);
    if (clean.startsWith("964") && clean.length >= 12) return clean;
    if (clean.startsWith("07") && clean.length === 11) return "964" + clean.substring(1);
    if (clean.startsWith("7") && clean.length === 10) return "964" + clean;
    return clean;
  };

  // التعامل مع النقر على رقم أو يوزر في قائمة العمل
  const handleItemClick = async (item: OutreachItem) => {
    if (isSelectMode) {
      toggleSelectItem(item.id);
      return;
    }

    const isUserOnly = item.phone.startsWith("@") || /[a-zA-Z]/.test(item.phone);

    // إذا كان يوزراً فقط: يفتح الواتساب ويكتمل مباشرة بنقرة واحدة
    if (isUserOnly) {
      const template = getRandomTemplate();
      const encodedMsg = encodeURIComponent(template.content);
      const cleanTarget = item.phone.replace(/^@/, "").trim();
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanTarget}&text=${encodedMsg}`;
      
      // فتح الواتساب مباشرة
      window.location.href = whatsappUrl;

      // تحويله للمكتمل فوراً في الواجهة
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id
              ? { ...i, status: "completed", templateUsed: template.title, completedAt: new Date().toISOString() }
              : i
          ),
        };
      });

      showToast(`تم فتح الواتساب لليوزر (${item.phone}) واكتملت المهمة مباشرة 🔵`);

      callApi("update_status", {
        itemId: item.id,
        status: "completed",
        templateUsed: template.title,
      });
      return;
    }

    // إذا كان رقماً هاتفياً
    if (item.status === "pending") {
      // 1. اختيار رسالة عشوائية
      const template = getRandomTemplate();
      const waPhone = normalizeWaPhone(item.phone);
      const encodedMsg = encodeURIComponent(template.content);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodedMsg}`;

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

      // 3. فتح الواتساب مباشرة
      window.location.href = whatsappUrl;

      showToast(`تم فتح الواتساب بنموذج: ${template.title} 💬`);

      // 4. الحفظ في السيرفر بالخلفية
      callApi("update_status", {
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
      callApi("update_status", {
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

    await callApi("bulk_delete", { itemIds: idsToDelete });
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

    await callApi("bulk_update", { itemIds: idsToUpdate, status: "completed" });
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

    await callApi("bulk_update", { itemIds: idsToUpdate, status: "pending" });
  };

  // دالة ضغط وتصغير الصورة في المتصفح
  const compressImage = async (file: File, maxDim = 1280, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedBase64);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // معالجة رفع صور متعددة (حتى 100 صورة) واستخراج الأرقام تدريجياً
  const handleMultipleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files).slice(0, 100); // دعم حتى 100 صورة
    const totalFiles = fileList.length;

    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsAiProcessing(true);
    setAiProgress({ current: 1, total: totalFiles, count: 0 });
    showToast(`بدء فحص ${totalFiles} صورة بالذكاء الاصطناعي بشكل تدريجي... 🤖`);

    let totalExtractedSum = 0;
    let newCountSum = 0;
    let newUsernamesSum = 0;
    let newPhonesSum = 0;
    let duplicateCompletedSum = 0;
    const duplicateCompletedPhonesSet = new Set<string>();
    let duplicateActiveSum = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      setAiProgress({ current: i + 1, total: totalFiles, count: totalExtractedSum });

      try {
        // ضغط الصورة
        const compressedBase64 = await compressImage(file);

        // إرسال الصورة للذكاء الاصطناعي
        const response = await fetch("/api/staff/outreach/ai-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffEmployeeId: staffId,
            token,
            sig,
            imageBase64: compressedBase64,
          }),
        });

        const data = await response.json();
        if (response.ok && data.ok && data.rawText) {
          // حفظ فوري وتلقائي في قاعدة البيانات السحابية مع الحصول على التصنيف الدقيق
          const saveRes = await callApi("create_list", {
            rawText: data.rawText,
            appendToExisting: true,
          });

          if (saveRes.ok && saveRes.summary) {
            totalExtractedSum += saveRes.summary.totalExtracted || 0;
            newCountSum += saveRes.summary.newCount || 0;
            newUsernamesSum += saveRes.summary.newUsernamesCount || 0;
            newPhonesSum += saveRes.summary.newPhonesCount || 0;
            duplicateCompletedSum += saveRes.summary.duplicateCompletedCount || 0;
            if (saveRes.summary.duplicateCompletedPhones) {
              for (const p of saveRes.summary.duplicateCompletedPhones) {
                duplicateCompletedPhonesSet.add(p);
              }
            }
            duplicateActiveSum += saveRes.summary.duplicateActiveCount || 0;
          } else {
            totalExtractedSum += data.count || 0;
          }

          setAiProgress({ current: i + 1, total: totalFiles, count: totalExtractedSum });
        }
      } catch (err) {
        console.error("Error processing image index:", i, err);
      }
    }

    setIsAiProcessing(false);

    if (totalExtractedSum > 0) {
      const summaryObj = {
        totalExtracted: totalExtractedSum,
        newCount: newCountSum,
        newUsernamesCount: newUsernamesSum,
        newPhonesCount: newPhonesSum,
        duplicateCompletedCount: duplicateCompletedSum,
        duplicateCompletedPhones: Array.from(duplicateCompletedPhonesSet),
        duplicateActiveCount: duplicateActiveSum,
        reactivatedCount: 0,
      };
      setAiSummaryData(summaryObj);
      setShowAiSummaryModal(true);
      await loadData(false);
    } else {
      showToast("تم فحص الصور ولكن لم يتم العثور على أرقام أو يوزرات واضحة.");
    }
  };

  // إعادة تنشيط الأرقام المكتملة المستخرجة بالذكاء الاصطناعي
  const handleReactivateCompletedFromAi = async () => {
    if (!aiSummaryData || aiSummaryData.duplicateCompletedPhones.length === 0) return;
    const phones = aiSummaryData.duplicateCompletedPhones;

    startTransition(async () => {
      const res = await callApi("reactivate_completed", { phones });
      if (res.ok) {
        showToast(`تم نقل ${res.count || phones.length} رقم من المكتمل إلى قيد العمل بنجاح 🚀`);
        setShowAiSummaryModal(false);
        setActiveTab("active");
        await loadData(false);
      } else {
        showToast(res.error || "حدث خطأ أثناء النقل");
      }
    });
  };

  // إضافة قائمة جديدة
  const handleCreateList = async () => {
    if (!rawTextInput.trim()) {
      showToast("يرجى لصق قائمة الأرقام أو الروابط أولاً");
      return;
    }

    startTransition(async () => {
      const res = await callApi("create_list", {
        title: listTitleInput,
        rawText: rawTextInput,
        appendToExisting,
      });

      if (res.ok) {
        showToast(res.message || "تمت إضافة الأرقام بنجاح ✅");
        setRawTextInput("");
        setListTitleInput("");
        setShowAddListModal(false);
        setActiveTab("active");
        setSelectedIds(new Set());
        setSearchQuery("");
        await loadData(false);
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
    await callApi("delete_item", { itemId });
  };

  // إعادة الرقم للعمل
  const handleResetItemToPending = async (item: OutreachItem) => {
    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) => (i.id === item.id ? { ...i, status: "pending" } : i)),
      };
    });
    setSelectedCompletedItem(null);
    showToast("تمت إعادة الرقم لقائمة العمل");
    await callApi("update_status", { itemId: item.id, status: "pending" });
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
    await callApi("clear_list", { listId: list.id, onlyCompleted });
  };

  // حفظ نموذج
  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.content.trim()) {
      showToast("يرجى كتابة أو لصق نص الرسالة");
      return;
    }

    const tplContent = editingTemplate.content.trim();
    let tplTitle = editingTemplate.title.trim();
    if (!tplTitle) {
      const firstLine = tplContent.split("\n")[0].trim();
      tplTitle = firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine || "نموذج رسالة";
    }
    const tplId = editingTemplate.id;

    startTransition(async () => {
      const res = await callApi("save_template", {
        templateId: tplId,
        title: tplTitle,
        content: tplContent,
      });

      if (res.ok) {
        showToast("تم حفظ النموذج بنجاح ✨");
        setShowTemplateModal(false);
        setEditingTemplate(null);
        await loadData(false);
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
    await callApi("delete_template", { templateId });
    await loadData(false);
  };

  // مسح جميع النماذج
  const handleClearAllTemplates = async () => {
    if (!window.confirm("هل تريد مسح جميع النماذج الإعلانية؟")) return;
    startTransition(async () => {
      const res = await callApi("reset_templates");
      if (res.ok) {
        setTemplates([]);
        showToast("تم مسح جميع النماذج بنجاح 🗑️");
        await loadData(false);
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

      {/* مؤشر فحص الذكاء الاصطناعي للصور المتعددة التدريجي */}
      {isAiProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md animate-in fade-in">
          <div className="rounded-3xl bg-white p-6 text-center shadow-2xl border border-sky-200 max-w-sm w-full">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-3xl animate-bounce">
              🤖
            </div>
            <h3 className="mt-3 text-base font-black text-slate-900">
              جاري فحص الصور بالذكاء الاصطناعي...
            </h3>
            <p className="mt-1 text-xs font-bold text-sky-700">
              فحص الصورة <strong>{aiProgress.current}</strong> من أصل <strong>{aiProgress.total}</strong>
            </p>
            <p className="text-[11px] font-bold text-slate-500 mt-1">
              تم استخراج <strong>{aiProgress.count}</strong> رقماً ومعرفاً حتى الآن ✨
            </p>

            {/* شريط تقدم تفاعلي */}
            <div className="mt-4 w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
              <div
                className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((aiProgress.current / Math.max(1, aiProgress.total)) * 100)}%`,
                }}
              ></div>
            </div>
            <p className="mt-2 text-[10px] font-bold text-slate-400">
              {Math.round((aiProgress.current / Math.max(1, aiProgress.total)) * 100)}% مكتمل
            </p>
          </div>
        </div>
      )}

      {/* مدخل ملف مخفي يدعم حتى 100 صورة دفعة واحدة */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleMultipleImagesUpload}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* شريط التحكم العلوي المدمج والأنيق */}
      <div className="rounded-2xl bg-white p-3 shadow-sm border border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-lg">📱</span>
          <div className="min-w-0">
            <h1 className="text-xs font-black text-slate-900 truncate">مراسلة الزبائن</h1>
            <p className="text-[10px] font-bold text-slate-500">
              {stats.remaining > 0 ? `باقي ${stats.remaining} رقم` : "لا توجد أرقام متبقية"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* زر رفع الصور بالذكاء الاصطناعي السريع */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 px-3 py-2 text-[11px] font-black shadow-sm transition active:scale-95"
          >
            <span>📷</span>
            <span>صور AI</span>
          </button>

          {/* زر إضافة أرقام جديدة */}
          <button
            onClick={() => {
              setAppendToExisting(false);
              setShowAddListModal(true);
            }}
            className="flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-[11px] font-black shadow-sm transition active:scale-95"
          >
            <span>➕</span>
            <span>إضافة</span>
          </button>

          {/* زر الخيارات الموحد */}
          <button
            onClick={() => setShowOptionsMenu(true)}
            className="flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 text-[11px] font-black transition active:scale-95 border border-slate-200"
          >
            <span>⚙️</span>
            <span>الخيارات</span>
          </button>
        </div>
      </div>

      {/* التبويبات الرئيسية المباشرة (قيد العمل والمكتمل) */}
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

        {activeTab === "templates" && (
          <button
            onClick={() => {
              setActiveTab("templates");
              setSelectedIds(new Set());
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition active:scale-95 bg-white text-purple-900 shadow-sm"
          >
            <span>📑 النماذج ({templates.length})</span>
          </button>
        )}
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
                placeholder="ابحث عن رقم، يوزر، أو منطقة..."
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
                  : "انقر على زر (إضافة قائمة جديدة) أو (رفع صور بالذكاء الاصطناعي) للبدء فوراً."}
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
                  <span>رفع صور (حتى 100 صورة AI)</span>
                </button>
              </div>
            </div>
          ) : (
            filteredActiveItems.map((item, index) => {
              const isGreen = item.status === "whatsapp_opened";
              const isSelected = selectedIds.has(item.id);
              const isUserOnly = item.phone.startsWith("@") || /[a-zA-Z]/.test(item.phone);

              return (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-2xl transition-all duration-200 shadow-md ${
                    isSelected ? "ring-4 ring-indigo-500 border-indigo-600" : ""
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
                            isGreen
                              ? "bg-white/20 text-white"
                              : isUserOnly
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isGreen ? "🟢 2" : isUserOnly ? "@" : `${index + 1}`}
                        </span>

                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* رقم الهاتف أو اليوزر */}
                            <p className={`text-base font-black tracking-wider ${isGreen ? "text-white" : "text-slate-900"}`} dir="ltr">
                              {item.phone}
                            </p>

                            {/* شارة زبون تقييم بعد 24 ساعة */}
                            {(item.source === "evaluation" || (item.priority && item.priority >= 10)) && (
                              <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-900 shadow-sm flex items-center gap-1">
                                <span>⭐</span>
                                <span>تقييم سابق (أولوية قصوى)</span>
                              </span>
                            )}

                            {/* شارة اليوزر */}
                            {isUserOnly && (
                              <span className="rounded-full bg-purple-100 border border-purple-300 px-2 py-0.5 text-[10px] font-black text-purple-800">
                                👤 يوزر
                              </span>
                            )}

                            {/* تنبيه الرقم المكرر */}
                            {item.isDuplicateHistory && (
                              <span className="rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-black text-rose-800 animate-pulse">
                                ⚠️ مكرر سابقاً ({item.duplicateSource})
                              </span>
                            )}

                            {/* شارة الزبون السابق والمناطق */}
                            {item.isExistingCustomer && (
                              <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-emerald-900">
                                🛍️ زبون سابق ({item.ordersCount} طلبات)
                              </span>
                            )}
                          </div>

                          {/* عرض المناطق المسجلة للزبون */}
                          {item.regions && item.regions.length > 0 && (
                            <p className="text-[11px] font-black text-sky-700 mt-1 flex items-center gap-1">
                              <span>📍 المنطقة:</span>
                              <span className="bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-lg">
                                {item.regions.join(" / ")}
                              </span>
                            </p>
                          )}

                          {/* نص الخطوة والإجراء */}
                          <p className={`text-xs font-bold mt-1 flex items-center gap-1.5 ${isGreen ? "text-emerald-100" : "text-slate-500"}`}>
                            {isUserOnly ? (
                              <span>💬 يوزر واتساب: انقر للمراسلة (اكتمال فوري)</span>
                            ) : isGreen ? (
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
                              : isUserOnly
                              ? "bg-purple-600 text-white"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isGreen ? "فتح الاتصال 📞" : isUserOnly ? "واتساب (فوري) 💬" : "فتح الواتساب 💬"}
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
                عند إكمال مراسلة الرقم أو اليوزر، سيتحول للون الأزرق ويظهر هنا.
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
                        <div className="flex items-center gap-2">
                          <p className="text-base font-black tracking-wider text-white" dir="ltr">
                            {item.phone}
                          </p>
                          {item.regions && item.regions.length > 0 && (
                            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black">
                              📍 {item.regions.join(" / ")}
                            </span>
                          )}
                        </div>
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
              <h3 className="text-sm font-black text-slate-800">النماذج الإعلانية الخاصة بك ({templates.length})</h3>
              <p className="text-xs font-bold text-slate-500">
                أضف نماذج الرسائل التي ترغب بإرسالها للزبائن عبر الواتساب.
              </p>
            </div>
            <div className="flex gap-2">
              {templates.length > 0 && (
                <button
                  onClick={handleClearAllTemplates}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 shadow-sm hover:bg-rose-100 active:scale-95 transition"
                >
                  مسح الكل 🗑️
                </button>
              )}
              <button
                onClick={() => {
                  setEditingTemplate({ title: "", content: "" });
                  setShowTemplateModal(true);
                }}
                className="rounded-xl bg-purple-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-purple-700 active:scale-95 transition"
              >
                ➕ إضافة نموذج
              </button>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-purple-200 bg-purple-50/50 p-8 text-center">
              <span className="text-4xl">📝</span>
              <h4 className="mt-2 text-sm font-black text-purple-950">لا توجد نماذج إعلانية حالياً</h4>
              <p className="mt-1 text-xs font-bold text-purple-700">
                اضغط على زر «➕ إضافة نموذج» باللون البنفسجي لإضافة نص رسالتك الخاصة.
              </p>
              <button
                onClick={() => {
                  setEditingTemplate({ title: "", content: "" });
                  setShowTemplateModal(true);
                }}
                className="mt-4 inline-flex items-center gap-1 rounded-2xl bg-purple-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-purple-700 active:scale-95 transition"
              >
                ➕ إضافة أول نموذج الآن
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((tpl, idx) => (
                <div
                  key={tpl.id}
                  className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 hover:border-purple-300 transition"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-purple-900 line-clamp-1">
                      {tpl.title || tpl.content.split("\n")[0] || `نموذج ${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
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
          )}
        </div>
      )}

      {/* شريط الإجراءات العائم السفلي عند تحديد أرقام */}
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

      {/* نافذة إضافة قائمة جديدة */}
      {showAddListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {appendToExisting ? "📥 دمج أرقام إضافية في القائمة الحالية" : "➕ إضافة قائمة أرقام أو يوزرات جديدة"}
              </h3>
              <button
                onClick={() => setShowAddListModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* زر رفع حتى 100 صورة داخل النافذة */}
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <span className="text-xl">📷</span>
                  <span>رفع صور (حتى 100 صورة سكرين شوت أو كاميرا)</span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-2 text-xs font-black text-slate-950 shadow-sm active:scale-95 transition whitespace-nowrap"
                >
                  رفع الصور واستخراجها ✨
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
                  الصق الأرقام أو اليوزرات أو الروابط هنا (يدعم روابط wa.me، يوزرات @username، وأرقام)
                </label>
                <textarea
                  rows={8}
                  value={rawTextInput}
                  onChange={(e) => setRawTextInput(e.target.value)}
                  placeholder={`https://wa.me/9647707663735\n@sarah_user\n07765058901\nhttps://wa.me/user_ahmed\n+9647812986658`}
                  className="mt-1 w-full rounded-2xl border border-slate-200 p-3 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none"
                  dir="ltr"
                />
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  ✨ سيقوم النظام تلقائياً بتنظيف الأرقام واليوزرات، فحص التكرارات السابقة، ومطابقة الزبائن.
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

      {/* نافذة خيارات الرقم المكتمل */}
      {selectedCompletedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-2xl text-sky-700">
              🔵
            </div>

            <h3 className="mt-3 text-lg font-black text-slate-900" dir="ltr">
              {selectedCompletedItem.phone}
            </h3>

            {selectedCompletedItem.regions && selectedCompletedItem.regions.length > 0 && (
              <p className="mt-1 text-xs font-black text-sky-700">
                📍 المنطقة: {selectedCompletedItem.regions.join(" / ")}
              </p>
            )}

            <p className="mt-1 text-xs font-bold text-slate-500">
              هذا الرقم مكتمل. ما الإجراء الذي ترغب بتنفيذه؟
            </p>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  const tpl = getRandomTemplate();
                  const encoded = encodeURIComponent(tpl.content);
                  const isUser = selectedCompletedItem.phone.startsWith("@") || /[a-zA-Z]/.test(selectedCompletedItem.phone);
                  const target = isUser
                    ? selectedCompletedItem.phone.replace(/^@/, "").trim()
                    : normalizeWaPhone(selectedCompletedItem.phone);
                  window.location.href = `https://api.whatsapp.com/send?phone=${target}&text=${encoded}`;
                  showToast("تم فتح محادثة الواتساب 💬");
                }}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <span>💬</span>
                <span>فتح محادثة الواتساب</span>
              </button>

              {selectedCompletedItem.phone.startsWith("@") || /[a-zA-Z]/.test(selectedCompletedItem.phone) ? (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedCompletedItem.phone);
                    showToast(`تم نسخ المعرف (${selectedCompletedItem.phone}) بنجاح 📋`);
                  }}
                  className="w-full rounded-2xl bg-sky-600 py-3 text-xs font-black text-white shadow-md hover:bg-sky-700 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <span>📋</span>
                  <span>نسخ المعرف لحفظه</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    window.location.href = `tel:${selectedCompletedItem.phone}`;
                  }}
                  className="w-full rounded-2xl bg-sky-600 py-3 text-xs font-black text-white shadow-md hover:bg-sky-700 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <span>📞</span>
                  <span>فتح تطبيق الاتصال</span>
                </button>
              )}

              <button
                onClick={() => handleResetItemToPending(selectedCompletedItem)}
                className="w-full rounded-2xl border border-amber-300 bg-amber-50 py-3 text-xs font-black text-amber-800 hover:bg-amber-100 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <span>🔄</span>
                <span>إعادة لقائمة العمل (غير مكتمل)</span>
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

      {/* نافذة إضافة وتعديل النموذج */}
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">عنوان النموذج (اختياري)</label>
                  <span className="text-[10px] font-bold text-slate-400">إذا تركته فارغاً سيأخذ أول سطر تلقائياً</span>
                </div>
                <input
                  type="text"
                  value={editingTemplate.title}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  placeholder="مثال: عروض التوصيل (أو اتركه فارغاً)"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-purple-500 focus:outline-none placeholder-slate-300"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-700">نص الرسالة الإعلانية</label>
                <textarea
                  ref={templateTextareaRef}
                  rows={7}
                  dir="rtl"
                  value={editingTemplate.content}
                  onPaste={(e) => {
                    const text = e.clipboardData?.getData("text");
                    if (text !== undefined) {
                      e.preventDefault();
                      setEditingTemplate((prev) => (prev ? { ...prev, content: text } : null));
                      setTimeout(() => {
                        if (templateTextareaRef.current) {
                          templateTextareaRef.current.focus();
                          templateTextareaRef.current.setSelectionRange(0, 0);
                          templateTextareaRef.current.scrollTop = 0;
                        }
                      }, 10);
                    }
                  }}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  placeholder="الصق أو اكتب نص الرسالة هنا..."
                  className="mt-1 w-full rounded-2xl border border-slate-200 p-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:outline-none leading-relaxed"
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
      {/* نافذة الخيارات الموحدة */}
      {showOptionsMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="text-base font-black text-slate-900">خيارات مهمة التواصل والإحصائيات</h3>
              </div>
              <button
                onClick={() => setShowOptionsMenu(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 text-sm font-black"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {/* بطاقات الإحصائيات الشاملة */}
              <div>
                <h4 className="text-xs font-black text-slate-500 mb-2">📊 إحصائيات التواصل</h4>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200">
                    <p className="text-[10px] font-black text-slate-500">إجمالي الأرقام واليوزرات</p>
                    <p className="mt-1 text-lg font-black text-slate-800">{stats.total}</p>
                    {stats.existingCustomers > 0 && (
                      <span className="mt-1 inline-block text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        🛍️ {stats.existingCustomers} زبون سابق
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl bg-amber-50 p-3 border border-amber-200">
                    <p className="text-[10px] font-black text-amber-600">بانتظار البدء</p>
                    <p className="mt-1 text-lg font-black text-amber-700">{stats.pending}</p>
                    {stats.duplicates > 0 && (
                      <span className="mt-1 inline-block text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">
                        ⚠️ {stats.duplicates} مكرر
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl bg-emerald-50 p-3 border border-emerald-200">
                    <p className="text-[10px] font-black text-emerald-600">تم الواتساب 🟢</p>
                    <p className="mt-1 text-lg font-black text-emerald-700">{stats.whatsappOpened}</p>
                  </div>

                  <div className="rounded-2xl bg-sky-50 p-3 border border-sky-200">
                    <p className="text-[10px] font-black text-sky-600">مكتمل ومخزن 🔵</p>
                    <p className="mt-1 text-lg font-black text-sky-700">{stats.completed}</p>
                  </div>
                </div>
              </div>

              {/* قسم التنبيهات والمؤقت التلقائي في تطبيق الموظف */}
              <div>
                <h4 className="text-xs font-black text-slate-500 mb-2">⏰ وضع المؤقت التلقائي وتطبيق الموظف</h4>
                <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 p-3.5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl">⚡</span>
                    <div>
                      <p className="text-xs font-black text-indigo-950">التذكير والمراسلة التلقائية</p>
                      <p className="text-[11px] font-bold text-slate-600 mt-0.5 leading-relaxed">
                        لتلقي إشعارات دورية تلقائية بأرقام الزبائن: افتح <strong>تطبيق الموظف</strong>، وانقر على المساعد العائم ⚡ ثم اختر <strong>&quot;إعدادات المؤقتات والتنبيهات ⏰&quot;</strong> وفعل مؤقت المراسلة واضبط الدقائق بحرية.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* إدارة النماذج */}
              <div>
                <h4 className="text-xs font-black text-slate-500 mb-2">📑 النماذج الإعلانية</h4>
                <button
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setActiveTab("templates");
                  }}
                  className="w-full flex items-center justify-between rounded-2xl bg-purple-50 border border-purple-200 p-3.5 text-xs font-black text-purple-900 hover:bg-purple-100 transition active:scale-95 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>📝</span>
                    <span>استعراض وتعديل النماذج ({templates.length})</span>
                  </div>
                  <span>←</span>
                </button>
              </div>

              {/* أدوات وإجراءات القائمة */}
              <div>
                <h4 className="text-xs font-black text-slate-500 mb-2">📥 إجراءات القائمة</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setAppendToExisting(false);
                      setShowAddListModal(true);
                    }}
                    className="w-full flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs font-black text-slate-800 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span>📋</span>
                      <span>إنشاء قائمة أرقام جديدة</span>
                    </div>
                    <span>➕</span>
                  </button>

                  {list && list.items.length > 0 && (
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setAppendToExisting(true);
                        setShowAddListModal(true);
                      }}
                      className="w-full flex items-center justify-between rounded-2xl bg-indigo-50 border border-indigo-200 p-3 text-xs font-black text-indigo-900 hover:bg-indigo-100 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span>📥</span>
                        <span>دمج أرقام إضافية في القائمة الحالية</span>
                      </div>
                      <span>➕</span>
                    </button>
                  )}

                  {list && list.items.length > 0 && (
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        handleClearList(true);
                      }}
                      className="w-full flex items-center justify-between rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-black text-rose-700 hover:bg-rose-100 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span>🗑️</span>
                        <span>مسح الأرقام المكتملة فقط ({stats.completed})</span>
                      </div>
                      <span>تنظيف</span>
                    </button>
                  )}

                  {list && list.items.length > 0 && (
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false);
                        handleClearList(false);
                      }}
                      className="w-full flex items-center justify-between rounded-2xl bg-rose-100 border border-rose-300 p-3 text-xs font-black text-rose-800 hover:bg-rose-200 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>مسح وتفريغ القائمة بالكامل ({stats.total})</span>
                      </div>
                      <span>مسح الكل</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowOptionsMenu(false)}
                  className="w-full rounded-2xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-slate-800 transition active:scale-95"
                >
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تقرير نتائج فحص واستخراج الصور بالذكاء الاصطناعي */}
      {showAiSummaryModal && aiSummaryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-sky-100 max-h-[90vh] overflow-y-auto">
            {/* الأيقونة العلوية */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-3xl shadow-lg shadow-sky-200">
              🤖
            </div>

            {/* العنوان */}
            <div className="mt-3 text-center">
              <h3 className="text-base font-black text-slate-900">
                تقرير فحص الصور بالذكاء الاصطناعي
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                تم الانتهاء من فحص الصور واستخراج المعرفات والأرقام بدقة
              </p>
            </div>

            {/* شبكة الإحصائيات التوضيحية */}
            <div className="mt-4 space-y-2.5">
              {/* إجمالي المستخرج */}
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📷</span>
                  <span className="text-xs font-black text-slate-700">إجمالي ما تم استخراجه من الصور</span>
                </div>
                <span className="text-sm font-black text-slate-900 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-sm">
                  {aiSummaryData.totalExtracted}
                </span>
              </div>

              {/* أرقام جديدة دخلت قيد العمل */}
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🟢</span>
                    <div>
                      <h4 className="text-xs font-black text-emerald-900">أرقام ويوزرات جديدة دخلت قيد العمل</h4>
                      <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                        جاهزة الآن لبدء التواصل معها فوراً
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-black text-emerald-800 bg-white px-3 py-1 rounded-xl border border-emerald-300 shadow-sm">
                    {aiSummaryData.newCount}
                  </span>
                </div>

                {aiSummaryData.newCount > 0 && (
                  <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-emerald-200/60 text-[11px] font-bold text-emerald-800">
                    <span className="rounded-lg bg-white/80 px-2 py-0.5 border border-emerald-200">
                      📞 {aiSummaryData.newPhonesCount} رقم هاتف
                    </span>
                    <span className="rounded-lg bg-white/80 px-2 py-0.5 border border-emerald-200">
                      👤 {aiSummaryData.newUsernamesCount} يوزر معرف
                    </span>
                  </div>
                )}
              </div>

              {/* أرقام مكررة في المكتمل */}
              {aiSummaryData.duplicateCompletedCount > 0 && (
                <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔵</span>
                      <div>
                        <h4 className="text-xs font-black text-sky-900">أرقام موجودة سابقاً في (المكتمل)</h4>
                        <p className="text-[10px] font-bold text-sky-700 mt-0.5">
                          تم التواصل معها مسبقاً ومحفوظة في خانة المكتمل
                        </p>
                      </div>
                    </div>
                    <span className="text-base font-black text-sky-800 bg-white px-3 py-1 rounded-xl border border-sky-300 shadow-sm">
                      {aiSummaryData.duplicateCompletedCount}
                    </span>
                  </div>

                  {/* زر إعادة التنشيط ونقلهم لقيد العمل */}
                  <div className="mt-3 pt-2.5 border-t border-sky-200/60">
                    <button
                      disabled={isPending}
                      onClick={handleReactivateCompletedFromAi}
                      className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 py-2.5 px-3 text-xs font-black text-white shadow-md active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span>🔄</span>
                      <span>
                        {isPending
                          ? "جاري النقل والتنشيط..."
                          : `نقل هذه الأرقام (${aiSummaryData.duplicateCompletedCount}) إلى قيد العمل لمراسلتهم مجدداً`}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* أرقام مكررة في قيد العمل */}
              {aiSummaryData.duplicateActiveCount > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🟡</span>
                    <div>
                      <h4 className="text-xs font-black text-amber-900">أرقام موجودة مسبقاً في (قيد العمل)</h4>
                      <p className="text-[10px] font-bold text-amber-700">موجودة في قائمتك الحالية بانتظار التواصل</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-800 bg-white px-2.5 py-1 rounded-xl border border-amber-300 shadow-sm">
                    {aiSummaryData.duplicateActiveCount}
                  </span>
                </div>
              )}
            </div>

            {/* أزرار الإغلاق والمتابعة */}
            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  setShowAiSummaryModal(false);
                  setActiveTab("active");
                }}
                className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 py-3 text-xs font-black text-white shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                <span>الانتقال إلى قيد العمل والبدء بالمراسلة</span>
              </button>

              <button
                onClick={() => setShowAiSummaryModal(false)}
                className="w-full rounded-2xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-600 active:scale-95 transition"
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
