"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ad } from "@/lib/admin-ui";

import { deleteRegionAction, updateRegionAction } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function RegionsList({ initialRegions, icons }: { initialRegions: any[], icons: GlobalIconsConfig | null }) {
  const [search, setSearch] = useState("");
  const [regions, setRegions] = useState(initialRegions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = regions.filter(r => r.name.includes(search));

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditName(r.name);
    setEditPrice(String(r.deliveryPrice));
  };

  const saveEdit = async (id: string) => {
    setLoading(true);
    try {
      const result = await updateRegionAction(id, editName, Number(editPrice));
      if (result.success) {
        setRegions(regions.map(r => r.id === id ? { ...r, name: editName, deliveryPrice: editPrice } : r));
        setEditingId(null);
      } else {
        alert("فشل الحفظ: " + result.message);
      }
    } catch (err) {
      alert("خطأ في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف منطقة "${name}"؟`)) return;
    setLoading(true);
    try {
      const result = await deleteRegionAction(id);
      if (result.success) {
        setRegions(regions.filter(r => r.id !== id));
        setEditingId(null);
      } else {
        alert("فشل الحذف: " + result.message);
      }
    } catch (err) {
      alert("خطأ في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4 relative">
        <input
          type="text"
          placeholder="ابحث عن منطقة..."
          className="flex-1 p-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
           <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-5 h-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((region) => (
          <div key={region.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex justify-between items-start">
            {editingId === region.id ? (
              <div className="flex flex-col gap-2 w-full">
                <label className="text-xs font-bold text-gray-600">اسم المنطقة</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                <label className="text-xs font-bold text-gray-600">سعر التوصيل (بالآلاف)</label>
                <input value={editPrice} onChange={e => setEditPrice(e.target.value)} className="border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" type="number" />
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(region.id)} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      {loading ? "حفظ..." : "حفظ"}
                    </button>
                    <button onClick={() => setEditingId(null)} disabled={loading} className="bg-slate-400 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                      إلغاء
                    </button>
                  </div>
                  <button onClick={() => handleDelete(region.id, region.name)} disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                    🗑️ حذف
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-bold text-gray-800">{region.name}</h3>
                  <p className="text-sm text-gray-500">
                    سعر التوصيل: {region.deliveryPrice} ألف
                  </p>
                </div>
                <button onClick={() => startEdit(region)} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1">
                  <DynamicIcon iconKey="ui_edit" config={icons} fallback="تعديل" className="w-3.5 h-3.5" />
                  تعديل
                </button>
                <Link
                  href={`/abo1stor3hlaa2kbr8-47/regions/${region.id}/edit`}
                  className="ms-2 text-slate-600 hover:text-slate-800 text-xs font-bold"
                >
                  المداخل
                </Link>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
