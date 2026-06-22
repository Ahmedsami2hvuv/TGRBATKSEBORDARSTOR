"use client";

import { useEffect, useState } from "react";
import { getCustomerOtherRegionsDetails } from "@/app/actions/customer-other-regions";
import { createPortal } from "react-dom";
import { DynamicIcon } from "@/components/dynamic-icon";
import { resolvePublicAssetSrc } from "@/lib/image-url";

export function OtherRegionsCustomerDetails({
  phone,
  currentRegionId,
  icons,
  fontSizeConfig,
}: {
  phone?: string | null;
  currentRegionId?: string | null;
  icons?: any;
  fontSizeConfig?: any;
}) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }
    getCustomerOtherRegionsDetails(phone, currentRegionId)
      .then((data) => setProfiles(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [phone, currentRegionId]);

  if (loading || profiles.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowModal(true);
        }}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-right transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-900/40"
      >
        <span className="text-xs font-black text-amber-900 dark:text-amber-200" style={{ fontSize: fontSizeConfig ? `${fontSizeConfig.smartHintFontSize}px` : undefined }}>
          ⚠️ الزبون لديه تفاصيل في {profiles.length} منطقة أخرى
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100 shrink-0">
          <DynamicIcon iconKey="ui_chevron_left" config={icons} fallback="‹" className="w-4 h-4" />
        </span>
      </button>

      {showModal && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto" dir="rtl">
            <div className="w-full max-w-lg animate-in fade-in zoom-in-95 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-950/50 px-4 py-3 shrink-0">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🌍</span> تفاصيل الزبون في مناطق أخرى
                </h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowModal(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  <DynamicIcon iconKey="ui_close" config={icons} fallback="✕" className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex flex-col gap-4">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                  رقم الهاتف: <span className="font-mono text-slate-900 dark:text-white" dir="ltr">{phone}</span>
                </p>

                {profiles.map((p) => (
                  <div key={p.id} className="rounded-xl border border-sky-100 dark:border-sky-900/30 bg-sky-50/50 dark:bg-sky-950/20 p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 border-b border-sky-100 dark:border-sky-900/30 pb-2">
                      <span className="text-lg">📍</span>
                      <h4 className="font-black text-sky-900 dark:text-sky-300 text-sm">منطقة: {p.region?.name || "غير محدد"}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        {p.alternatePhone && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-bold text-slate-500">رقم بديل:</span>
                            <span className="font-mono font-black text-slate-800 dark:text-slate-200" dir="ltr">{p.alternatePhone}</span>
                          </div>
                        )}
                        {p.landmark && (
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="font-bold text-slate-500">أقرب نقطة دالة:</span>
                            <span className="font-black text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-1.5 rounded">{p.landmark}</span>
                          </div>
                        )}
                        {p.notes && (
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="font-bold text-slate-500">ملاحظات:</span>
                            <span className="font-black text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-1.5 rounded whitespace-pre-wrap">{p.notes}</span>
                          </div>
                        )}
                        {p.locationUrl && (
                          <div className="mt-1">
                            <a href={p.locationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition">
                              <span>📍</span> فتح موقع الزبون
                            </a>
                          </div>
                        )}
                      </div>
                      
                      {p.photoUrl && (
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-[10px] font-bold text-slate-400">صورة الباب</span>
                          <div className="aspect-square w-full sm:w-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black shadow-sm">
                            <img src={resolvePublicAssetSrc(p.photoUrl) || ""} alt="صورة الباب" className="w-full h-full object-contain" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
