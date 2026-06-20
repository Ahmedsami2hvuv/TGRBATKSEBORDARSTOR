"use client";

import { useState } from "react";
import { ImportCustomersButton } from "./import-customers-button";
import { PhotoCleanupButton } from "./photo-cleanup-button";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function CustomersMaintenancePanel({ icons }: { icons: GlobalIconsConfig | null }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full md:w-auto flex flex-col items-stretch md:items-end gap-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between md:justify-start gap-2 bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 text-slate-700 px-5 py-2.5 rounded-2xl font-black text-xs transition-all shadow-sm border border-slate-200 active:scale-[0.98] select-none"
      >
        <div className="flex items-center gap-2">
          <DynamicIcon iconKey="ui_settings" config={icons} fallback="⚙️" className="w-4 h-4 text-slate-500" />
          <span>أدوات الصيانة والاستيراد</span>
        </div>
        <span className={`text-[10px] text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-lg mt-2 flex flex-col md:flex-row gap-5 w-full md:w-auto min-w-[320px] md:min-w-[650px] animate-in fade-in slide-in-from-top-2 duration-300 z-10 text-right">
          <div className="flex-1 flex flex-col">
            <h4 className="text-xs font-bold text-slate-400 mb-3 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <span>📥</span> أدوات استيراد الزبائن والتنظيف
            </h4>
            <div className="flex-1 flex items-start justify-end">
              <ImportCustomersButton icons={icons} />
            </div>
          </div>
          <div className="border-t md:border-t-0 md:border-r border-slate-100 pt-4 md:pt-0 md:pr-5 flex flex-col md:w-[260px]">
            <h4 className="text-xs font-bold text-slate-400 mb-3 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <span>📷</span> صيانة وتصغير الصور
            </h4>
            <div className="flex justify-end">
              <PhotoCleanupButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
