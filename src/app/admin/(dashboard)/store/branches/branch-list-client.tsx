"use client";

import { useState, use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { upsertBranch, deleteBranch, scrapeCategoryFromUrl, scrapeProductFromUrl, createProductFromScrapedData, clearBranchProducts } from "../actions";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

export function BranchListClient({
  branchesPromise,
  categoriesPromise,
  preparersPromise,
  defaultCategoryId,
  icons
}: {
  branchesPromise: Promise<any[]>,
  categoriesPromise: Promise<any[]>,
  preparersPromise: Promise<any[]>,
  defaultCategoryId?: string,
  icons: GlobalIconsConfig | null
}) {
  const initialBranches = use(branchesPromise);
  const categories = use(categoriesPromise);
  const preparers = use(preparersPromise);
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
  const [importSessions, setImportSessions] = useState<any[]>([]);
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

  // إضافة سطر جديد تلقائياً إذا امتلأ الأخير
  function handleSessionChange(id: string, url: string) {
    updateSession(id, { url });

    // إذا كان هذا هو السطر الأخير وتم إدخال رابط، افتح سطراً جديداً
    const sessionIndex = importSessions.findIndex(s => s.id === id);
    if (sessionIndex === importSessions.length - 1 && url.trim() !== "") {
        setImportSessions(prev => [...prev, createEmptySession()]);
    }

    // بدء الفحص التلقائي إذا كان الرابط يبدو صالحاً
    if (url.includes("/shop/sub/") || url.includes("/item/")) {
        const session = importSessions.find(s => s.id === id);
        autoProcessSession(id, url, { manualImage: session?.manualImage });
    }
  }

  async function autoProcessSession(id: string, url: string, options?: { skipIfNameExists?: boolean, branchId?: string, manualImage?: File | null }) {
    updateSession(id, { status: 'scraping', error: null, ...options });

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

                // إذا كانت هناك صورة يدوية مرفوعة، نستخدمها، وإلا نستخدم رابط الصورة المسحوب
                if (options?.manualImage) {
                    fd.append("photo", options.manualImage);
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

            // سحب المنتجات
            const urlsToScrape = res.productUrls;
            let currentProgress = 0;
            let successCount = 0;

            for (const pUrl of urlsToScrape) {
                const pRes = await scrapeProductFromUrl(pUrl);
                if (pRes.ok) {
                    // استخدام الأكشن الجديد لإنشاء المنتج وربطه بالفرع فوراً مع خيار تخطي الموجود
                    const pImport = await createProductFromScrapedData(branchId!, pRes.data, shouldRemoveBg, options?.skipIfNameExists);
                    if (pImport.ok) successCount++;
                }
                currentProgress++;
                updateSession(id, { progress: currentProgress });
            }

            if (successCount > 0 || urlsToScrape.length === 0) {
                updateSession(id, { status: 'completed', error: urlsToScrape.length === 0 ? "تم إنشاء الفرع (الفرع فارغ من المنتجات)" : null });
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-8 py-4 rounded-[2.5rem] shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-8 duration-500 border border-slate-700">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تم تحديد</span>
            <span className="text-xl font-black text-violet-400">{selectedIds.length} فرع</span>
          </div>

          <div className="h-10 w-[1px] bg-slate-700" />

          <div className="flex items-center gap-2">
            <select
              onChange={(e) => handleBulkMove(e.target.value)}
              disabled={bulkActionLoading}
              className="bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">نقل إلى قسم...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {bulkActionLoading ? "جاري الحذف..." : <><DynamicIcon icon={icons?.ui_delete} fallback="🗑️" className="w-3.5 h-3.5" /> حذف المحدد</>}
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Search & Actions Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-sm transition-all">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={toggleSelectAll}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${selectedIds.length === filteredBranches.length ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
          >
            {selectedIds.length === filteredBranches.length ? "✓" : "☐"}
          </button>
          <div className="relative flex-1 md:w-80">
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="بحث في الأفرع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-12 pl-4 py-3 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-violet-500 font-bold text-sm transition-all"
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
            className={`fixed z-[110] w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-transform ${isDragging ? '' : 'animate-bounce-subtle'}`}
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
            className="flex-1 md:flex-none px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            {showForm ? <><DynamicIcon icon={icons?.ui_close} fallback="✕" className="w-4 h-4" /> إغلاق</> : <><DynamicIcon icon={icons?.ui_add} fallback="+" className="w-4 h-4" /> إضافة فرع</>}
          </button>
          {defaultCategoryId && (
             <Link
                href={`/admin/store/products?categoryId=${defaultCategoryId}`}
                className="flex-1 md:flex-none px-8 py-3 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 text-center active:scale-95 flex items-center justify-center gap-2"
             >
                <DynamicIcon icon={icons?.ui_box} fallback="📦" className="w-4 h-4" /> المنتجات
             </Link>
          )}
        </div>
      </div>

      {/* Smart Scraper Panel (Fixed Overlay) */}
      {showScraper && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-indigo-50 to-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[3rem] border-2 border-indigo-100 shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 pb-4 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                    <span>🚀 السحب الذكي للأفرع</span>
                </h2>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-100/50 rounded-xl">
                        <span className="text-xs font-black text-indigo-600">القسم المستهدف:</span>
                        <select
                            id="bulkCategoryGlobal"
                            defaultValue={defaultCategoryId || ""}
                            className="bg-transparent border-none outline-none text-xs font-black text-indigo-900"
                        >
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowScraper(false)}
                        className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    >✕</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-4 custom-scrollbar">
                {/* Empty state: start with URL first, image is optional */}
                {importSessions.length === 0 && (
                    <div className="mb-6 p-8 border-2 border-dashed border-indigo-200 rounded-[2rem] bg-indigo-50/50 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-3xl">🔗</div>
                        <div className="text-center">
                            <h3 className="text-xl font-black text-indigo-900">ابدأ بوضع رابط الفرع</h3>
                            <p className="text-sm text-indigo-500 font-bold mt-1">الصورة اختيارية، النظام يسحب صورة الفرع تلقائياً من الموقع.</p>
                        </div>
                        <button
                          onClick={() => setImportSessions([createEmptySession()])}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-colors"
                        >
                          ➕ إضافة أول فرع
                        </button>
                    </div>
                )}

                {/* Quick Add More Button */}
                {importSessions.length > 0 && (
                    <div className="flex justify-between items-center mb-4 px-4">
                        <button
                            onClick={() => document.getElementById('bulk-image-input-more')?.click()}
                            className="px-6 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-200 transition-colors flex items-center gap-2"
                        >
                            <span>➕ إضافة صور أخرى</span>
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
                            onClick={() => setImportSessions([])}
                            className="text-[10px] font-bold text-rose-400 hover:text-rose-600"
                        >✕ مسح الكل</button>
                    </div>
                )}

                {importSessions.map((session, index) => (
                    <div key={session.id} className={`p-5 rounded-[2rem] border-2 transition-all duration-300 ${session.status === 'completed' ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-indigo-50 shadow-sm'}`}>
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="w-full md:w-16 h-16 shrink-0 relative group">
                                <div
                                    onClick={() => document.getElementById(`file-${session.id}`)?.click()}
                                    className="w-full h-full rounded-2xl bg-indigo-50 border-2 border-dashed border-indigo-200 flex items-center justify-center cursor-pointer overflow-hidden"
                                >
                                    {session.manualImageUrl || session.branchData?.imageUrl ? (
                                        <img src={session.manualImageUrl || session.branchData?.imageUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xl">📷</span>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    id={`file-${session.id}`}
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleManualImageUpload(session.id, e.target.files[0])}
                                />
                            </div>

                            <div className="flex-1 w-full space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-indigo-400 mr-2">فرع رقم {index + 1}:</label>
                                    {session.status === 'scraping' && <span className="text-[10px] font-bold text-indigo-600 animate-pulse">⏳ جاري الفحص...</span>}
                                    {session.status === 'importing' && <span className="text-[10px] font-bold text-amber-600 animate-pulse">🚚 جاري سحب {session.total} منتج...</span>}
                                    {session.status === 'completed' && <span className="text-[10px] font-bold text-emerald-600">✅ اكتمل بنجاح</span>}
                                    {session.status === 'error' && <span className="text-[10px] font-bold text-rose-500">❌ {session.error}</span>}
                                </div>
                                <input
                                    value={session.url}
                                    onChange={(e) => handleSessionChange(session.id, e.target.value)}
                                    placeholder="ضع رابط الفرع هنا..."
                                    className="w-full px-5 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 font-bold outline-none transition-all text-sm"
                                />
                                <div className="flex items-center justify-between px-2">
                                    {session.branchData ? (
                                        <p className="text-[11px] font-black text-slate-600 flex items-center gap-2">
                                            🏷️ <span className="text-indigo-600">{session.branchData.name}</span>
                                            • 📦 <span className="text-slate-400">{session.total} منتج</span>
                                        </p>
                                    ) : (
                                        <div />
                                    )}
                                    <div className="flex items-center gap-3">
                                        {session.branchId && (
                                            <>
                                                <button
                                                    onClick={() => handleResetSession(session.id)}
                                                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                                                >
                                                    🔄 إعادة
                                                </button>
                                                <button
                                                    onClick={() => handleContinueSession(session.id)}
                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                                >
                                                    ✨ تكملة
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleCancelSession(session.id)}
                                            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1"
                                        >
                                            🗑️ إلغاء ومسح
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {session.status !== 'idle' && (
                                <div className="w-full md:w-32 shrink-0">
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                        <div
                                            className={`h-full transition-all duration-300 ${session.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`}
                                            style={{ width: `${session.total > 0 ? (session.progress / session.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-[9px] font-black text-center mt-1 text-slate-400">
                                        {session.progress} / {session.total}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {importSessions.length > 0 && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setImportSessions(prev => [...prev, createEmptySession()])}
                      className="px-6 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-50 transition-colors"
                    >
                      ➕ إضافة فرع آخر
                    </button>
                  </div>
                )}
            </div>

            <div className="p-8 border-t flex justify-center bg-slate-50 shrink-0">
                <button
                    onClick={() => window.location.reload()}
                    className="w-full md:w-auto px-12 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                    <span>🚀 إنهاء وتحديث الصفحة</span>
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Upsert Form */}
      {(showForm || editing) && (
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-violet-100 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
            <h2 className="text-2xl font-black text-slate-900">{editing ? "تعديل بيانات الفرع" : "إضافة فرع جديد للقسم"}</h2>
            <button onClick={() => { setEditing(null); setShowForm(false); }} className="text-slate-400 hover:text-rose-500 transition">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <input type="hidden" name="currentPhotoUrl" value={editing?.photoUrl || ""} />
            <input type="hidden" name="active" value={editing ? String(editing.active) : "true"} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">القسم الرئيسي</label>
                    <select
                        name="categoryId"
                        defaultValue={editing?.categoryId || defaultCategoryId || ""}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-violet-500 focus:bg-white outline-none font-bold transition-all text-sm"
                        required
                    >
                        <option value="">اختر القسم...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">اسم الفرع</label>
                    <input
                        name="name"
                        defaultValue={editing?.name || ""}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-violet-500 focus:bg-white outline-none font-bold transition-all text-sm"
                        placeholder="مثلاً: خضروات ورقية..."
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">الفرع الأب (اختياري)</label>
                    <select
                        name="parentBranchId"
                        defaultValue={editing?.parentBranchId || ""}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-violet-500 focus:bg-white outline-none font-bold transition-all text-sm"
                    >
                        <option value="">لا يوجد (فرع رئيسي)</option>
                        {potentialParents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">تسلسل العرض</label>
                    <input
                        name="sequence"
                        type="number"
                        defaultValue={editing?.sequence || 0}
                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-violet-500 focus:bg-white outline-none font-bold transition-all text-sm"
                    />
                </div>

                <div className="space-y-2 lg:col-span-2">
                    <label className="text-xs font-black text-violet-600 uppercase tracking-widest mr-2">المجهز المفوّض بالتسعير</label>
                    <select
                        name="authorizedPreparerId"
                        defaultValue={editing?.authorizedPreparerId || ""}
                        className="w-full px-5 py-3 rounded-2xl bg-violet-50/50 border-2 border-violet-100 focus:border-violet-500 focus:bg-white outline-none font-black transition-all text-sm text-violet-900"
                    >
                        <option value="">غير مفوّض (الإدارة فقط)</option>
                        {preparers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="space-y-2 lg:col-span-1">
                    <label className="text-xs font-black text-emerald-600 uppercase tracking-widest mr-2">هامش الربح</label>
                    <div className="relative">
                        <input
                            name="profitMargin"
                            type="number"
                            step="0.01"
                            defaultValue={editing?.profitMargin || 0.25}
                            className="w-full px-5 py-3 rounded-2xl bg-emerald-50/50 border-2 border-emerald-100 focus:border-emerald-500 focus:bg-white outline-none font-black transition-all text-sm text-emerald-900"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-600">%</span>
                    </div>
                </div>

                <div className="space-y-2 lg:col-span-1">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">صورة الفرع</label>
                    <input
                        name="photo"
                        type="file"
                        accept="image/*"
                        className="w-full px-4 py-2 text-xs font-bold text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
                    />
                </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-slate-50">
              <button
                disabled={loading}
                className="flex-1 md:flex-none px-12 py-4 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 disabled:opacity-50 shadow-xl shadow-violet-100 transition-all active:scale-95"
              >
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
            className={`relative group bg-white p-4 rounded-[2.5rem] border-2 transition-all duration-300 flex flex-col ${selectedIds.includes(br.id) ? 'border-violet-500 ring-4 ring-violet-50 shadow-2xl' : br.active ? 'border-transparent shadow-xl shadow-slate-200/50 hover:border-violet-100' : 'border-slate-100 bg-slate-50/50 grayscale'}`}
          >
            {/* Selection Checkbox Overlay */}
            <div
              onClick={() => toggleSelect(br.id)}
              className={`absolute top-4 right-4 z-20 w-8 h-8 rounded-xl border-2 cursor-pointer flex items-center justify-center transition-all ${selectedIds.includes(br.id) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white/80 border-slate-200 text-transparent hover:border-violet-300'}`}
            >
              ✓
            </div>

            {/* Status Badge */}
            <div className={`absolute top-6 left-6 z-10 w-3 h-3 rounded-full border-2 border-white shadow-sm ${br.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />

            <Link href={`/admin/store/products?branchId=${br.id}`} className="flex-1 block">
              <div className="relative aspect-square mb-4 overflow-hidden rounded-[2rem] bg-slate-50 shadow-inner">
                {br.photoUrl ? (
                  <img src={br.photoUrl} alt={br.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">🌿</div>
                )}
              </div>
              <div className="text-center pb-2">
                <span className="text-[10px] font-black text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full mb-1 inline-block">
                    {br.category?.name}
                </span>
                <h3 className="font-black text-slate-900 group-hover:text-violet-600 transition-colors line-clamp-1">{br.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 font-black uppercase">
                        {br.parentBranch ? `تابع لـ: ${br.parentBranch.name}` : "فرع رئيسي"}
                    </span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="text-[10px] text-emerald-600 font-black">
                        📦 {br._count?.products || 0}
                    </span>
                </div>
              </div>
            </Link>

            {/* Actions Bar */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <button
                onClick={() => startSyncForBranch(br, 'continue')}
                className="p-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition-colors flex items-center justify-center"
                title="تكملة سحب المنتجات"
              >
                <DynamicIcon icon={icons?.ui_flash} fallback="✨" className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setEditing(br);
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-2 bg-sky-50 text-sky-700 rounded-xl text-[10px] font-black hover:bg-sky-100 transition-colors flex items-center justify-center"
                title="تعديل"
              >
                <DynamicIcon icon={icons?.ui_edit} fallback="✏️" className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleToggleActive(br)}
                className={`p-2 rounded-xl text-[10px] font-black transition-colors flex items-center justify-center ${br.active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                title={br.active ? "إخفاء من المتجر" : "إظهار في المتجر"}
              >
                <DynamicIcon icon={br.active ? icons?.ui_visibility_on : icons?.ui_visibility_off} fallback={br.active ? "👁️" : "🕶️"} className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(br.id)}
                className="p-2 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors flex items-center justify-center"
                title="حذف نهائي"
              >
                <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Delete Overlay */}
            {confirmDelete === br.id && (
                <div className="absolute inset-0 z-20 bg-rose-600/95 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in duration-200">
                    <p className="text-white font-black text-xs mb-4 leading-relaxed">سيتم حذف الفرع وربما يؤثر على المنتجات التابعة له. هل أنت متأكد؟</p>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={async () => {
                                await deleteBranch(br.id);
                                window.location.reload();
                            }}
                            className="flex-1 py-2 bg-white text-rose-600 rounded-xl font-black text-[10px]"
                        >نعم، احذف</button>
                        <button
                            onClick={() => setConfirmDelete(null)}
                            className="flex-1 py-2 bg-rose-800 text-white rounded-xl font-black text-[10px]"
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
