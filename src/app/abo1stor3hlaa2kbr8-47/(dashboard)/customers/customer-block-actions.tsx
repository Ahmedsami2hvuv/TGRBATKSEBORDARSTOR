"use client";

import { useState } from "react";
import { toggleCustomerRegionsBlock } from "./profiles/actions";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function CustomerBlockActions({
  phone,
  regions,
  icons
}: {
  phone: string;
  regions: { id: string; regionId: string; name: string; isBlocked: boolean }[];
  icons: GlobalIconsConfig | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [isBlocking, setIsBlocking] = useState(true); // true for block, false for unblock
  const [loading, setLoading] = useState(false);

  const blockedRegions = regions.filter(r => r.isBlocked);
  const unblockedRegions = regions.filter(r => !r.isBlocked);

  const handleOpen = (blocking: boolean) => {
    setIsBlocking(blocking);
    if (blocking) {
      // Default to all unblocked regions if blocking
      setSelectedRegionIds(unblockedRegions.map(r => r.regionId));
    } else {
      // Default to all blocked regions if unblocking
      setSelectedRegionIds(blockedRegions.map(r => r.regionId));
    }
    setIsOpen(true);
  };

  const handleToggleAll = () => {
    const targetRegions = isBlocking ? unblockedRegions : blockedRegions;
    if (selectedRegionIds.length === targetRegions.length) {
      setSelectedRegionIds([]);
    } else {
      setSelectedRegionIds(targetRegions.map(r => r.regionId));
    }
  };

  const handleSubmit = async () => {
    if (selectedRegionIds.length === 0) return;
    setLoading(true);
    const res = await toggleCustomerRegionsBlock({
      phone,
      regionIds: selectedRegionIds,
      block: isBlocking
    });
    setLoading(false);
    if (res.ok) {
      setIsOpen(false);
      // The page will revalidate due to revalidatePath in the action
    } else {
      alert(res.error || "حدث خطأ غير متوقع");
    }
  };

  return (
    <div className="flex gap-2 mt-1">
      {unblockedRegions.length > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpen(true);
          }}
          className="text-[10px] font-bold text-red-600 border border-red-200 px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors"
        >
          حظر
        </button>
      )}
      {blockedRegions.length > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpen(false);
          }}
          className="text-[10px] font-bold text-green-600 border border-green-200 px-2 py-0.5 rounded-md hover:bg-green-50 transition-colors"
        >
          إزالة حظر
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-gray-800 mb-2">
              {isBlocking ? "حظر الزبون" : "إزالة الحظر"}
            </h3>
            <p className="text-sm text-gray-500 mb-4 font-bold">الرقم: <span className="text-blue-600 tabular-nums">{phone}</span></p>

            <div className="mb-4">
               <p className="text-xs font-bold text-gray-400 mb-2">اختر المناطق المراد {isBlocking ? "حظرها" : "إلغاء حظرها"}:</p>
               <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer border border-gray-100 transition-colors bg-gray-50/30">
                    <input
                      type="checkbox"
                      checked={selectedRegionIds.length === (isBlocking ? unblockedRegions : blockedRegions).length}
                      onChange={handleToggleAll}
                      className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-black text-sm text-gray-700">تحديد الكل</span>
                  </label>

                  {(isBlocking ? unblockedRegions : blockedRegions).map(r => (
                    <label key={r.regionId} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer border border-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedRegionIds.includes(r.regionId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRegionIds([...selectedRegionIds, r.regionId]);
                          } else {
                            setSelectedRegionIds(selectedRegionIds.filter(id => id !== r.regionId));
                          }
                        }}
                        className="w-5 h-5 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-bold text-gray-600">{r.name}</span>
                    </label>
                  ))}
               </div>
            </div>

            <div className="flex gap-3">
              <button
                disabled={loading || selectedRegionIds.length === 0}
                onClick={handleSubmit}
                className={`flex-2 py-3 px-4 rounded-xl font-black text-sm text-white transition-all active:scale-95 shadow-lg ${isBlocking ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-green-600 hover:bg-green-700 shadow-green-100'} disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex-1`}
              >
                {loading ? "جاري الحفظ..." : "تأكيد"}
              </button>
              <button
                disabled={loading}
                onClick={() => setIsOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl font-black text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
