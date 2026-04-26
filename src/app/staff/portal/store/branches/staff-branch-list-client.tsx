"use client";

import { useState } from "react";
import Link from "next/link";
import { upsertBranch, deleteBranch } from "@/app/admin/(dashboard)/store/actions";
import { compressImageFileForUpload } from "@/lib/client-image-compress";

export function StaffBranchListClient({
  initialBranches,
  categories,
  preparers,
  defaultCategoryId,
  authQ
}: {
  initialBranches: any[],
  categories: any[],
  preparers: any[],
  defaultCategoryId?: string,
  authQ: string
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const filteredBranches = initialBranches.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const potentialParents = initialBranches.filter(b => !b.parentBranchId && b.id !== editing?.id);

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

    const res = await upsertBranch(null, formData);
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
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="بحث في الأفرع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 outline-none focus:border-violet-500 font-bold"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(!showForm);
            }}
            className="flex-1 md:flex-none px-6 py-2 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-700 transition shadow-lg"
          >
            {showForm ? "إغلاق ✕" : "+ إضافة فرع"}
          </button>
          {defaultCategoryId && (
             <Link
                href={`/staff/portal/store/products?categoryId=${defaultCategoryId}&${authQ}`}
                className="flex-1 md:flex-none px-6 py-2 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition shadow-lg text-center"
             >
                + إدارة المنتجات
             </Link>
          )}
        </div>
      </div>

      {(showForm || editing) && (
        <div className="bg-white p-6 rounded-3xl border-2 border-violet-100 shadow-xl">
          <h2 className="text-xl font-bold mb-4">{editing ? "تعديل فرع" : "إضافة فرع جديد"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="hidden" name="id" value={editing?.id || ""} />
            <input type="hidden" name="currentPhotoUrl" value={editing?.photoUrl || ""} />

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">القسم الرئيسي</label>
              <select
                name="categoryId"
                defaultValue={editing?.categoryId || defaultCategoryId || ""}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-violet-500 font-bold text-sm"
                required
              >
                <option value="">اختر القسم...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">اسم الفرع</label>
              <input
                name="name"
                defaultValue={editing?.name || ""}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-violet-500 font-bold text-sm"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">الفرع الأب (اختياري)</label>
              <select
                name="parentBranchId"
                defaultValue={editing?.parentBranchId || ""}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-violet-500 font-bold text-sm"
              >
                <option value="">لا يوجد (فرع رئيسي)</option>
                {potentialParents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">التسلسل</label>
              <input
                name="sequence"
                type="number"
                defaultValue={editing?.sequence || 0}
                className="w-full px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-violet-500 font-bold text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-violet-600">المجهز المفوّض بالتسعير</label>
              <select
                name="authorizedPreparerId"
                defaultValue={editing?.authorizedPreparerId || ""}
                className="w-full px-4 py-2 rounded-xl border-2 border-violet-100 outline-none focus:border-violet-500 font-bold text-sm bg-violet-50/30"
              >
                <option value="">غير مفوّض (الإدارة فقط)</option>
                {preparers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-violet-600">هامش الربح (تلقائي)</label>
              <div className="relative">
                <input
                  name="profitMargin"
                  type="number"
                  step="0.01"
                  defaultValue={editing?.profitMargin || 0.25}
                  className="w-full px-4 py-2 rounded-xl border-2 border-violet-100 outline-none focus:border-violet-500 font-bold text-sm bg-violet-50/30"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">IQD</span>
              </div>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-bold text-slate-700">الصورة</label>
              <input
                name="photo"
                type="file"
                accept="image/*"
                className="w-full px-4 py-1.5 rounded-xl border border-slate-300 outline-none focus:border-violet-500 text-sm"
              />
            </div>

            <div className="md:col-span-4 flex gap-2 pt-2">
              <button
                disabled={loading}
                className="px-8 py-2 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-700 disabled:opacity-50 transition"
              >
                {loading ? "جاري الحفظ..." : "حفظ الفرع"}
              </button>
              <button
                type="button"
                onClick={() => {
                    setEditing(null);
                    setShowForm(false);
                }}
                className="px-8 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredBranches.map((br) => (
          <div key={br.id} className="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm group hover:border-violet-200 transition-all flex flex-col">
            <Link
              href={`/staff/portal/store/products?branchId=${br.id}&${authQ}`}
              className="flex-1 block"
            >
              <div className="relative aspect-square mb-3 overflow-hidden rounded-[1.5rem] bg-slate-50">
                {br.photoUrl ? (
                  <img src={br.photoUrl} alt={br.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🌿</div>
                )}
              </div>
              <div className="text-center px-2">
                <p className="text-[10px] font-black text-violet-600 mb-0.5">
                    {br.category?.name || "بدون قسم"} {br.parentBranch && `› ${br.parentBranch.name}`}
                </p>
                <h3 className="font-black text-slate-900 group-hover:text-violet-600 transition-colors line-clamp-1">{br.name}</h3>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <p className="text-[9px] text-slate-400 font-bold">تسلسل: {br.sequence}</p>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <p className="text-[9px] text-emerald-600 font-black">📦 {br._count?.products || 0}</p>
                </div>
              </div>
            </Link>

            <div className="mt-3 grid grid-cols-2 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditing(br);
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="py-1.5 bg-sky-50 text-sky-700 rounded-lg text-[10px] font-black hover:bg-sky-100"
              >
                تعديل
              </button>
              <button
                onClick={async () => {
                  if (confirm("حذف الفرع؟")) {
                    await deleteBranch(br.id);
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
