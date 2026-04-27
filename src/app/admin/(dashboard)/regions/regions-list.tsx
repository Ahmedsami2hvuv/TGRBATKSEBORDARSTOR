"use client";

import { useState } from "react";
import { ad } from "@/lib/admin-ui";

import { updateRegionAction } from "./actions";

export function RegionsList({ initialRegions }: { initialRegions: any[] }) {
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
    let price = Number(r.deliveryPrice);
    setEditPrice(String(price >= 1000 ? price / 1000 : price));
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

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="🔍 ابحث عن منطقة..."
        className="w-full p-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((region) => (
          <div key={region.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex justify-between items-start">
            {editingId === region.id ? (
              <div className="flex flex-col gap-2 w-full">
                <input value={editName} onChange={e => setEditName(e.target.value)} className="border p-1 rounded text-sm" />
                <input value={editPrice} onChange={e => setEditPrice(e.target.value)} className="border p-1 rounded text-sm" type="number" />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(region.id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs">حفظ</button>
                  <button onClick={() => setEditingId(null)} className="bg-gray-400 text-white px-2 py-1 rounded text-xs">إلغاء</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-bold text-gray-800">{region.name}</h3>
                  <p className="text-sm text-gray-500">
                    سعر التوصيل: {Number(region.deliveryPrice) >= 1000 ? Number(region.deliveryPrice) / 1000 : region.deliveryPrice} د.ع
                  </p>
                </div>
                <button onClick={() => startEdit(region)} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold">تعديل</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
