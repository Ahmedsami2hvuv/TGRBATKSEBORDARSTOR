"use client";

import { Fragment, useState, useEffect } from "react";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { OrderTypeLine } from "@/components/order-type-line";
import { formatBaghdadDateFriendly, getBaghdadDateString, formatBaghdadDateTime } from "@/lib/baghdad-time";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";

/** مكون مشغل الصوت المصغر */
function MiniAudioPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const fullUrl = resolvePublicAssetSrc(url);
  return (
    <div className="flex items-center" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => {
          const audio = document.getElementById(`audio-${url}`) as HTMLAudioElement;
          if (playing) audio.pause(); else audio.play();
          setPlaying(!playing);
        }}
        className="flex size-7 items-center justify-center rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 active:scale-90 transition-all border-2 border-white"
      >
        {playing ? <span className="text-[10px]">⏸</span> : <span className="text-[10px] mr-[-1px]">▶️</span>}
      </button>
      <audio id={`audio-${url}`} src={fullUrl!} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}

/** مكون الحاوية المركزية للنوافذ المنبثقة */
function CenterModal({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <span className="font-bold text-slate-800">{title}</span>
          <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">✕</button>
        </div>
        <div className="p-2">
          {children}
        </div>
      </div>
    </div>
  );
}

/** مكون نافذة الصورة المنبثقة */
function ImageModal({ url, title, onClose }: { url: string, title: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <span className="font-bold text-slate-800 text-base">{title}</span>
          <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 font-bold hover:bg-slate-300 transition-all">✕</button>
        </div>
        <div className="p-1 bg-slate-200">
           <img src={resolvePublicAssetSrc(url)!} alt={title} className="w-full h-auto max-h-[75vh] object-contain rounded-2xl shadow-inner" />
        </div>
      </div>
    </div>
  );
}

type Props = {
  rows: MandoubRow[];
  colCount: number;
  showSelectColumn: boolean;
  isRowSelectable: (row: MandoubRow) => boolean;
  isSelected: (id: string) => boolean;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onOpenRow: (id: string) => void;
  selectAllTitle: string;
  selectAllAriaLabel: string;
  selectedTitle: string;
  selectedAriaPrefix: string;
  showStatusDotInSelectCol: boolean;
  /**
   * مخصّص للعلامة داخل عمود رقم الطلب (#) بدل كرة الحالة الملونة.
   * إذا أرجعنا `null` يتم إخفاء الكرات تماماً في هذا السياق.
   */
  renderOrderIdBadge?: (row: MandoubRow) => React.ReactNode;
  renderBelowOrderId?: (row: MandoubRow) => React.ReactNode;
  renderSelectActions?: (row: MandoubRow) => React.ReactNode;
  hideLocationAlert?: boolean;
  hideShortIdInBadgeCol?: boolean;
  renderInShopNameCol?: (row: MandoubRow) => React.ReactNode;
};

