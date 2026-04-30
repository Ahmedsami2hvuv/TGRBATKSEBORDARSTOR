"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { upsertCategory, deleteCategory } from "@/app/admin/(dashboard)/store/actions";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function StaffCategoryListClient({ initialCategories, authQ }: { initialCategories: any[], authQ: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

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
      alert(res.error || "حدث خطأ ما");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-full md:w-96">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
            <DynamicIcon icon={icons?.ui_search} className="w-4 h-4" fallback={<span>🔍</span>} />
          </span>
          <input
            type="text"
            placeholder="بحث عن قسم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 outline-none focus:border-violet-500 font-bold"
          />
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(!showForm);
          }}
          className="w-full md:w-auto px-6 py-2 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-700 transition shadow-lg flex items-center justify-center gap-2"
        >
          {showForm ? (
            <>
              إغلاق النموذج
              <DynamicIcon icon={icons?.ui_close} className="w-4 h-4 brightness-0 invert" fallback={<span>✕</span>} />
            </>
          ) : (
            <>
              <DynamicIcon icon={icons?.ui_add} className="w-4 h-4 brightness-0 invert" fallback={<span>+</span>} />
              إضافة قسم جديد
            </>
          )}
        </button>
      </div>

      {(showForm || editing) && (
        <div className="bg-white p-6 rounded-3xl border-2 border-violet-100 shadow-xl">
          <h2 className="text-xl font-bold mb-4">{editing ? "تعديل قسم" : "إضافة قسم جديد"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <input type="hidden" name="currentPhotoUrl" value={editing?.photoUrl || ""} />

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">اسم القسم</label>
              <input
                name="name"
                defaultValue={editing?.name || ""}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-violet-500 font-bold"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">التسلسل</label>
              <input
                name="sequence"
                type="number"
                defaultValue={editing?.sequence || 0}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-violet-500 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">الصورة</label>
              <input
                name="photo"
                type="file"
                accept="image/*"
                className="w-full px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-violet-500"
              />
            </div>

            <div className="md:col-span-3 flex gap-2 pt-2">
              <button
                disabled={loading}
                className="px-8 py-2 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? "جاري الحفظ..." : "حفظ القسم"}
              </button>
              <button
                type="button"
                onClick={() => {
                    setEditing(null);
                    setShowForm(false);
                }}
                className="px-8 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm group hover:border-violet-200 transition-all flex flex-col">
            <Link
              href={`/staff/portal/store/branches?categoryId=${cat.id}&${authQ}`}
              className="flex-1 block"
            >
              <div className="relative aspect-square mb-3 overflow-hidden rounded-[1.5rem] bg-slate-50 flex items-center justify-center">
                {cat.photoUrl ? (
                  <img src={cat.photoUrl} alt={cat.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <DynamicIcon icon={icons?.ui_package} className="w-12 h-12 text-slate-200" fallback={<span className="text-4xl">📁</span>} />
                )}
              </div>
              <h3 className="font-black text-slate-900 text-center group-hover:text-violet-600 transition-colors line-clamp-1 px-2">{cat.name}</h3>
              <p className="text-[10px] text-slate-400 text-center font-bold">تسلسل: {cat.sequence}</p>
            </Link>

            <div className="mt-3 grid grid-cols-2 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditing(cat);
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="py-1.5 bg-sky-50 text-sky-700 rounded-lg text-[10px] font-black hover:bg-sky-100"
              >
                تعديل
              </button>
              <button
                onClick={async () => {
                  if (confirm("حذف القسم؟")) {
                    await deleteCategory(cat.id);
                    window.location.reload();
                  }
                }}
                className="py-1.5 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-black hover:bg-rose-100"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
