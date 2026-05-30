"use client";

import { useState, use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

import { upsertBranch, deleteBranch, scrapeCategoryFromUrl, scrapeProductFromUrl, createProductFromScrapedData, bulkCreateProductsFromScrapedData, clearBranchProducts } from "../actions";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

export function BranchListClient({
  initialBranches,
  categories,
  preparers,
  defaultCategoryId,
  icons
}: {
  initialBranches: any[],
  categories: any[],
  preparers: any[],
  defaultCategoryId?: string,
  icons: GlobalIconsConfig | null
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // --- FAB Drag State ---
  const [fabPos, setFabPos] = useState({ x: 32, y: 96 }); // Distance from bottom-right
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, pos: { x: 32, y: 96 } });
  const hasMovedRef = useRef(false);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY, pos: { ...fabPos } };
    setIsDragging(true);
    hasMovedRef.current = false;
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dx = dragStartRef.current.x - clientX;
      const dy = dragStartRef.current.y - clientY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMovedRef.current = true;

      setFabPos({
        x: dragStartRef.current.pos.x + dx,
        y: dragStartRef.current.pos.y + dy
      });
    };

    const stopDrag = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', stopDrag);
    };
  }, [isDragging]);

  // --- Selection State ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredBranches.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBranches.map(b => b.id));
    }
  };

  async function handleBulkDelete() {
    if (!confirm("هل أنت متأكد من حذف جميع الأفرع المحددة؟")) return;
    setBulkActionLoading(true);
    for (const id of selectedIds) {
      await deleteBranch(id);
    }
    window.location.reload();
  }

  async function handleBulkMove(newCatId: string) {
    if (!newCatId) return;
    setBulkActionLoading(true);
    for (const id of selectedIds) {
      const br = initialBranches.find(b => b.id === id);
      if (br) {
        const fd = new FormData();
        fd.append("id", br.id);
        fd.append("name", br.name);
        fd.append("categoryId", newCatId);
        await upsertBranch(null, fd);
      }
    }
    window.location.reload();
  }

  // --- Smart Scraper State (Advanced Bulk) ---
  const [showScraper, setShowScraper] = useState(false);
  const [showActiveList, setShowActiveList] = useState(false);
  const [importSessions, setImportSessions] = useState<any[]>([]);

  // التأكد من وجود حقل إدخال واحد على الأقل دائماً عند فتح النافذة
  useEffect(() => {
    if (showScraper && importSessions.length === 0) {
      setImportSessions([createEmptySession()]);
    }
  }, [showScraper]);
  const [shouldRemoveBg, setShouldRemoveBg] = useState(true);
  const createEmptySession = () => ({
    id: (Date.now() + Math.random()).toString(),
    url: "",
    manualImage: null,
    manualImageUrl: null,
    status: "idle",
    progress: 0,
    total: 0,
    branchData: null,
    branchId: null,
    error: null,
    skipIfNameExists: false,
  });

  async function handleBulkImageUpload(files: FileList) {
    const newSessions = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImageFileForUpload(file);
        if (compressed) {
            newSessions.push({
                ...createEmptySession(),
                id: (Date.now() + Math.random() + i).toString(),
                manualImage: compressed,
                manualImageUrl: URL.createObjectURL(compressed),
            });
        }
    }
    setImportSessions(prev => {
        // إذا كانت القائمة فارغة أو تحتوي على سطر واحد فارغ تماماً، استبدلها
        if (prev.length === 0 || (prev.length === 1 && !prev[0].url && !prev[0].manualImage)) {
            return newSessions;
        }
        return [...prev, ...newSessions];
    });
  }

  // تحديث جلسة معينة
  function updateSession(id: string, updates: any) {
    setImportSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }

  // تحديث الرابط وبدء السحب
  function handleSessionChange(id: string, url: string) {
    const isReady = url.includes("/shop/sub/") || url.includes("/item/");

    setImportSessions(prev => {
        const target = prev.find(s => s.id === id);
        if (!target) return prev;

        const updatedTarget = { ...target, url };

        // تحديث المصفوفة الحالية
        let newSessions = prev.map(s => s.id === id ? updatedTarget : s);

        // إذا تم إدخال رابط في الحقل الحالي، تأكد من وجود حقل فارغ جديد دائماً
        if (isReady) {
            const hasEmptyField = newSessions.some(s => !s.url && s.status === 'idle');
            if (!hasEmptyField) {
                newSessions.push(createEmptySession());
            }
        }

        return newSessions;
    });

    // ابدأ السحب إذا كان الرابط صالحاً (فحص أولي)
    if (isReady) {
        autoProcessSession(id, url);
    }
  }

  async function autoProcessSession(id: string, url: string, options?: { skipIfNameExists?: boolean, branchId?: string, manualImage?: File | null }) {
    // الانتقال لحالة الفحص بشكل آمن لمنع التكرار
    let alreadyStarted = false;
    setImportSessions(prev => {
        const s = prev.find(x => x.id === id);
        if (!s || (s.status !== 'idle' && s.status !== 'error')) {
            alreadyStarted = true;
            return prev;
        }
        return prev.map(x => x.id === id ? { ...x, status: 'scraping', error: null, url, ...options } : x);
    });

    if (alreadyStarted) return;

    try {
        const res = await scrapeCategoryFromUrl(url);
        if (res.ok && res.branchData) {
            updateSession(id, { branchData: res.branchData, total: res.productUrls.length });

            let branchId = options?.branchId;
            if (!branchId) {
                const catId = (document.getElementById('bulkCategoryGlobal') as HTMLSelectElement)?.value || defaultCategoryId || categories[0]?.id;

                const fd = new FormData();
                fd.append("name", res.branchData.name);
                fd.append("categoryId", catId);

                // جلب الصورة اليدوية من حالة الجلسة إذا كانت موجودة (لضمان عمل الصور المرفوعة مسبقاً)
                const currentSession = importSessions.find(s => s.id === id);
                const manualImageToUse = options?.manualImage || currentSession?.manualImage;

                if (manualImageToUse) {
                    fd.append("photo", manualImageToUse);
                } else {
                    fd.append("remoteImageUrl", res.branchData.imageUrl);
                }
                fd.append("skipRevalidate", "true");

                const bRes = await upsertBranch(null, fd);
                if (bRes.ok && bRes.id) {
                    branchId = bRes.id;
                    updateSession(id, { branchId: branchId });
                } else {
                    updateSession(id, { status: 'error', error: bRes.error || "فشل إنشاء الفرع" });
                    return;
                }
            }

            updateSession(id, { status: 'importing' });

            const productsToImport = (res as any).products || [];
            const urlsToScrape = res.productUrls;
            let successCount = 0;

            if (productsToImport.length > 0) {
                // السرعة القصوى: إرسال كافة المنتجات في طلب واحد للسيرفر (Bulk Action)
                const bRes = await bulkCreateProductsFromScrapedData(branchId!, productsToImport, shouldRemoveBg, options?.skipIfNameExists);
                if (bRes.ok) {
                    successCount = bRes.count || 0;
                    updateSession(id, { progress: productsToImport.length });
                } else {
                    updateSession(id, { status: 'error', error: bRes.error || "فشل السحب الجماعي" });
                    return;
                }
            } else {
                // الطريقة التقليدية (فقط إذا كان الموقع لا يدعم السحب الجماعي)
                const chunks = [];
                for (let i = 0; i < urlsToScrape.length; i += 5) {
                    chunks.push(urlsToScrape.slice(i, i + 5));
                }

                for (const chunk of chunks) {
                    await Promise.all(chunk.map(async (pUrl) => {
                        try {
                            const pRes = await scrapeProductFromUrl(pUrl);
                            if (pRes.ok) {
                                const pImport = await createProductFromScrapedData(branchId!, pRes.data, shouldRemoveBg, options?.skipIfNameExists);
                                if (pImport.ok) successCount++;
                            }
                        } catch (err) {
                            console.error("Failed to scrape product:", pUrl, err);
                        } finally {
                            setImportSessions(prev => prev.map(s =>
                                s.id === id ? { ...s, progress: (s.progress || 0) + 1 } : s
                            ));
                        }
                    }));
                }
            }

            if (successCount > 0 || urlsToScrape.length === 0) {
                // إخفاء وحذف فوري بدون أي حركة "تزحلق" أو "سحب"
                setImportSessions(prev => prev.filter(s => s.id !== id));
            } else {
                updateSession(id, { status: 'error', error: "فشل سحب المنتجات لهذا الفرع" });
            }
        } else {
            updateSession(id, { status: 'error', error: res.error || "تعذر تحليل الرابط" });
        }
    } catch (e: any) {
        updateSession(id, { status: 'error', error: e.message });
    }
  }

  async function handleResetSession(id: string) {
    const session = importSessions.find(s => s.id === id);
    if (!session || !session.branchId) return;

    if (!confirm(`هل أنت متأكد من مسح كافة منتجات فرع "${session.branchData?.name || ''}" والبدء بسحب جديد؟`)) return;

    updateSession(id, { status: 'idle', progress: 0, total: 0, error: "جاري مسح المنتجات..." });
    const res = await clearBranchProducts(session.branchId);
    if (!res.ok) {
        updateSession(id, { status: 'error', error: "فشل مسح المنتجات" });
        return;
    }

    const newUrl = prompt("أدخل رابط المنتجات الجديد (أو اتركه فارغاً لاستخدام الرابط الحالي):", session.url);
    if (newUrl !== null) {
        const urlToUse = newUrl || session.url;
        autoProcessSession(id, urlToUse, { skipIfNameExists: false, branchId: session.branchId });
    } else {
        updateSession(id, { status: 'idle', error: null });
    }
  }

  async function handleContinueSession(id: string) {
    const session = importSessions.find(s => s.id === id);
    if (!session || !session.branchId) return;

    const newUrl = prompt("أدخل الرابط لفحص وسحب الجديد فقط (أو اتركه فارغاً لاستخدام الرابط الحالي):", session.url);
    if (newUrl !== null) {
        const urlToUse = newUrl || session.url;
        autoProcessSession(id, urlToUse, { skipIfNameExists: true, branchId: session.branchId });
    }
  }

  async function startSyncForBranch(br: any, mode: 'reset' | 'continue') {
    const url = prompt(`أدخل رابط السحب لفرع "${br.name}":`);
    if (!url) return;

    setShowScraper(true);
    const sessionId = (Date.now() + Math.random()).toString();
    const newSession = {
        ...createEmptySession(),
        id: sessionId,
        url: url,
        branchId: br.id,
        branchData: { name: br.name, imageUrl: br.photoUrl },
        skipIfNameExists: mode === 'continue',
        status: 'idle'
    };

    setImportSessions(prev => [newSession, ...prev]);

    if (mode === 'reset') {
        setLoading(true);
        await clearBranchProducts(br.id);
        setLoading(false);
    }

    autoProcessSession(sessionId, url, {
        skipIfNameExists: mode === 'continue',
        branchId: br.id
    });
  }

  async function handleManualImageUpload(id: string, file: File) {
    const compressed = await compressImageFileForUpload(file);
    if (compressed) {
        updateSession(id, {
            manualImage: compressed,
            manualImageUrl: URL.createObjectURL(compressed)
        });
        // إذا كان الفرع قد أنشئ بالفعل، يمكن تحديث صورته هنا (اختياري حسب الفكرة الأقوى)
    }
  }

  async function handleCancelSession(id: string) {
    const session = importSessions.find(s => s.id === id);
    if (!session) return;

    if (session.branchId) {
        if (!confirm("هل أنت متأكد من إلغاء العملية وحذف الفرع الذي تم إنشاؤه؟")) return;
        updateSession(id, { status: 'idle', error: "جاري الحذف..." });
        await deleteBranch(session.branchId);
    }

    setImportSessions(prev => prev.filter(s => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const photo = formData.get("photo") as File;
    if (photo && photo.size > 0) {
      const compressed = await compressImageFileForUpload(photo);
      if (compressed) formData.set("photo", compressed);
    }

    const res = await upsertBranch(null, formData);
    setLoading(false);
    if (res.ok) {
      setShowForm(false);
      setEditing(null);
      window.location.reload();
    } else {
      alert(res.error);
    }
  }

  async function handleToggleActive(br: any) {
    const formData = new FormData();
    formData.append("id", br.id);
    formData.append("name", br.name);
    formData.append("categoryId", br.categoryId);
    formData.append("sequence", String(br.sequence));
    formData.append("active", String(!br.active));

    const res = await upsertBranch(null, formData);
    if (res.ok) window.location.reload();
  }

  const filteredBranches = initialBranches.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const potentialParents = initialBranches.filter(b => !b.parentBranchId && b.id !== editing?.id);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-xl text-white px-8 py-5 rounded-3xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-8 duration-500 border border-white/10">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تم تحديد</span>
            <span className="text-xl font-black text-indigo-400">{selectedIds.length} فرع</span>
          </div>

          <div className="h-10 w-[1px] bg-white/10" />

          <div className="flex items-center gap-3">
            <select
              onChange={(e) => handleBulkMove(e.target.value)}
              disabled={bulkActionLoading}
              className="bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-white">نقل إلى قسم...</option>
              {categories.map(c => <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>)}
            </select>

            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-rose-500/20"
            >
              {bulkActionLoading ? "جاري الحذف..." : <><DynamicIcon icon={icons?.ui_delete} fallback="🗑️" className="w-4 h-4" /> حذف المحدد</>}
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Search & Actions Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm transition-all">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={toggleSelectAll}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border ${selectedIds.length === filteredBranches.length ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
          >
            {selectedIds.length === filteredBranches.length ? "✓" : "☐"}
          </button>
          <div className="relative flex-1 md:w-80">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="بحث في الأفرع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3.5 rounded-2xl bg-slate-50 border-none outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-sm transition-all"
            />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {/* Floating Action Button (FAB) for Smart Scraper - Draggable */}
          <button
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onClick={(e) => {
              if (hasMovedRef.current) {
                e.preventDefault();
                return;
              }
              setShowScraper(!showScraper);
              if (!showScraper) {
                setImportSessions(prev => (prev.length === 0 ? [createEmptySession()] : prev));
              }
              setShowForm(false);
            }}
            style={{
              bottom: `${fabPos.y}px`,
              right: `${fabPos.x}px`,
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none'
            }}
            className={`fixed z-[110] w-16 h-16 bg-indigo-600 text-white rounded-[1.75rem] shadow-2xl flex items-center justify-center text-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-indigo-500/30 ${isDragging ? '' : 'animate-bounce-subtle'}`}
            title={showScraper ? "إغلاق السحب" : "✨ سحب فرع ذكي (اسحب لتغيير مكاني)"}
          >
            {showScraper ? <DynamicIcon icon={icons?.ui_close} fallback="✕" className="w-6 h-6" /> : <DynamicIcon icon={icons?.ui_flash} fallback="✨" className="w-8 h-8" />}
          </button>

          <button
            onClick={() => {
              setEditing(null);
              setShowForm(!showForm);
              setShowScraper(false);
            }}
            className="flex-1 md:flex-none px-8 py-3.5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            {showForm ? <><DynamicIcon icon={icons?.ui_close} fallback="✕" className="w-4 h-4" /> إغلاق</> : <><DynamicIcon icon={icons?.ui_add} fallback="+" className="w-4 h-4" /> إضافة فرع</>}
          </button>
          {defaultCategoryId && (
             <Link
                href={`${SECRET_ADMIN_PATH}/store/products?categoryId=${defaultCategoryId}`}
                className="flex-1 md:flex-none px-8 py-3.5 bg-indigo-50 text-indigo-700 font-black rounded-2xl hover:bg-indigo-100 transition shadow-sm border border-indigo-100 text-center active:scale-95 flex items-center justify-center gap-2"
             >
                <DynamicIcon icon={icons?.ui_box} fallback="📦" className="w-4 h-4" /> المنتجات
             </Link>
          )}
        </div>
      </div>

      {/* Smart Scraper Panel (Fixed Overlay) */}
      {showScraper && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border border-slate-200/60 shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 pb-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                        <DynamicIcon iconKey="ui_flash" config={icons} fallback="⚡" className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">السحب الذكي للأفرع</h2>
                        <p className="text-xs text-slate-500 font-bold">استيراد جماعي للأفرع والمنتجات من الروابط</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">القسم المستهدف:</span>
                        <select
                            id="bulkCategoryGlobal"
                            defaultValue={defaultCategoryId || ""}
                            className="bg-transparent border-none outline-none text-xs font-black text-slate-900 cursor-pointer"
                        >
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowScraper(false)}
                        className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100"
                    >✕</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-4 custom-scrollbar">
                {/* Tabs to switch between Input and Processing */}
                <div className="flex gap-2 mb-6 sticky top-0 bg-white/80 backdrop-blur-md z-30 py-4 border-b border-slate-100">
                    <button
                        onClick={() => setShowActiveList(false)}
                        className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] transition-all border ${!showActiveList ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
                    >
                        📝 إضافة روابط ({importSessions.filter(s => !s.url && s.status === 'idle').length})
                    </button>
                    <button
                        onClick={() => setShowActiveList(true)}
                        className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] transition-all border ${showActiveList ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
                    >
                        ⏳ المعالجة ({importSessions.filter(s => s.url || s.status !== 'idle').length})
                    </button>
                </div>

                {/* Quick Add More Button (Only in Input tab) */}
                {!showActiveList && importSessions.length > 0 && (
                    <div className="flex justify-between items-center mb-6 px-2">
                        <button
                            onClick={() => document.getElementById('bulk-image-input-more')?.click()}
                            className="px-6 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition-all flex items-center gap-2 border border-indigo-100"
                        >
                            <DynamicIcon iconKey="ui_image" config={icons} fallback="📷" className="w-3.5 h-3.5" />
                            <span>إضافة من الصور</span>
                        </button>
                        <input
                            id="bulk-image-input-more"
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files && handleBulkImageUpload(e.target.files)}
                        />
                        <button
                            onClick={() => setConfirmDelete("ALL_SESSIONS" as any)} // Using confirmDelete state temporarily for UI feedback
                            className="text-[10px] font-black text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-widest"
                        >✕ مسح الكل</button>
                    </div>
                )}

                {importSessions
                    .filter(s => showActiveList ? (s.url || s.status !== 'idle') : (!s.url && s.status === 'idle'))
                    .map((session, index) => (
                    <div
                        key={session.id}
                        className="p-6 rounded-3xl border border-slate-100 mb-4 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/40 transition-all group"
                    >
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="w-full md:w-20 h-20 shrink-0 relative group/img">
                                <div
                                    onClick={() => document.getElementById(`file-${session.id}`)?.click()}
                                    className="w-full h-full rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden group-hover/img:border-indigo-300 transition-all"
                                >
                                    {session.manualImageUrl || session.branchData?.imageUrl ? (
                                        <img src={session.manualImageUrl || session.branchData?.imageUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-slate-300">
                                            <DynamicIcon iconKey="ui_image" config={icons} fallback="📷" className="w-6 h-6" />
                                            <span className="text-[8px] font-black uppercase">صورة</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    id={`file-${session.id}`}
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleManualImageUpload(session.id, e.target.files[0])}
                                />
                            </div>

                            <div className="flex-1 w-full space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">فرع رقم {index + 1}:</label>
                                    {session.status === 'scraping' && <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black animate-pulse border border-indigo-100">⏳ جاري الفحص...</span>}
                                    {session.status === 'importing' && <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black animate-pulse border border-amber-100">🚚 جاري سحب {session.total} منتج...</span>}
                                    {session.status === 'completed' && <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100">✅ اكتمل بنجاح</span>}
                                    {session.status === 'error' && <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-500 text-[10px] font-black border border-rose-100">❌ {session.error}</span>}
                                </div>
                                <input
                                    value={session.url}
                                    onChange={(e) => handleSessionChange(session.id, e.target.value)}
                                    placeholder="ضع رابط الفرع هنا..."
                                    className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-bold outline-none transition-all text-sm shadow-sm"
                                />
                                <div className="flex items-center justify-between px-1">
                                    {session.branchData ? (
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg border border-indigo-100/50">{session.branchData.name}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase">• {session.total} منتج</span>
                                        </div>
                                    ) : (
                                        <div />
                                    )}
                                    <div className="flex items-center gap-4">
                                        {session.branchId && (
                                            <>
                                                <button
                                                    onClick={() => handleResetSession(session.id)}
                                                    className="text-[10px] font-black text-amber-600 hover:text-amber-700 transition-colors uppercase"
                                                >
                                                    🔄 إعادة السحب
                                                </button>
                                                <button
                                                    onClick={() => handleContinueSession(session.id)}
                                                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase"
                                                >
                                                    ✨ تكملة النواقص
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleCancelSession(session.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors border border-rose-100/50"
                                        >
                                            <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {session.status !== 'idle' && (
                                <div className="w-full md:w-32 shrink-0 flex flex-col items-center">
                                    <div className="relative w-16 h-16 mb-2">
                                        <svg className="w-full h-full -rotate-90">
                                            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100" />
                                            <circle
                                                cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"
                                                className={session.status === 'completed' ? 'text-emerald-500' : 'text-indigo-600'}
                                                strokeDasharray={175.9}
                                                strokeDashoffset={175.9 - (175.9 * (session.total > 0 ? (session.progress / session.total) : 0))}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                                            {Math.round(session.total > 0 ? (session.progress / session.total) * 100 : 0)}%
                                        </div>
                                    </div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                        {session.progress} / {session.total}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {importSessions.length > 0 && !importSessions.some(s => s.status === 'idle' && !s.url && !s.manualImage) && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => setImportSessions(prev => [...prev, createEmptySession()])}
                      className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black hover:bg-slate-50 transition-all hover:border-indigo-300 hover:text-indigo-600 flex items-center gap-2"
                    >
                      <DynamicIcon iconKey="ui_plus" config={icons} fallback="+" className="w-3.5 h-3.5" />
                      إضافة حقل فرع آخر
                    </button>
                  </div>
                )}
            </div>

            <div className="p-8 border-t flex flex-col items-center gap-6 bg-slate-50/50 shrink-0">
                {importSessions.some(s => s.status === 'scraping' || s.status === 'importing') && (
                    <div className="flex items-center gap-3 px-6 py-2.5 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
                        <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest">جاري معالجة البيانات...</span>
                    </div>
                )}
                <button
                    onClick={() => window.location.reload()}
                    className="w-full md:w-auto px-16 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    <DynamicIcon iconKey="ui_check" config={icons} fallback="✓" className="w-5 h-5" />
                    <span>إنهاء العمل وتحديث البيانات</span>
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Upsert Form */}
      {(showForm || editing) && (
        <div className="bg-white p-8 rounded-3xl border border-indigo-100 shadow-2xl shadow-indigo-500/5 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <DynamicIcon iconKey={editing ? "ui_edit" : "ui_plus"} config={icons} fallback="+" className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900">{editing ? "تعديل بيانات الفرع" : "إضافة فرع جديد للقسم"}</h2>
                    <p className="text-sm text-slate-500 font-bold">إدارة تفاصيل الفرع ومستويات التسعير</p>
                </div>
            </div>
            <button onClick={() => { setEditing(null); setShowForm(false); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 transition-all border border-slate-100">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <input type="hidden" name="currentPhotoUrl" value={editing?.photoUrl || ""} />
            <input type="hidden" name="active" value={editing ? String(editing.active) : "true"} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="space-y-3">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        القسم الرئيسي
                    </label>
                    <select
                        name="categoryId"
                        defaultValue={editing?.categoryId || defaultCategoryId || ""}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all text-sm cursor-pointer"
                        required
                    >
                        <option value="">اختر القسم...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        اسم الفرع
                    </label>
                    <input
                        name="name"
                        defaultValue={editing?.name || ""}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all text-sm"
                        placeholder="مثلاً: خضروات ورقية..."
                        required
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        الفرع الأب (اختياري)
                    </label>
                    <select
                        name="parentBranchId"
                        defaultValue={editing?.parentBranchId || ""}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all text-sm cursor-pointer"
                    >
                        <option value="">لا يوجد (فرع رئيسي)</option>
                        {potentialParents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        تسلسل العرض
                    </label>
                    <input
                        name="sequence"
                        type="number"
                        defaultValue={editing?.sequence || 0}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all text-sm"
                    />
                </div>

                <div className="space-y-3 lg:col-span-2">
                    <label className="text-xs font-black text-indigo-600 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        المجهز المفوّض بالتسعير
                    </label>
                    <select
                        name="authorizedPreparerId"
                        defaultValue={editing?.authorizedPreparerId || ""}
                        className="w-full px-5 py-4 rounded-2xl bg-indigo-50/30 border-2 border-indigo-100/50 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-black transition-all text-sm text-indigo-900 cursor-pointer"
                    >
                        <option value="">غير مفوّض (الإدارة فقط)</option>
                        {preparers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="space-y-3 lg:col-span-1">
                    <label className="text-xs font-black text-emerald-600 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        هامش الربح
                    </label>
                    <div className="relative">
                        <input
                            name="profitMargin"
                            type="number"
                            step="0.01"
                            defaultValue={editing?.profitMargin || 0.25}
                            className="w-full px-5 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100/50 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none font-black transition-all text-sm text-emerald-900"
                        />
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-600">%</span>
                    </div>
                </div>

                <div className="space-y-3 lg:col-span-1">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        صورة الفرع
                    </label>
                    <div className="relative group">
                        <input
                            name="photo"
                            type="file"
                            accept="image/*"
                            className="w-full px-4 py-3 text-xs font-bold text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-3 lg:col-span-4">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        ملاحظة تظهر للزبون عند فتح هذا الفرع
                    </label>
                    <textarea
                        name="notes"
                        defaultValue={editing?.notes || ""}
                        rows={2}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all resize-none text-sm"
                        placeholder="مثلاً: جميع هذه المنتجات طازجة وتصلنا يومياً..."
                    />
                </div>
            </div>

            <div className="flex gap-4 pt-8 border-t border-slate-100">
              <button
                disabled={loading}
                className="flex-1 md:flex-none px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 disabled:opacity-50 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {loading ? "جاري الحفظ..." : "حفظ بيانات الفرع"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(null); setShowForm(false); }}
                className="px-8 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid Display */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredBranches.map((br) => (
          <div
            key={br.id}
            className={`relative group bg-white p-4 rounded-3xl border-2 transition-all duration-300 flex flex-col ${selectedIds.includes(br.id) ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-2xl' : br.active ? 'border-transparent shadow-xl shadow-slate-200/40 hover:border-indigo-100' : 'border-slate-100 bg-slate-50/50 grayscale opacity-80'}`}
          >
            {/* Selection Checkbox Overlay */}
            <div
              onClick={() => toggleSelect(br.id)}
              className={`absolute top-4 right-4 z-20 w-8 h-8 rounded-xl border-2 cursor-pointer flex items-center justify-center transition-all ${selectedIds.includes(br.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/80 border-slate-200 text-transparent hover:border-indigo-300'}`}
            >
              ✓
            </div>

            {/* Status Badge */}
            <div className={`absolute top-6 left-6 z-10 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter shadow-sm border ${br.active ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-200 text-slate-500 border-slate-300'}`}>
                {br.active ? 'نشط' : 'مخفي'}
            </div>

            <Link href={`${SECRET_ADMIN_PATH}/store/products?branchId=${br.id}`} className="flex-1 block">
              <div className="relative aspect-square mb-4 overflow-hidden rounded-2xl bg-slate-50 shadow-inner group-hover:shadow-indigo-100 transition-all">
                {br.photoUrl ? (
                  <img src={br.photoUrl} alt={br.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-slate-50 to-indigo-50/30">
                    <DynamicIcon iconKey="ui_branch" config={icons} fallback="🌿" className="w-16 h-16 text-indigo-200" />
                  </div>
                )}
              </div>
              <div className="text-center pb-2">
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg mb-2 inline-block border border-indigo-100/50">
                    {br.category?.name}
                </span>
                <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 text-lg">{br.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                        {br.parentBranch ? `تابع لـ: ${br.parentBranch.name}` : "فرع رئيسي"}
                    </span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                    <span className="text-[10px] text-indigo-600 font-black flex items-center gap-1">
                        <DynamicIcon iconKey="ui_box" config={icons} fallback="📦" className="w-3 h-3" />
                        {br._count?.products || 0}
                    </span>
                </div>
              </div>
            </Link>

            {/* Actions Bar */}
            <div className="mt-4 grid grid-cols-4 gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={() => startSyncForBranch(br, 'continue')}
                className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition-colors flex items-center justify-center border border-indigo-100/50"
                title="تكملة سحب المنتجات"
              >
                <DynamicIcon iconKey="ui_flash" config={icons} fallback="✨" className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(br);
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-2.5 bg-sky-50 text-sky-700 rounded-xl text-[10px] font-black hover:bg-sky-100 transition-colors flex items-center justify-center border border-sky-100/50"
                title="تعديل"
              >
                <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleActive(br)}
                className={`p-2.5 rounded-xl text-[10px] font-black transition-colors flex items-center justify-center border ${br.active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100/50' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100/50'}`}
                title={br.active ? "إخفاء من المتجر" : "إظهار في المتجر"}
              >
                <DynamicIcon iconKey={br.active ? "ui_eye_off" : "ui_eye"} config={icons} fallback={br.active ? "👁️" : "🕶️"} className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDelete(br.id)}
                className="p-2.5 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors flex items-center justify-center border border-rose-100/50"
                title="حذف نهائي"
              >
                <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-4 h-4" />
              </button>
            </div>

            {/* Delete Overlay */}
            {confirmDelete === br.id && (
                <div className="absolute inset-0 z-20 bg-slate-900/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200">
                    <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-500/20">
                        <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-6 h-6" />
                    </div>
                    <p className="text-white font-black text-xs mb-4 leading-relaxed">سيتم حذف الفرع وربما يؤثر على المنتجات التابعة له. هل أنت متأكد؟</p>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={async () => {
                                await deleteBranch(br.id);
                                window.location.reload();
                            }}
                            className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] hover:bg-rose-700 transition-colors"
                        >نعم، احذف</button>
                        <button
                            onClick={() => setConfirmDelete(null)}
                            className="flex-1 py-3 bg-white/10 text-white rounded-xl font-black text-[10px] hover:bg-white/20 transition-colors"
                        >إلغاء</button>
                    </div>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
