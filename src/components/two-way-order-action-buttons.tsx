"use client";

import { useState, useRef, useEffect } from "react";
import {
  whatsappMeUrl,
  telHref,
  openUrlFromUserGesture,
  digitsOnly,
} from "@/lib/whatsapp";
import {
  renderTwoWayTemplate,
  shouldShowButtonRule,
  type TwoWayButtonRule,
  type TwoWayTemplatesConfig,
  getDefaultTwoWayButtonRules,
} from "@/lib/two-way-whatsapp-helpers";

export type TwoWayOrderActionButtonsProps = {
  orderId: string;
  orderNumber: string | number;
  orderStatus: string;
  routeMode: string;
  // بيانات المرسل
  senderName?: string;
  senderPhone?: string | null;
  senderAlternatePhone?: string | null;
  senderRegionName?: string | null;
  senderHasLocation?: boolean;
  senderGpsUploaded?: boolean;
  // بيانات المستلم
  recipientName?: string;
  recipientPhone?: string | null;
  recipientAlternatePhone?: string | null;
  recipientRegionName?: string | null;
  recipientHasLocation?: boolean;
  recipientGpsUploaded?: boolean;
  // المبالغ والملاحظات
  subtotal?: string | number | null;
  delivery?: string | number | null;
  total?: string | number | null;
  notes?: string | null;
  // القواعد الجاهزة
  buttonRules?: TwoWayButtonRule[];
  templates?: Partial<TwoWayTemplatesConfig>;
};

const FAB_POS_STORAGE_KEY = "mandoub_two_way_fab_position";
const FAB_SIZE = 56;