export function UnifiedOrderListTable({
  rows,
  colCount,
  showSelectColumn,
  isRowSelectable,
  isSelected,
  allSelected,
  onToggleAll,
  onToggleOne,
  onOpenRow,
  selectAllTitle,
  selectAllAriaLabel,
  selectedTitle,
  selectedAriaPrefix,
  showStatusDotInSelectCol,
  renderOrderIdBadge,
  renderBelowOrderId,
  renderSelectActions,
  hideLocationAlert,
  hideShortIdInBadgeCol,
  renderInShopNameCol,
}: Props) {
  const [modalImg, setModalImg] = useState<{ url: string, title: string } | null>(null);
  const [showNotes, setShowNotes] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [activeLocId, setActiveLocId] = useState<string | null>(null);
  const [activeDoorId, setActiveDoorId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveCallId(null);
      setActiveMsgId(null);
      setActiveLocId(null);
      setActiveDoorId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  let lastDateStr = "";

  // نعدل colCount ليكون +1 بسبب إضافة عمود التاريخ
  const adjustedColCount = colCount + 1;

  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-collapse text-base sm:text-lg ${showSelectColumn ? "min-w-[880px]" : "min-w-[820px]"}`}
      >
        <thead>
          <tr className="border-b border-sky-200 bg-sky-50 text-right">
            {showSelectColumn ? (
              <th className="sticky right-0 z-10 w-14 min-w-[3.25rem] max-w-[3.5rem] bg-sky-50 px-1 py-3.5 text-center font-bold text-sky-900 shadow-[-4px_0_8px_-2px_rgba(15,23,42,0.1)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="mx-auto h-5 w-5 rounded border-sky-400 text-sky-600 accent-sky-600"
                  title={selectAllTitle}
                  aria-label={selectAllAriaLabel}
                />
              </th>
            ) : null}
            <th className="px-2 py-3.5 font-bold text-sky-900">#</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">اسم المحل</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">المنطقة</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">نوع</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">السعر</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">التوصيل</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">الهاتف</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">وقت</th>
            <th className="px-2 py-3.5 font-bold text-sky-900">تاريخ الرفع</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={adjustedColCount}
                className="px-4 py-10 text-center text-base text-slate-500 sm:text-lg"
              >
                لا توجد طلبات في هذا العرض.
              </td>
            </tr>
          ) : (
            rows.map((o) => {
              const selectable = showSelectColumn && isRowSelectable(o);
              const checked = isSelected(o.id);

              const orderDate = o.createdAt ? (typeof o.createdAt === 'string' ? new Date(o.createdAt) : o.createdAt) : null;
              const currentDateStr = orderDate ? getBaghdadDateString(orderDate) : "unknown";

              let separator = null;
              if (currentDateStr !== lastDateStr) {
                lastDateStr = currentDateStr;
                separator = (
                  <tr key={`date-sep-${currentDateStr}`} className="bg-slate-100/80">
                    <td colSpan={adjustedColCount} className="px-4 py-3 text-right text-xs font-black text-black uppercase tracking-widest border-y border-slate-200">
                      {orderDate ? formatBaghdadDateFriendly(orderDate) : "تاريخ غير معروف"}
                    </td>
                  </tr>
                );
              }

              return (
                <Fragment key={o.id}>
                  {separator}
                  <tr
                    onClick={() => onOpenRow(o.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenRow(o.id);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    className={`group cursor-pointer border-b border-slate-100 transition-colors ${
                      o.reversePickup
                        ? "bg-violet-100 hover:bg-violet-200"
                        : "bg-white hover:bg-sky-50/90"
                    }`}
                  >
                    {showSelectColumn ? (
                      <td
                        className={`sticky right-0 z-10 w-14 min-w-[3.25rem] max-w-[3.5rem] align-top px-1 py-2.5 text-center shadow-[-4px_0_8px_-2px_rgba(15,23,42,0.1)] transition-colors ${
                          o.reversePickup ? "bg-violet-100 group-hover:bg-violet-200" : "bg-white group-hover:bg-sky-50/90"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectable ? (
                          <div className="flex flex-col items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleOne(o.id)}
                              className="h-5 w-5 rounded border-sky-400 text-sky-600 accent-sky-600"
                              title={selectedTitle}
                              aria-label={`${selectedAriaPrefix} ${o.shortId}`}
                            />
                            {showStatusDotInSelectCol ? (
                              <span
                                className={`inline-flex h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9 ${o.statusClass}`}
                                title={o.statusAr}
                                aria-label={o.statusAr}
                                role="img"
                              />
                            ) : null}
                            {renderSelectActions ? (
                              <div className="mt-0.5">{renderSelectActions(o)}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-block text-slate-300" aria-hidden>
                            —
                          </span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-2 py-2.5 align-top font-mono text-sm text-slate-600 tabular-nums sm:text-base">
                      <div className="flex flex-col items-start gap-1">
                        {o.prepaidAll ? (
                          <span
                            className="text-[11px] font-black leading-none text-red-700 sm:text-xs"
                            title="كل شي واصل — لا نقد من الزبون"
                          >
                            واصل
                          </span>
                        ) : null}
                        {o.reversePickup ? (
                          <span
                            className="text-[11px] font-black leading-none text-violet-800 sm:text-xs"
                            title="تنبيه طلب عكسي استلام من الزبون وتسليم للعميل"
                          >
                            عكسي
                          </span>
                        ) : null}
                        {o.hasCourierUploadedLocation ? (
                          <span
                            className="text-[11px] font-black leading-none text-violet-700 sm:text-xs"
                            title="لوكيشن مرفوع من المندوب"
                          >
                            GPS
                          </span>
                        ) : null}
                        <div className="flex flex-col items-center gap-1.5">
                          {!hideLocationAlert && !o.hasCustomerLocation ? (
                            <span
                              className="inline-block shrink-0 rounded bg-rose-600 px-1 py-0.5 text-[9px] font-black leading-none text-white"
                              title="بدون لوكيشن للزبون"
                              aria-label="بدون لوكيشن"
                            >
                              !
                            </span>
                          ) : null}
                          {o.hasMoneyDeletedBadge ? (
                            <span
                              className="inline-block shrink-0 rounded bg-slate-500 px-1 py-0.5 text-[8px] font-black leading-none text-white"
                              title="تعديل مالي (معاملة محذوفة)"
                              aria-label="معاملة محذوفة"
                            >
                              $
                            </span>
                          ) : null}
                          <div className="flex flex-col items-center gap-1.5">
                            {renderOrderIdBadge ? (
                              renderOrderIdBadge(o)
                            ) : !showSelectColumn || !showStatusDotInSelectCol ? (
                              <span
                                className={`inline-flex h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9 ${o.statusClass}`}
                                title={o.statusAr}
                                aria-label={o.statusAr}
                                role="img"
                              />
                            ) : null}
                            {!hideShortIdInBadgeCol && (
                              <span className="tabular-nums font-bold text-[11px] text-slate-400">#{o.shortId}</span>
                            )}
                          </div>
                        </div>
                        {renderBelowOrderId && (
                          <div className="mt-1">{renderBelowOrderId(o)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="max-w-[14rem] break-words sm:max-w-[18rem]">
                        {renderInShopNameCol && renderInShopNameCol(o)}
                        {o.assignedCourierName?.trim() && o.assignedCourierName !== "—" ? (
                          <div className="mb-1 text-[11px] font-black text-emerald-800 sm:text-xs">
                            {o.assignedCourierName}
                          </div>
                        ) : null}

                        <div className="flex items-center gap-2">
                          <div className="relative inline-block group">
                            <span className={`inline-block rounded-md px-1.5 py-0.5 font-bold ${o.shopNameHighlightClass}`}>
                              {o.shopName}
                            </span>

                            {/* مثلث البصمة الصوتية والملاحظات */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {o.audioUrl && <MiniAudioPlayer url={o.audioUrl} />}
                              {o.preparerAudioUrl && <MiniAudioPlayer url={o.preparerAudioUrl} />}
                              {o.adminAudioUrl && <MiniAudioPlayer url={o.adminAudioUrl} />}
                              {o.summary && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setShowNotes(showNotes === o.id ? null : o.id); }}
                                  className="flex size-7 items-center justify-center rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors border-2 border-white shadow-sm"
                                  title="ملاحظات الطلب"
                                >
                                  📝
                                </button>
                              )}
                            </div>

                            {showNotes === o.id && o.summary && (
                              <CenterModal title="ملاحظات الطلب" onClose={() => setShowNotes(null)}>
                                <div className="text-base font-bold text-slate-800 leading-relaxed whitespace-pre-wrap p-2">
                                  {o.summary}
                                </div>
                              </CenterModal>
                            )}
                          </div>

                        {/* أزرار العميل (المحل) المختصرة */}
                        {(o.shopLocationUrl?.trim() || o.shopDoorPhotoUrl?.trim()) && (
                          <div className="flex items-center gap-1 border-r pr-2 mr-1 border-slate-200" onClick={e => e.stopPropagation()}>
                             {o.shopLocationUrl?.trim() && <a href={o.shopLocationUrl.trim()} target="_blank" title="موقع المحل" className="size-6 flex items-center justify-center rounded-full bg-slate-100 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm">📍</a>}
                             {o.shopDoorPhotoUrl?.trim() && <button onClick={() => setModalImg({ url: o.shopDoorPhotoUrl!.trim(), title: "باب المحل" })} title="صورة باب المحل" className="size-6 flex items-center justify-center rounded-full bg-slate-100 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-sm">🚪</button>}
                          </div>
                        )}
                        </div>
                        {/* علامات الصادر والوارد المالية "من الخارج" */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {o.wardMismatchType === "deficit" && (
                            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm ring-1 ring-rose-400">
                              🔴 نقص بالوارد
                            </span>
                          )}
                          {o.wardMismatchType === "excess" && (
                            <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm ring-1 ring-emerald-400">
                              🟢 زيادة بالوارد
                            </span>
                          )}
                          {o.saderMismatchType === "deficit" && (
                            <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm ring-1 ring-orange-300">
                              📉 نقص بالصادر
                            </span>
                          )}
                          {o.saderMismatchType === "excess" && (
                            <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm ring-1 ring-sky-300">
                              📈 زيادة بالصادر
                            </span>
                          )}
                          {o.orderStatus === "delivered" && o.noWardRecorded && (
                            <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm ring-1 ring-slate-600 animate-pulse">
                              ⚠️ بدون وارد
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      className={`max-w-[12rem] px-2 py-2.5 text-sm sm:max-w-[16rem] sm:text-base align-top ${
                        o.reversePickup ? "font-bold text-violet-900" : "text-slate-700"
                      }`}
                    >
                      <div className="flex flex-col gap-1.5">
                        <span>{o.regionLine}</span>
                        {/* أزرار اللوكيشن والصور من الخارج (للزبون) */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                           {o.customerLocationUrl?.trim() && (
                             <a href={o.customerLocationUrl.trim()} target="_blank" title="موقع الزبون" className="size-8 flex items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-md hover:bg-rose-500 hover:text-white transition-all border-2 border-white">📍</a>
                           )}
                           {o.customerDoorPhotoUrl?.trim() && (
                             <button onClick={() => setModalImg({ url: o.customerDoorPhotoUrl!.trim(), title: "صورة الباب" })} title="صورة الباب" className="size-8 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-md hover:bg-amber-500 hover:text-white transition-all border-2 border-white">🚪</button>
                           )}

                           {/* لوكيشن المستلم في الوجهتين */}
                           {o.routeMode === "double" && o.secondCustomerLocationUrl?.trim() && (
                             <a href={o.secondCustomerLocationUrl.trim()} target="_blank" title="موقع المستلم" className="size-8 flex items-center justify-center rounded-full bg-violet-100 text-violet-600 shadow-md hover:bg-violet-600 hover:text-white transition-all border-2 border-violet-200">📍</a>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[10rem] px-2 py-2.5 text-sm text-slate-800 sm:text-base">
                      <OrderTypeLine orderType={o.orderType} />
                    </td>
                    <td className="px-2 py-2.5 font-mono tabular-nums text-slate-900">{o.priceStr}</td>
                    <td className="px-2 py-2.5 font-mono tabular-nums text-cyan-700">{o.delStr}</td>
                    <td className="px-2 py-2.5 align-top" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col gap-2">
                        <span className="font-mono text-sm tabular-nums text-slate-700 sm:text-base font-bold">
                          {o.customerPhone || "—"}
                        </span>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* زر الاتصال */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveCallId(activeCallId === o.id ? null : o.id);
                                  setActiveMsgId(null);
                                  setActiveLocId(null);
                                  setActiveDoorId(null);
                                }}
                                className={`size-10 flex items-center justify-center rounded-full text-white shadow-md hover:scale-110 transition-transform ${activeCallId === o.id ? 'bg-sky-700 ring-2 ring-sky-300' : 'bg-sky-600'}`}
                                title="خيارات الاتصال"
                              >
                                📞
                              </button>
                              {activeCallId === o.id && (
                                <CenterModal title="إجراء اتصال بـ:" onClose={() => setActiveCallId(null)}>
                                  <div className="flex flex-col gap-1">
                                    {o.shopPhone && (
                                      <a href={telHref(o.shopPhone)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-sky-50 transition-colors rounded-xl border border-slate-100">
                                        <span className="size-10 flex items-center justify-center rounded-full bg-sky-100 text-sky-600 text-xl">🏢</span> عميل (المحل)
                                      </a>
                                    )}
                                    {o.customerPhone && (
                                      <a href={telHref(o.customerPhone)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-sky-50 transition-colors rounded-xl border border-slate-100">
                                        <span className="size-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl">👤</span> زبون
                                      </a>
                                    )}
                                    {(o.alternatePhone || o.secondCustomerPhone) && (
                                      <a href={telHref(o.alternatePhone || o.secondCustomerPhone)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-sky-50 transition-colors rounded-xl border border-slate-100">
                                        <span className="size-10 flex items-center justify-center rounded-full bg-violet-100 text-violet-600 text-xl">👥</span> زبون 2
                                      </a>
                                    )}
                                  </div>
                                </CenterModal>
                              )}
                            </div>

                            {/* زر المراسلة */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMsgId(activeMsgId === o.id ? null : o.id);
                                  setActiveCallId(null);
                                  setActiveLocId(null);
                                  setActiveDoorId(null);
                                }}
                                className={`size-10 flex items-center justify-center rounded-full text-white shadow-md hover:scale-110 transition-transform ${activeMsgId === o.id ? 'bg-emerald-700 ring-2 ring-emerald-300' : 'bg-emerald-600'}`}
                                title="خيارات المراسلة"
                              >
                                💬
                              </button>
                              {activeMsgId === o.id && (
                                <CenterModal title="بدء مراسلة واتساب مع:" onClose={() => setActiveMsgId(null)}>
                                  <div className="flex flex-col gap-1">
                                    {o.shopPhone && (
                                      <a href={whatsappMeUrl(o.shopPhone)} target="_blank" className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-emerald-50 transition-colors rounded-xl border border-slate-100">
                                        <span className="size-10 flex items-center justify-center rounded-full bg-sky-100 text-sky-600 text-xl">🏢</span> عميل (المحل)
                                      </a>
                                    )}
                                    {o.customerPhone && (
                                      <a href={whatsappMeUrl(o.customerPhone)} target="_blank" className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-emerald-50 transition-colors rounded-xl border border-slate-100">
                                        <span className="size-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl">👤</span> زبون
                                      </a>
                                    )}
                                    {(o.alternatePhone || o.secondCustomerPhone) && (
                                      <a href={whatsappMeUrl(o.alternatePhone || o.secondCustomerPhone)} target="_blank" className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-emerald-50 transition-colors rounded-xl border border-slate-100">
                                        <span className="size-10 flex items-center justify-center rounded-full bg-violet-100 text-violet-600 text-xl">👥</span> زبون 2
                                      </a>
                                    )}
                                  </div>
                                </CenterModal>
                              )}
                            </div>

                            {/* زر اللوكيشن */}
                            {(o.shopLocationUrl || o.customerLocationUrl || o.secondCustomerLocationUrl) && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveLocId(activeLocId === o.id ? null : o.id);
                                    setActiveCallId(null);
                                    setActiveMsgId(null);
                                    setActiveDoorId(null);
                                  }}
                                  className={`size-10 flex items-center justify-center rounded-full text-white shadow-md hover:scale-110 transition-transform ${activeLocId === o.id ? 'bg-rose-700 ring-2 ring-rose-300' : 'bg-rose-600'}`}
                                  title="خيارات الموقع (GPS)"
                                >
                                  📍
                                </button>
                                {activeLocId === o.id && (
                                  <CenterModal title="فتح الموقع الجغرافي لـ:" onClose={() => setActiveLocId(null)}>
                                    <div className="flex flex-col gap-1">
                                      {o.shopLocationUrl && (
                                        <a href={o.shopLocationUrl} target="_blank" className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-rose-50 transition-colors rounded-xl border border-slate-100">
                                          <span className="size-10 flex items-center justify-center rounded-full bg-sky-100 text-sky-600 text-xl">🏢</span> عميل (المحل)
                                        </a>
                                      )}
                                      {o.customerLocationUrl && (
                                        <a href={o.customerLocationUrl} target="_blank" className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-rose-50 transition-colors rounded-xl border border-slate-100">
                                          <span className="size-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl">👤</span> زبون
                                        </a>
                                      )}
                                      {o.secondCustomerLocationUrl && (
                                        <a href={o.secondCustomerLocationUrl} target="_blank" className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-rose-50 transition-colors rounded-xl border border-slate-100">
                                          <span className="size-10 flex items-center justify-center rounded-full bg-violet-100 text-violet-600 text-xl">👥</span> زبون 2 / مستلم
                                        </a>
                                      )}
                                    </div>
                                  </CenterModal>
                                )}
                              </div>
                            )}

                            {/* زر صورة الباب */}
                            {(o.shopDoorPhotoUrl?.trim() || o.customerDoorPhotoUrl?.trim() || (o as any).secondCustomerDoorPhotoUrl?.trim()) && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDoorId(activeDoorId === o.id ? null : o.id);
                                    setActiveCallId(null);
                                    setActiveMsgId(null);
                                    setActiveLocId(null);
                                  }}
                                  className={`size-10 flex items-center justify-center rounded-full text-white shadow-md hover:scale-110 transition-transform ${activeDoorId === o.id ? 'bg-amber-700 ring-2 ring-amber-300' : 'bg-amber-600'}`}
                                  title="صور أبواب الزبائن"
                                >
                                  🚪
                                </button>
                                {activeDoorId === o.id && (
                                  <CenterModal title="عرض صورة الباب لـ:" onClose={() => setActiveDoorId(null)}>
                                    <div className="flex flex-col gap-1">
                                      {o.shopDoorPhotoUrl?.trim() && (
                                        <button
                                          onClick={() => { setModalImg({ url: o.shopDoorPhotoUrl!.trim(), title: "هذه صورة باب العميل (المحل)" }); setActiveDoorId(null); }}
                                          className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-amber-50 transition-colors rounded-xl border border-slate-100 text-right w-full"
                                        >
                                          <span className="size-10 flex items-center justify-center rounded-full bg-sky-100 text-sky-600 text-xl">🏢</span> عميل (المحل)
                                        </button>
                                      )}
                                      {o.customerDoorPhotoUrl?.trim() && (
                                        <button
                                          onClick={() => { setModalImg({ url: o.customerDoorPhotoUrl!.trim(), title: "هذه صورة باب الزبون" }); setActiveDoorId(null); }}
                                          className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-amber-50 transition-colors rounded-xl border border-slate-100 text-right w-full"
                                        >
                                          <span className="size-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl">👤</span> زبون
                                        </button>
                                      )}
                                      {(o as any).secondCustomerDoorPhotoUrl?.trim() && (
                                        <button
                                          onClick={() => { setModalImg({ url: (o as any).secondCustomerDoorPhotoUrl!.trim(), title: "هذه صورة باب الزبون 2 / المستلم" }); setActiveDoorId(null); }}
                                          className="flex items-center gap-3 px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-amber-50 transition-colors rounded-xl border border-slate-100 text-right w-full"
                                        >
                                          <span className="size-10 flex items-center justify-center rounded-full bg-violet-100 text-violet-600 text-xl">👥</span> زبون 2 / مستلم
                                        </button>
                                      )}
                                    </div>
                                  </CenterModal>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-sm text-slate-600 sm:text-base">{o.timeLine}</td>
                    <td className="px-2 py-2.5 text-xs text-slate-500 sm:text-sm">
                      {orderDate ? orderDate.toLocaleString("ar-IQ-u-nu-latn", {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                        timeZone: "Asia/Baghdad"
                      }) : "—"}
                    </td>
                  </tr>
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      {modalImg && (
        <ImageModal
          url={modalImg.url}
          title={modalImg.title}
          onClose={() => setModalImg(null)}
        />
      )}
    </div>
  );
}
