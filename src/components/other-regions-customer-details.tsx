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
          className="group relative inline-flex h-[32px] items-center justify-center gap-1.5 rounded-[12px] border border-[#D0DDFB] bg-[#0B2E8C] px-2.5 text-[11px] font-extrabold text-[#FFC107] shadow-xs hover:bg-[#1E4DB7] active:scale-[0.96] transition-all cursor-pointer"
          style={{
            fontSize: fontSizeConfig ? `${fontSizeConfig.locationBtnSize}px` : undefined,
            height: fontSizeConfig ? `${Math.max(28, fontSizeConfig.locationBtnSize + 14)}px` : undefined,
          }}
          title="عرض تفاصيل الزبون المسجلة في مناطق أخرى وسحبها"
        >
          {btnCustom?.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={btnCustom.imageUrl} alt="تفاصيل أخرى" className="w-3.5 h-3.5 object-contain shrink-0 pointer-events-none" />
          ) : (
            <svg className="w-3.5 h-3.5 text-[#FFC107] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          )}
          <span className="leading-none text-[11px] font-extrabold text-[#FFC107]">
            تفاصيل أخرى
          </span>
          <span className="h-[18px] min-w-[18px] px-1 rounded-full bg-[#FFC107] text-[#0B2E8C] text-[10px] font-black flex items-center justify-center shadow-xs leading-none">
            {profiles.length}
          </span>
        </button>
      </div>

      {showModal && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[#0B2E8C]/50 p-4 backdrop-blur-xs overflow-y-auto" dir="rtl">
            <div className="w-full max-w-lg animate-in fade-in zoom-in-95 rounded-[24px] border-[2px] border-[#D0DDFB] bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-[#F0F4FF] bg-[#FFFBEB] px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2E8C] text-[#FFC107]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </span>
                  <h3 className="text-base font-extrabold text-[#0B2E8C]">
                    تفاصيل الزبون في مناطق أخرى
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowModal(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex flex-col gap-3">
                <div className="rounded-[14px] bg-[#F0F4FF] border border-[#D0DDFB] p-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#7A90C0]">رقم الهاتف المسجل:</span>
                  <span className="font-mono font-extrabold text-xs text-[#0B2E8C]" dir="ltr">{phone}</span>
                </div>

                {profiles.map((p) => (
                  <div key={p.id} className="rounded-[18px] border border-[#D0DDFB] bg-[#F9FBFF] p-3.5 flex flex-col gap-3 shadow-2xs">
                    <div className="flex items-center gap-2 border-b border-[#E2ECFF] pb-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B2E8C] text-[#FFC107]">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </span>
                      <h4 className="font-extrabold text-[#0B2E8C] text-xs shrink-0">منطقة: {p.region?.name || "غير محدد"}</h4>
                      {(currentRegionId || orderId) && (
                        <button
                          type="button"
                          disabled={pullingId !== null}
                          onClick={() => handlePull(p.regionId)}
                          className="mr-auto flex items-center gap-1.5 rounded-[10px] text-[#0B2E8C] bg-[#FFC107] hover:bg-[#ffcd38] disabled:opacity-50 px-3 py-1.5 text-[11px] font-extrabold transition shadow-2xs cursor-pointer"
                        >
                          {pullingId === `${p.regionId}-all` ? (
                            <span className="animate-spin text-xs leading-none">↻</span>
                          ) : (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          )}
                          <span>سحب الكل للطلب</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        {p.alternatePhone && (
                          <div className="flex items-center gap-1.5 text-xs rounded-[10px] bg-white border border-[#D0DDFB] p-2">
                            <span className="font-bold text-[#7A90C0]">رقم بديل:</span>
                            <span className="font-mono font-extrabold text-[#0B2E8C]" dir="ltr">{p.alternatePhone}</span>
                            {(currentRegionId || orderId) && (
                              <button onClick={() => handlePull(p.regionId, "alternatePhone")} disabled={pullingId !== null} className="mr-auto text-[#0B2E8C] hover:bg-slate-100 p-1 rounded-md transition" title="سحب الرقم البديل">
                                {pullingId === `${p.regionId}-alternatePhone` ? <span className="animate-spin text-xs inline-block">↻</span> : (
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                        {p.landmark && (
                          <div className="flex flex-col gap-1 text-xs rounded-[10px] bg-white border border-[#D0DDFB] p-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#7A90C0]">أقرب نقطة دالة:</span>
                              {(currentRegionId || orderId) && (
                                <button onClick={() => handlePull(p.regionId, "landmark")} disabled={pullingId !== null} className="text-[#0B2E8C] hover:bg-slate-100 p-1 rounded-md transition" title="سحب الدالة">
                                  {pullingId === `${p.regionId}-landmark` ? <span className="animate-spin text-xs inline-block">↻</span> : (
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  )}
                                </button>
                              )}
                            </div>
                            <span className="font-bold text-[#0B2E8C]">{p.landmark}</span>
                          </div>
                        )}
                        {p.notes && (
                          <div className="flex flex-col gap-1 text-xs rounded-[10px] bg-white border border-[#D0DDFB] p-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#7A90C0]">ملاحظات:</span>
                              {(currentRegionId || orderId) && (
                                <button onClick={() => handlePull(p.regionId, "notes")} disabled={pullingId !== null} className="text-[#0B2E8C] hover:bg-slate-100 p-1 rounded-md transition" title="سحب الملاحظات">
                                  {pullingId === `${p.regionId}-notes` ? <span className="animate-spin text-xs inline-block">↻</span> : (
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  )}
                                </button>
                              )}
                            </div>
                            <span className="font-bold text-[#0B2E8C] whitespace-pre-wrap">{p.notes}</span>
                          </div>
                        )}
                        {p.locationUrl && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <a href={p.locationUrl} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[12px] bg-[#0B2E8C] px-3 py-2 text-xs font-bold text-[#FFC107] hover:bg-[#1E4DB7] transition">
                              <svg className="w-3.5 h-3.5 text-[#FFC107]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              <span>فتح موقع الزبون</span>
                            </a>
                            {(currentRegionId || orderId) && (
                              <button onClick={() => handlePull(p.regionId, "locationUrl")} disabled={pullingId !== null} className="h-[34px] w-[34px] flex items-center justify-center text-[#0B2E8C] bg-[#FFC107] hover:bg-[#ffcd38] rounded-[10px] shrink-0 transition" title="سحب الموقع">
                                {pullingId === `${p.regionId}-locationUrl` ? <span className="animate-spin text-sm inline-block">↻</span> : (
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {p.photoUrl && (
                        <div className="flex flex-col gap-1 items-center relative rounded-[14px] bg-white border border-[#D0DDFB] p-2">
                          <div className="flex items-center justify-between w-full px-1">
                            <span className="text-[10px] font-bold text-[#7A90C0]">صورة الباب</span>
                            {(currentRegionId || orderId) && (
                              <button onClick={() => handlePull(p.regionId, "photoUrl")} disabled={pullingId !== null} className="text-[#0B2E8C] hover:bg-slate-100 p-1 rounded-md transition" title="سحب الصورة">
                                {pullingId === `${p.regionId}-photoUrl` ? <span className="animate-spin text-xs inline-block">↻</span> : (
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                )}
                              </button>
                            )}
                          </div>
                          <div className="aspect-square w-full sm:w-28 rounded-[12px] overflow-hidden border border-[#D0DDFB] bg-[#F0F4FF] shadow-2xs relative">
                            <img src={resolvePublicAssetSrc(p.photoUrl) || ""} alt="صورة الباب" className="w-full h-full object-cover" />
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
