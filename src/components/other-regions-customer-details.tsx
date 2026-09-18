"use client";

import { useEffect, useState } from "react";
import { getCustomerOtherRegionsDetails, pullCustomerProfileDetails } from "@/app/actions/customer-other-regions";
import { createPortal } from "react-dom";
import { DynamicIcon } from "@/components/dynamic-icon";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { type OrderCardDesignerConfig, getElementStyle } from "@/lib/order-card-customizer";

export function OtherRegionsCustomerDetails({
  phone,
  currentRegionId,
  currentRegionName,
  icons,
  fontSizeConfig,
  prefetchedProfiles,
  orderId,
  isSecondDestination,
  designerConfig,
}: {
  phone?: string | null;
  currentRegionId?: string | null;
  currentRegionName?: string | null;
  icons?: any;
  fontSizeConfig?: any;
  prefetchedProfiles?: any[];
  orderId?: string | null;
  isSecondDestination?: boolean;
  designerConfig?: OrderCardDesignerConfig;
}) {
  const [profiles, setProfiles] = useState<any[]>(prefetchedProfiles || []);
  const [loading, setLoading] = useState(!prefetchedProfiles);
  const [showModal, setShowModal] = useState(false);
  const [pullingId, setPullingId] = useState<string | null>(null);

  const handlePull = async (fromRegionId: string, field?: "locationUrl" | "photoUrl" | "notes" | "landmark" | "alternatePhone") => {
    if (!phone) return;
    setPullingId(`${fromRegionId}-${field || 'all'}`);
    try {
      const res = await pullCustomerProfileDetails(phone, fromRegionId, currentRegionId, field, orderId, isSecondDestination);
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.message || "فشل سحب المعلومات");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء سحب المعلومات");
    } finally {
      setPullingId(null);
    }
  };

  useEffect(() => {
    if (prefetchedProfiles) return;
    if (!phone) {
      setLoading(false);
      return;
    }
    getCustomerOtherRegionsDetails(phone, currentRegionId, currentRegionName)
      .then((data) => setProfiles(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [phone, currentRegionId, currentRegionName, prefetchedProfiles]);

  if (loading || profiles.length === 0) return null;

  const btnCustom = designerConfig?.customerCard?.btnOtherDetails;
  if (btnCustom?.hidden) return null;

  return (
    <>
      <div className="inline-flex w-fit origin-center" style={getElementStyle(btnCustom)}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowModal(true);
          }}
          className="group relative inline-flex h-[28px] sm:h-[30px] items-center justify-center gap-1.5 rounded-[9px] border-[1.5px] border-[#C9A86A] bg-gradient-to-r from-[#FFF8E1] via-[#FFFEFB] to-[#F7EAC8] px-2.5 text-[11px] font-black text-[#0A3D2E] shadow-[0_2px_8px_rgba(201,168,106,0.22),inset_0_1px_0_white] hover:shadow-[0_4px_12px_rgba(201,168,106,0.38)] hover:border-[#8B6A2A] active:scale-[0.96] transition-all cursor-pointer"
          style={{
            fontSize: fontSizeConfig ? `${fontSizeConfig.locationBtnSize}px` : undefined,
            height: fontSizeConfig ? `${Math.max(28, fontSizeConfig.locationBtnSize + 14)}px` : undefined
          }}
          title="عرض تفاصيل الزبون المسجلة في مناطق أخرى وسحبها"
        >
          {btnCustom?.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={btnCustom.imageUrl} alt="تفاصيل أخرى" className="w-3.5 h-3.5 object-contain shrink-0 pointer-events-none" />
          ) : (
            <span className="text-[12px] shrink-0">🌍</span>
          )}
          <span className="leading-none text-[11px] font-black text-[#0A3D2E]">
            تفاصيل أخرى
          </span>
          <span className="h-[18px] min-w-[18px] px-1 rounded-full bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A]/40 text-[10px] font-black flex items-center justify-center shadow-sm leading-none">
            {profiles.length}
          </span>
        </button>
      </div>

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
                      <h4 className="font-black text-sky-900 dark:text-sky-300 text-sm shrink-0">منطقة: {p.region?.name || "غير محدد"}</h4>
                      {(currentRegionId || orderId) && (
                        <button
                          type="button"
                          disabled={pullingId !== null}
                          onClick={() => handlePull(p.regionId)}
                          className="mr-auto flex items-center gap-1 rounded text-sky-600 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 px-2 py-1 text-[10px] font-bold transition border border-sky-100"
                        >
                          {pullingId === `${p.regionId}-all` ? (
                            <span className="animate-spin text-xs leading-none">↻</span>
                          ) : (
                            <span className="text-xs leading-none">📥</span>
                          )}
                          <span>سحب الكل</span>
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        {p.alternatePhone && (
                          <div className="flex items-center gap-1.5 text-xs group">
                            <span className="font-bold text-slate-500">رقم بديل:</span>
                            <span className="font-mono font-black text-slate-800 dark:text-slate-200" dir="ltr">{p.alternatePhone}</span>
                            {(currentRegionId || orderId) && (
                              <button onClick={() => handlePull(p.regionId, "alternatePhone")} disabled={pullingId !== null} className="mr-auto opacity-70 hover:opacity-100 disabled:opacity-30 text-sky-600 bg-sky-100 p-1 rounded-md" title="سحب الرقم البديل">
                                {pullingId === `${p.regionId}-alternatePhone` ? <span className="animate-spin text-xs inline-block">↻</span> : "📥"}
                              </button>
                            )}
                          </div>
                        )}
                        {p.landmark && (
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-500">أقرب نقطة دالة:</span>
                              {(currentRegionId || orderId) && (
                                <button onClick={() => handlePull(p.regionId, "landmark")} disabled={pullingId !== null} className="opacity-70 hover:opacity-100 disabled:opacity-30 text-sky-600 bg-sky-100 p-1 rounded-md" title="سحب الدالة">
                                  {pullingId === `${p.regionId}-landmark` ? <span className="animate-spin text-xs inline-block">↻</span> : "📥"}
                                </button>
                              )}
                            </div>
                            <span className="font-black text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-1.5 rounded">{p.landmark}</span>
                          </div>
                        )}
                        {p.notes && (
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-500">ملاحظات:</span>
                              {(currentRegionId || orderId) && (
                                <button onClick={() => handlePull(p.regionId, "notes")} disabled={pullingId !== null} className="opacity-70 hover:opacity-100 disabled:opacity-30 text-sky-600 bg-sky-100 p-1 rounded-md" title="سحب الملاحظات">
                                  {pullingId === `${p.regionId}-notes` ? <span className="animate-spin text-xs inline-block">↻</span> : "📥"}
                                </button>
                              )}
                            </div>
                            <span className="font-black text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-1.5 rounded whitespace-pre-wrap">{p.notes}</span>
                          </div>
                        )}
                        {p.locationUrl && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <a href={p.locationUrl} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition">
                              <span>📍</span> فتح موقع الزبون
                            </a>
                            {(currentRegionId || orderId) && (
                              <button onClick={() => handlePull(p.regionId, "locationUrl")} disabled={pullingId !== null} className="h-[32px] w-[32px] flex items-center justify-center opacity-70 hover:opacity-100 disabled:opacity-30 text-sky-600 bg-sky-100 rounded-lg shrink-0" title="سحب الموقع">
                                {pullingId === `${p.regionId}-locationUrl` ? <span className="animate-spin text-sm inline-block">↻</span> : "📥"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {p.photoUrl && (
                        <div className="flex flex-col gap-1 items-center relative">
                          <div className="flex items-center justify-between w-full sm:w-28 px-1">
                            <span className="text-[10px] font-bold text-slate-400">صورة الباب</span>
                            {(currentRegionId || orderId) && (
                              <button onClick={() => handlePull(p.regionId, "photoUrl")} disabled={pullingId !== null} className="opacity-70 hover:opacity-100 disabled:opacity-30 text-sky-600 bg-sky-100 p-1 rounded-md shrink-0" title="سحب الصورة">
                                {pullingId === `${p.regionId}-photoUrl` ? <span className="animate-spin text-xs inline-block">↻</span> : "📥"}
                              </button>
                            )}
                          </div>
                          <div className="aspect-square w-full sm:w-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black shadow-sm relative">
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
