"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

import { upsertCategory, deleteCategory } from "../actions";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function CategoryListClient({ initialCategories, icons }: { initialCategories: any[]; icons: GlobalIconsConfig | null }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // --- Smart Import Logic ---
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [importData, setImportData] = useState<{ categoryName: string; branches: any[] } | null>(null);

  async function handleSmartImport() {
    const url = prompt("أدخل رابط القسم من ksebstor.site\nمثال: https://ksebstor.site/shop/cat/53");
    if (!url) return;

    setIsImporting(true);
    setImportStatus("جاري فحص الرابط واستخراج قائمة الأفرع...");
    setImportProgress(10);

    try {
      const { scrapeMainCategoryLinks } = await import("../actions");
      const scrapeRes = await scrapeMainCategoryLinks(url);

      if (!scrapeRes.ok || !scrapeRes.branches || scrapeRes.branches.length === 0) {
        throw new Error(scrapeRes.error || "لم يتم العثور على أفرع في هذا الرابط.");
      }

      setImportData({
        categoryName: scrapeRes.categoryName,
        branches: scrapeRes.branches.map((b: any) => ({ ...b, selectedPhoto: null as File | null }))
      });
      setIsImporting(false);
    } catch (err: any) {
      alert("خطأ: " + err.message);
      setIsImporting(false);
    }
  }

  async function startBulkExecution() {
    if (!importData) return;
    const userCategoryName = prompt("تأكيد اسم القسم الرئيسي:", importData.categoryName);
    if (!userCategoryName) return;

    setIsImporting(true);
    try {
      const { createCategorySimple, scrapeProductsFromBranch, upsertBranch } = await import("../actions");

      setImportStatus("جاري إنشاء القسم الرئيسي...");
      setImportProgress(10);
      const catRes = await createCategorySimple(userCategoryName);
      if (!catRes.ok || !catRes.id) throw new Error("فشل إنشاء القسم.");
      const categoryId = catRes.id;

      let count = 0;
      for (const branch of importData.branches) {
        count++;
        const percent = 10 + Math.floor((count / importData.branches.length) * 90);
        setImportStatus(`جاري سحب فرع (${count}/${importData.branches.length}): ${branch.name}...`);
        setImportProgress(percent);

        // 1. إنشاء الفرع أولاً مع الصورة المختارة إن وجدت
        const branchFormData = new FormData();
        branchFormData.append("name", branch.name);
        branchFormData.append("categoryId", categoryId);
        if (branch.selectedPhoto) {
          branchFormData.append("photo", branch.selectedPhoto);
        }

        const bRes = await upsertBranch(null, branchFormData);
        // ملاحظة: نحتاج معرف الفرع المنشأ، للأسف upsertBranch لا يعيده مباشرة في الكود الحالي
        // سنفترض وجود طريقة لجلب آخر فرع أو تعديل الوظيفة لاحقاً،
        // لكن للآن سنستخدم الـ API الموجود bulk-branch الذي يتعامل مع الاسم

        // 2. سحب منتجات هذا الفرع
        const prodRes = await scrapeProductsFromBranch(branch.url);
        const products = prodRes.ok ? prodRes.products : [];

        // 3. إرسال البيانات للمعالجة
        const formData = new FormData();
        formData.append("categoryId", categoryId);
        formData.append("branchName", branch.name);
        formData.append("products", JSON.stringify(products));

        await fetch(`/api${SECRET_ADMIN_PATH}/store/bulk-branch`, {
          method: "POST",
          body: formData
        });
      }

      setImportStatus("تم اكتمال السحب بنجاح!");
      setImportProgress(100);
      router.refresh();
      setTimeout(() => {
        setIsImporting(false);
        setImportData(null);
        setImportStatus("");
        handleSmartImport();
      }, 1000);
    } catch (err: any) {
      alert("خطأ أثناء التنفيذ: " + err.message);
      setIsImporting(false);
    }
  }

  const filteredCategories = initialCategories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const photoFile = formData.get("photo") as File;
    if (photoFile && photoFile.size > 0) {
      const compressed = await compressImageFileForUpload(photoFile, {
        maxEdgePx: 800,
        jpegQuality: 0.8,
        squareCrop: true
      });
      formData.set("photo", compressed);
    }

    const res = await upsertCategory(null, formData);
    if (res.ok) {
      window.location.reload();
    } else {
      alert(res.error);
      setLoading(false);
    }
  }

  async function handleToggleActive(cat: any) {
    const formData = new FormData();
    formData.append("id", cat.id);
    formData.append("name", cat.name);
    formData.append("sequence", String(cat.sequence));
    formData.append("active", String(!cat.active));

    const res = await upsertCategory(null, formData);
    if (res.ok) window.location.reload();
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm transition-all">
        <div className="relative w-full md:w-96">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
            <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="ابحث عن قسم رئيسي..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 rounded-2xl bg-slate-50 border-none outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-sm transition-all"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleSmartImport}
            disabled={isImporting}
            className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isImporting ? "⏳ جاري السحب..." : (
              <>
                <DynamicIcon iconKey="ui_flash" config={icons} fallback="⚡" className="w-4 h-4" />
                سحب ذكي للقسم
              </>
            )}
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(!showForm);
            }}
            className="flex-1 md:flex-none px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            {showForm ? "✕" : (
              <>
                <DynamicIcon iconKey="ui_plus" config={icons} fallback="+" className="w-4 h-4" />
                إضافة قسم
              </>
            )}
          </button>
        </div>
      </div>

      {/* Smart Import Preview Modal */}
      {importData && !isImporting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">تجهيز أفرع القسم الجديد</h2>
                <p className="text-sm text-slate-500 font-bold">يرجى اختيار صور للأفرع وتعديل أسمائها إذا لزم الأمر قبل البدء بالسحب</p>
              </div>
              <button onClick={() => setImportData(null)} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm text-xl border border-slate-100 hover:bg-slate-50 transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {importData.branches.map((branch, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 items-center transition-all hover:shadow-md hover:bg-white">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md shrink-0 border-4 border-white bg-white flex items-center justify-center relative group">
                    {branch.selectedPhoto ? (
                      <img src={URL.createObjectURL(branch.selectedPhoto)} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">
                        <DynamicIcon iconKey="ui_image" config={icons} fallback="🖼️" className="w-8 h-8 text-slate-300" />
                      </span>
                    )}
                    <label className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white text-[10px] font-black">
                      اختر صورة
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const newImportData = { ...importData };
                            newImportData.branches[idx].selectedPhoto = file;
                            setImportData(newImportData);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex-1 space-y-1 w-full">
                    <label className="text-[10px] font-black text-slate-400 mr-2">اسم الفرع</label>
                    <input
                      value={branch.name}
                      onChange={(e) => {
                        const newImportData = { ...importData };
                        newImportData.branches[idx].name = e.target.value;
                        setImportData(newImportData);
                      }}
                      className="w-full px-5 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-black text-sm"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newImportData = { ...importData };
                      newImportData.branches = newImportData.branches.filter((_, i) => i !== idx);
                      setImportData(newImportData);
                    }}
                    className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition flex items-center justify-center"
                  >
                    <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-8 bg-slate-50/50 border-t flex gap-4">
              <button
                onClick={startBulkExecution}
                className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <DynamicIcon iconKey="ui_rocket" config={icons} fallback="🚀" className="w-5 h-5" />
                ابدأ سحب المنتجات لـ ({importData.branches.length}) أفرع
              </button>
              <button
                onClick={() => setImportData(null)}
                className="px-8 py-4 bg-white text-slate-500 font-bold rounded-2xl border border-slate-200 hover:bg-slate-100 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isImporting && (
        <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-500/5">
          <div className="flex justify-between mb-3">
            <span className="text-sm font-black text-indigo-700">{importStatus}</span>
            <span className="text-sm font-black text-indigo-700">{importProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upsert Form */}
      {(showForm || editing) && (
        <div className="bg-white p-8 rounded-3xl border border-indigo-100 shadow-2xl shadow-indigo-500/5 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <DynamicIcon iconKey={editing ? "ui_edit" : "ui_plus"} config={icons} fallback="+" className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900">{editing ? "تعديل بيانات القسم" : "إضافة قسم جديد للمتجر"}</h2>
                    <p className="text-sm text-slate-500 font-bold">قم بتعبئة البيانات التالية لإدارة أقسام المتجر</p>
                </div>
            </div>
            <button onClick={() => { setEditing(null); setShowForm(false); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 transition-all">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <input type="hidden" name="currentPhotoUrl" value={editing?.photoUrl || ""} />
            <input type="hidden" name="active" value={editing ? String(editing.active) : "true"} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        اسم القسم
                    </label>
                    <input
                        name="name"
                        defaultValue={editing?.name || ""}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all"
                        placeholder="مثلاً: خضروات، ألبان..."
                        required
                    />
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
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        صورة القسم
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

                <div className="space-y-3 md:col-span-2 lg:col-span-3">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        ملاحظة تظهر للزبون (اختياري)
                    </label>
                    <textarea
                        name="notes"
                        defaultValue={editing?.notes || ""}
                        rows={2}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold transition-all resize-none"
                        placeholder="مثلاً: يتوفر توصيل مجاني لهذا القسم عند الشراء بأكثر من 25 ألف..."
                    />
                </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-slate-100">
              <button
                disabled={loading}
                className="flex-1 md:flex-none px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 disabled:opacity-50 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {loading ? "جاري الحفظ..." : "حفظ القسم الآن"}
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
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className={`relative group bg-white p-4 rounded-3xl border-2 transition-all duration-300 flex flex-col ${cat.active ? 'border-transparent shadow-xl shadow-slate-200/40 hover:border-indigo-100' : 'border-slate-100 bg-slate-50/50 grayscale opacity-80'}`}
          >
            {/* Status Badge */}
            <div className={`absolute top-6 left-6 z-10 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter shadow-sm border ${cat.active ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-200 text-slate-500 border-slate-300'}`}>
                {cat.active ? 'نشط' : 'مخفي'}
            </div>

            <Link href={`${SECRET_ADMIN_PATH}/store/branches?categoryId=${cat.id}`} className="flex-1 block">
              <div className="relative aspect-square mb-4 overflow-hidden rounded-2xl bg-slate-50 shadow-inner group-hover:shadow-indigo-100 transition-all">
                {cat.photoUrl ? (
                  <img src={cat.photoUrl} alt={cat.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-slate-50 to-indigo-50/30">
                    <DynamicIcon iconKey="ui_folder" config={icons} fallback="📂" className="w-16 h-16 text-indigo-200" />
                  </div>
                )}
              </div>
              <h3 className="font-black text-slate-900 text-center text-lg group-hover:text-indigo-600 transition-colors line-clamp-1">{cat.name}</h3>
              <p className="text-[10px] text-slate-400 text-center font-black uppercase mt-1">تسلسل {cat.sequence}</p>
            </Link>

            {/* Actions Bar */}
            <div className="mt-5 grid grid-cols-3 gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={() => {
                  setEditing(cat);
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-2.5 bg-sky-50 text-sky-700 rounded-xl text-[10px] font-black hover:bg-sky-100 transition-colors flex items-center justify-center border border-sky-100/50"
                title="تعديل"
              >
                <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleToggleActive(cat)}
                className={`p-2.5 rounded-xl text-[10px] font-black transition-colors flex items-center justify-center border ${cat.active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100/50' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100/50'}`}
                title={cat.active ? "إخفاء من المتجر" : "إظهار في المتجر"}
              >
                {cat.active ? (
                  <DynamicIcon iconKey="ui_eye_off" config={icons} fallback="👁️" className="w-3.5 h-3.5" />
                ) : (
                  <DynamicIcon iconKey="ui_eye" config={icons} fallback="🕶️" className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => setConfirmDelete(cat.id)}
                className="p-2.5 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-colors flex items-center justify-center border border-rose-100/50"
                title="حذف نهائي"
              >
                <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Custom Confirm Delete Overlay */}
            {confirmDelete === cat.id && (
                <div className="absolute inset-0 z-20 bg-slate-900/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200">
                    <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-500/20">
                        <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-6 h-6" />
                    </div>
                    <p className="text-white font-black text-sm mb-4">هل أنت متأكد من الحذف؟</p>
                    <div className="flex gap-2 w-full">
                        <button
                            onClick={async () => {
                                await deleteCategory(cat.id);
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
