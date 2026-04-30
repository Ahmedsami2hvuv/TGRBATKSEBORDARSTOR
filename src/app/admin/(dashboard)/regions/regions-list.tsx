"use client";

import { useEffect, useState } from "react";
import { ad } from "@/lib/admin-ui";

import { updateRegionAction } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

export function RegionsList({ initialRegions }: { initialRegions: any[] }) {
  const [search, setSearch] = useState("");
  const [regions, setRegions] = useState(initialRegions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

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

  const runFix = async () => {
    if (!confirm("هل تريد حقاً تصحيح كافة الأسعار التالفة في قاعدة البيانات؟ سيتم تحويل القيم مثل 3 أو 0.003 إلى 3000.")) return;
    setLoading(true);
    try {
      const { fixAllDatabaseDeliveryPrices } = await import("./actions");
      const result = await fixAllDatabaseDeliveryPrices();
      if (result.success) {
        alert("تم إصلاح البيانات بنجاح. يرجى تحديث الصفحة.");
        window.location.reload();
      } else {
        alert("فشل الإصلاح: " + result.message);
      }
    } catch (err) {
      alert("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <input
          type="text"
          placeholder="🔍 ابحث عن منطقة..."
          className="flex-1 p-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={runFix}
          disabled={loading}
          className="px-4 py-3 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? "جاري الإصلاح..." : <><DynamicIcon icon={icons?.ui_settings} fallback="🛠️" className="w-4 h-4" /> إصلاح كافة الأسعار</>}
        </button>
      </div>

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
                <button onClick={() => startEdit(region)} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1">
                  <DynamicIcon icon={icons?.ui_edit} fallback="تعديل" className="w-3.5 h-3.5" />
                  تعديل
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