export function TwoWayOrderActionButtons({
  orderId,
  orderNumber,
  orderStatus,
  routeMode,
  senderName = "المرسل",
  senderPhone,
  senderAlternatePhone,
  senderRegionName,
  senderHasLocation = false,
  senderGpsUploaded = false,
  recipientName = "المستلم",
  recipientPhone,
  recipientAlternatePhone,
  recipientRegionName,
  recipientHasLocation = false,
  recipientGpsUploaded = false,
  subtotal = "0",
  delivery = "0",
  total = "0",
  notes = "",
  buttonRules,
}: TwoWayOrderActionButtonsProps) {
  const rules = buttonRules && buttonRules.length > 0 ? buttonRules : getDefaultTwoWayButtonRules();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -1, top: -1 });
  const [isDragging, setIsDragging] = useState(false);

  // حالة النافذة المنبثقة للرسالة والتعديل قبل الإرسال
  const [modalOpen, setModalOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  const dragRef = useRef({ startX: 0, startY: 0, origLeft: 0, origTop: 0, moved: false });

  // تحميل واسترجاع الموقع المحفوظ تلقائياً
  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== "undefined" ? localStorage.getItem(FAB_POS_STORAGE_KEY) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPos(parsed);
        return;
      } catch (e) { /* fallback below */ }
    }
    // الموقع الافتراضي في أسفل يمين الشاشة
    setPos({
      left: Math.max(16, (typeof window !== "undefined" ? window.innerWidth : 360) - FAB_SIZE - 20),
      top: Math.max(16, (typeof window !== "undefined" ? window.innerHeight : 640) - 180),
    });
  }, []);

  if (!mounted || pos.left === -1) return null;

  // التعامل مع السحب والتحريك (Drag & Drop)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isOpen) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: pos.left,
      origTop: pos.top,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    const nextLeft = Math.max(10, Math.min(window.innerWidth - FAB_SIZE - 10, dragRef.current.origLeft + dx));
    const nextTop = Math.max(10, Math.min(window.innerHeight - FAB_SIZE - 10, dragRef.current.origTop + dy));
    setPos({ left: nextLeft, top: nextTop });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }

    if (dragRef.current.moved) {
      // حفظ الموقع تلقائياً في localStorage
      localStorage.setItem(FAB_POS_STORAGE_KEY, JSON.stringify(pos));
    } else {
      // إذا لم يتطرق للسحب يعتبر كبسة زر لفتح القائمة المجمعة
      setIsOpen((prev) => !prev);
    }
  };

  // فلترة وتحديد الأزرار المتاحة بحسب الشروط
  const resolveTargetPhone = (targetParty: string): string => {
    switch (targetParty) {
      case "sender_1": return senderPhone || "";
      case "sender_2": return senderAlternatePhone || senderPhone || "";
      case "recipient_1": return recipientPhone || "";
      case "recipient_2": return recipientAlternatePhone || recipientPhone || "";
      case "any": return recipientPhone || senderPhone || "";
      default: return recipientPhone || senderPhone || "";
    }
  };

  const resolvePartyLocationStatus = (targetParty: string) => {
    if (targetParty.startsWith("sender")) {
      return { hasLocation: !!senderHasLocation, gpsUploaded: !!senderGpsUploaded };
    }
    return { hasLocation: !!recipientHasLocation, gpsUploaded: !!recipientGpsUploaded };
  };

  // مصفوفة الأزرار المتاحة التي ينطبق عليها شرط حالة الطلب وحالة اللوكيشن
  const availableButtons = rules.filter((rule) => {
    const partyLoc = resolvePartyLocationStatus(rule.targetParty);
    const show = shouldShowButtonRule(rule, orderStatus, partyLoc);
    const phone = resolveTargetPhone(rule.targetParty);
    return show && !!digitsOnly(phone);
  });

  const prepareAndOpenModal = (rule: TwoWayButtonRule) => {
    const rawPhone = resolveTargetPhone(rule.targetParty);
    const cleanPhone = digitsOnly(rawPhone);
    if (!cleanPhone) return;

    if (rule.actionType === "call") {
      openUrlFromUserGesture(telHref(cleanPhone));
      setIsOpen(false);
      return;
    }

    const rendered = renderTwoWayTemplate({
      template: rule.template,
      orderNumber,
      senderName,
      senderPhone: senderPhone || "",
      recipientName,
      recipientPhone: recipientPhone || "",
      senderRegion: senderRegionName || "",
      recipientRegion: recipientRegionName || "",
      subtotal: subtotal || "0",
      delivery: delivery || "0",
      total: total || "0",
      notes: notes || "",
    });

    setTargetPhone(cleanPhone);
    setTargetLabel(rule.title);
    setDraftMessage(rendered);
    setModalOpen(true);
    setIsOpen(false);
  };

  const executeSend = () => {
    if (!targetPhone || !draftMessage) return;
    const url = whatsappMeUrl(targetPhone, draftMessage);
    openUrlFromUserGesture(url);
    setModalOpen(false);
  };

  return (
    <>
      {/* الزر العائم المجمّع القابل للسحب والتحريك وحفظ الموضع */}
      <div
        style={{
          position: "fixed",
          left: `${pos.left}px`,
          top: `${pos.top}px`,
          zIndex: 9999,
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="group select-none"
      >
        <button
          type="button"
          aria-label="أزرار الوجهتين التواصل"
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition duration-150 active:scale-90 ${
            isOpen
              ? "bg-rose-600 text-white ring-4 ring-rose-200"
              : "bg-indigo-600 text-white ring-4 ring-indigo-200 hover:bg-indigo-700"
          }`}
        >
          {isOpen ? (
            <span className="text-xl font-black">✕</span>
          ) : (
            <div className="flex flex-col items-center justify-center leading-none">
              <span className="text-lg">⇄</span>
              <span className="text-[9px] font-black mt-0.5">أزرار</span>
            </div>
          )}
        </button>

        {/* مؤشر تحريك وسحب الزر */}
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] font-black text-white opacity-0 group-hover:opacity-100 transition">
          اسحب للتحريك
        </div>
      </div>

      {/* قائمة الأزرار المصفاة المجمعة عند النقر على الزر العائم */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(window.innerWidth - 290, Math.max(10, pos.left - 100))}px`,
            top: `${Math.max(10, pos.top - 320)}px`,
            zIndex: 9998,
          }}
          className="w-72 rounded-3xl border border-indigo-200 bg-white/95 backdrop-blur-md p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-2 text-slate-800"
        >
          <div className="flex items-center justify-between border-b border-indigo-100 pb-2 px-1">
            <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              <span>⇄</span> أزرار التواصل المجمعة
            </span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              طلب #{orderNumber}
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {availableButtons.length > 0 ? (
              availableButtons.map((btn) => {
                const isWhatsapp = btn.actionType === "whatsapp";
                const isLoc = btn.actionType === "location_request";
                const isNotify = btn.actionType === "notify";
                const isCall = btn.actionType === "call";

                let btnBg = "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100";
                let icon = "💬";
                if (isLoc) { btnBg = "bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100"; icon = "📍"; }
                else if (isNotify) { btnBg = "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100"; icon = "🔔"; }
                else if (isCall) { btnBg = "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100"; icon = "📞"; }

                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => prepareAndOpenModal(btn)}
                    className={`w-full flex items-center justify-between rounded-2xl border p-2.5 text-right transition active:scale-95 shadow-2xs ${btnBg}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{icon}</span>
                      <span className="text-xs font-extrabold truncate">{btn.title}</span>
                    </div>
                    <span className="text-[10px] font-bold opacity-75">إرسال ↗</span>
                  </button>
                );
              })
            ) : (
              <p className="text-center text-xs font-bold text-slate-500 py-4">
                لا توجد أزرار مضافة تنطبق على حالة الطلب أو اللوكيشن الحالية.
              </p>
            )}
          </div>
        </div>
      )}

      {/* النافذة المنبثقة الكبيرة للتعديل والإرسال قبل التوجيه للواتساب */}
      {modalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border border-indigo-100 bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-indigo-950">
                  إرسال عبر الواتساب: {targetLabel}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  الرقم المستهدف: <span className="dir-ltr inline-block font-mono font-bold text-slate-900">{targetPhone}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700">
                محتوى الرسالة (يمكنك التعديل عليه قبل الإرسال):
              </label>
              <textarea
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                rows={7}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100 leading-relaxed shadow-inner"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeSend}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700"
              >
                🚀 فتح الواتساب والإرسال
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
