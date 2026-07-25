"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  whatsappMeUrl,
  telHref,
  openUrlFromUserGesture,
  digitsOnly,
} from "@/lib/whatsapp";
import {
  renderTwoWayTemplate,
  getDefaultTwoWayLocationSenderTemplate,
  getDefaultTwoWayLocationRecipientTemplate,
  getDefaultTwoWayNotifySenderTemplate,
  getDefaultTwoWayNotifyRecipientTemplate,
  getDefaultTwoWayChatSenderTemplate,
  getDefaultTwoWayChatRecipientTemplate,
  type TwoWayTemplatesConfig,
} from "@/lib/two-way-whatsapp-helpers";

export type TwoWayOrderActionButtonsProps = {
  orderId: string;
  orderNumber: string | number;
  orderStatus?: string;
  routeMode?: string;
  // بيانات المرسل
  senderName?: string;
  senderPhone?: string | null;
  senderAlternatePhone?: string | null;
  senderRegionName?: string | null;
  // بيانات المستلم
  recipientName?: string;
  recipientPhone?: string | null;
  recipientAlternatePhone?: string | null;
  recipientRegionName?: string | null;
  // المبالغ والملاحظات
  subtotal?: string | number | null;
  delivery?: string | number | null;
  total?: string | number | null;
  notes?: string | null;
  // القوالب والقواعد الديناميكية من صفحة الإعدادات
  twoWayTemplates?: Partial<TwoWayTemplatesConfig> | null;
};

const FAB_POS_STORAGE_KEY = "mandoub_two_way_fab_position";
const FAB_SCALE_STORAGE_KEY = "mandoub_two_way_fab_scale";
const FAB_OPACITY_STORAGE_KEY = "mandoub_two_way_fab_opacity";

const FAB_SIZE = 56;
const LONG_PRESS_DURATION = 750;

export function TwoWayOrderActionButtons({
  orderNumber,
  senderName = "المرسل",
  senderPhone,
  senderAlternatePhone,
  senderRegionName,
  recipientName = "المستلم",
  recipientPhone,
  recipientAlternatePhone,
  recipientRegionName,
  subtotal = "0",
  delivery = "0",
  total = "0",
  notes = "",
  twoWayTemplates,
}: TwoWayOrderActionButtonsProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -1, top: -1 });
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // الزر الرئيسي المحدد حالياً (مراسلة، اتصال، طلب لوكيشن، تبليغ)
  const [activeAction, setActiveAction] = useState<"chat" | "call" | "location" | "notify" | null>(null);

  const dragRef = useRef({ startX: 0, startY: 0, origLeft: 0, origTop: 0, moved: false });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // القوالب المحملة ديناميكياً
  const [dynTemplates, setDynTemplates] = useState<Partial<TwoWayTemplatesConfig> | null>(twoWayTemplates || null);

  useEffect(() => {
    setMounted(true);
    if (!twoWayTemplates) {
      fetch("/api/mandoub-wa-buttons", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    // استرجاع الإعدادات المحفوظة
    try {
      const savedPos = localStorage.getItem(FAB_POS_STORAGE_KEY);
      if (savedPos) setPos(JSON.parse(savedPos));
      else {
        setPos({
          left: Math.max(16, (window.innerWidth || 360) - FAB_SIZE - 20),
          top: Math.max(16, (window.innerHeight || 640) - 180),
        });
      }

      const savedScale = localStorage.getItem(FAB_SCALE_STORAGE_KEY);
      if (savedScale) setScale(Number(savedScale));

      const savedOpacity = localStorage.getItem(FAB_OPACITY_STORAGE_KEY);
      if (savedOpacity) setOpacity(Number(savedOpacity));
    } catch {
      setPos({
        left: Math.max(16, (window.innerWidth || 360) - FAB_SIZE - 20),
        top: Math.max(16, (window.innerHeight || 640) - 180),
      });
    }
  }, [twoWayTemplates]);

  if (!mounted || pos.left === -1) return null;

  // التحكم بالسحب والتحريك والنقر المطول
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isOpen || isConfiguring) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: pos.left,
      origTop: pos.top,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);

    // بدء مؤقت الضغط المطول
    longPressTimer.current = setTimeout(() => {
      setIsDragging(false);
      setIsConfiguring(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      dragRef.current.moved = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    const nextLeft = Math.max(10, Math.min(window.innerWidth - FAB_SIZE - 10, dragRef.current.origLeft + dx));
    const nextTop = Math.max(10, Math.min(window.innerHeight - FAB_SIZE - 10, dragRef.current.origTop + dy));
    setPos({ left: nextLeft, top: nextTop });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }

    if (dragRef.current.moved) {
      localStorage.setItem(FAB_POS_STORAGE_KEY, JSON.stringify(pos));
    } else {
      if (!isConfiguring) {
        setIsOpen((prev) => !prev);
        setActiveAction(null);
      }
    }
  };

  const closeAll = () => {
    setIsOpen(false);
    setActiveAction(null);
    setIsConfiguring(false);
  };

  const resetAllSettings = () => {
    setScale(1);
    setOpacity(1);
    localStorage.removeItem(FAB_SCALE_STORAGE_KEY);
    localStorage.removeItem(FAB_OPACITY_STORAGE_KEY);
    setIsConfiguring(false);
  };

  const saveSettings = () => {
    localStorage.setItem(FAB_SCALE_STORAGE_KEY, String(scale));
    localStorage.setItem(FAB_OPACITY_STORAGE_KEY, String(opacity));
    setIsConfiguring(false);
  };

  // توليد وصياغة النص المبرمج من صفحة الإعدادات
  const getRenderedMessage = (type: "chat" | "location" | "notify", isSender: boolean): string => {
    const activeTpl = twoWayTemplates || dynTemplates;
    let tpl = "";
    if (type === "chat") {
      tpl = isSender
        ? activeTpl?.chatSenderTemplate || getDefaultTwoWayChatSenderTemplate()
        : activeTpl?.chatRecipientTemplate || getDefaultTwoWayChatRecipientTemplate();
    } else if (type === "location") {
      tpl = isSender
        ? activeTpl?.locationSenderTemplate || getDefaultTwoWayLocationSenderTemplate()
        : activeTpl?.locationRecipientTemplate || getDefaultTwoWayLocationRecipientTemplate();
    } else if (type === "notify") {
      tpl = isSender
        ? activeTpl?.notifySenderTemplate || getDefaultTwoWayNotifySenderTemplate()
        : activeTpl?.notifyRecipientTemplate || getDefaultTwoWayNotifyRecipientTemplate();
    }

    return renderTwoWayTemplate({
      template: tpl,
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
  };

  // التنفيذ الفوري عند النقر على الشخص المحدد
  const handleExecuteTarget = (targetPhoneRaw: string | null | undefined, isSender: boolean) => {
    const cleanPhone = digitsOnly(targetPhoneRaw || "");
    if (!cleanPhone || !activeAction) return;

    if (activeAction === "call") {
      openUrlFromUserGesture(telHref(cleanPhone));
      closeAll();
      return;
    }

    const message = getRenderedMessage(activeAction, isSender);
    const url = whatsappMeUrl(cleanPhone, message);
    openUrlFromUserGesture(url);
    closeAll();
  };

  // الهواتف المتاحة لكل جهة
  const sPhone1 = digitsOnly(senderPhone || "");
  const sPhone2 = digitsOnly(senderAlternatePhone || "");
  const rPhone1 = digitsOnly(recipientPhone || "");
  const rPhone2 = digitsOnly(recipientAlternatePhone || "");

  const contactsList: Array<{
    id: string;
    phone: string;
    label: string;
    isSender: boolean;
  }> = [];

  if (sPhone1) {
    contactsList.push({
      id: "s1",
      phone: sPhone1,
      label: sPhone2 ? "المرسل (رقم 1)" : "المرسل",
      isSender: true,
    });
  }
  if (sPhone2 && sPhone2 !== sPhone1) {
    contactsList.push({
      id: "s2",
      phone: sPhone2,
      label: "المرسل (رقم 2)",
      isSender: true,
    });
  }
  if (rPhone1) {
    contactsList.push({
      id: "r1",
      phone: rPhone1,
      label: rPhone2 ? "المستلم (رقم 1)" : "المستلم",
      isSender: false,
    });
  }
  if (rPhone2 && rPhone2 !== rPhone1) {
    contactsList.push({
      id: "r2",
      phone: rPhone2,
      label: "المستلم (رقم 2)",
      isSender: false,
    });
  }

  const actionTitles = {
    chat: "مراسلة واتساب",
    call: "اتصال هاتفي",
    location: "طلب لوكيشن",
    notify: "تبليغ زبون",
  };

  const fabContent = (
    <>
      {/* الزر العائم المصمم بنفس الديزاين القديم بالكامل */}
      <div
        style={{
          position: "fixed",
          left: `${pos.left}px`,
          top: `${pos.top}px`,
          zIndex: 9999,
          touchAction: "none",
        }}
        className="group select-none"
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`flex h-[56px] w-[56px] cursor-grab items-center justify-center rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.4)] ring-4 ring-white transition-all duration-300 active:cursor-grabbing ${
            isOpen ? "bg-rose-500" : "bg-indigo-600"
          }`}
          style={{
            transform: `scale(${scale})`,
            opacity: opacity,
            transition: isDragging ? "none" : "transform 0.2s, background-color 0.3s, opacity 0.3s",
          }}
        >
          {isOpen ? (
            <svg
              className="h-8 w-8 text-white animate-in spin-in-90 duration-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="flex flex-col items-center justify-center leading-none text-white">
              <span className="text-xl font-bold">⇄</span>
              <span className="text-[9px] font-extrabold mt-0.5">أزرار</span>
            </div>
          )}
        </div>

        {/* تلميح السحب والتحريك */}
        {!isOpen && !isConfiguring && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] font-black text-white opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
            اسحب للتحريك | اضغط مطولاً للإعدادات
          </div>
        )}
      </div>

      {/* خلفية التعتيم والإغلاق عند فتح المنيو أو الإعدادات */}
      {(isOpen || isConfiguring) && (
        <div className="fixed inset-0 z-[9997] bg-black/25 backdrop-blur-[1px]" onClick={closeAll} />
      )}

      {/* --- نافذة إعدادات الزر (حجم الزر والشفافية) بالنقر المطول --- */}
      {isConfiguring && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(window.innerWidth - 270, Math.max(10, pos.left - 90))}px`,
            top: `${Math.max(10, pos.top - 240)}px`,
            zIndex: 9998,
          }}
          className="w-64 rounded-3xl border border-indigo-100 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-4 text-slate-800"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-black text-indigo-950">⚙️ إعدادات الزر العائم</span>
            <button
              onClick={() => setIsConfiguring(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>حجم الزر:</span>
              <span className="text-indigo-600">{Math.round(scale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.6"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>شفافية الزر:</span>
              <span className="text-indigo-600">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={resetAllSettings}
              className="w-full py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-extrabold hover:bg-rose-100 transition border border-rose-200"
            >
              إعادة ضبط المصنع
            </button>
            <button
              type="button"
              onClick={saveSettings}
              className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-extrabold shadow-md hover:bg-indigo-700 transition"
            >
              حفظ وإغلاق
            </button>
          </div>
        </div>
      )}

      {/* --- القائمة المنبثقة المختصرة للأزرار الأربعة مع إبعاد زر الإغلاق الأحمر --- */}
      {isOpen && !isConfiguring && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(window.innerWidth - 280, Math.max(10, pos.left - 100))}px`,
            top: `${Math.max(10, pos.top - 280)}px`,
            zIndex: 9998,
          }}
          className="w-68 rounded-3xl border border-indigo-100 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-3 text-slate-800"
        >
          {/* هيدر القائمة مع رقم الطلب */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
            <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              <span>⇄</span> أزرار الوجهتين السريعة
            </span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
              طلب #{orderNumber}
            </span>
          </div>

          {!activeAction ? (
            // العرض الأول: الأزرار الأربعة الأساسية
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setActiveAction("chat")}
                className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-right text-emerald-950 font-black text-xs hover:bg-emerald-100 transition active:scale-95 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">💬</span>
                  <span>مراسلة (واتساب)</span>
                </div>
                <span className="text-[10px] opacity-60">←</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction("call")}
                className="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50/80 p-3 text-right text-sky-950 font-black text-xs hover:bg-sky-100 transition active:scale-95 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">📞</span>
                  <span>اتصال هاتفي</span>
                </div>
                <span className="text-[10px] opacity-60">←</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction("location")}
                className="flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50/80 p-3 text-right text-teal-950 font-black text-xs hover:bg-teal-100 transition active:scale-95 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">📍</span>
                  <span>طلب لوكيشن</span>
                </div>
                <span className="text-[10px] opacity-60">←</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction("notify")}
                className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3 text-right text-indigo-950 font-black text-xs hover:bg-indigo-100 transition active:scale-95 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🔔</span>
                  <span>تبليغ زبون</span>
                </div>
                <span className="text-[10px] opacity-60">←</span>
              </button>

              {/* زر الإغلاق الأحمر - إبعاده مسافة محترمة لتفادي المزعج والضغط الخاطئ */}
              <div className="pt-2 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={closeAll}
                  className="w-full py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-xs hover:bg-rose-100 active:scale-95 transition"
                >
                  ✕ إغلاق القائمة
                </button>
              </div>
            </div>
          ) : (
            // العرض الثاني: اختيار الشخص الفوري مباشرة دون خطوات معقدة
            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl">
                <span className="text-[11px] font-black text-slate-800">
                  حدد الشخص لـ: <span className="text-indigo-600">{actionTitles[activeAction]}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200"
                >
                  رجوع ↩
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {contactsList.length > 0 ? (
                  contactsList.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleExecuteTarget(contact.phone, contact.isSender)}
                      className={`w-full py-3 px-4 rounded-xl font-black text-xs text-center shadow-md active:scale-95 transition-all ${
                        contact.isSender
                          ? "bg-white text-slate-900 border-2 border-indigo-600 hover:bg-indigo-50"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                      }`}
                    >
                      {contact.label}
                    </button>
                  ))
                ) : (
                  <p className="text-center text-xs font-bold text-slate-400 py-3">
                    لا توجد أرقام هواتف مسجلة على هذا الطلب.
                  </p>
                )}
              </div>

              {/* زر الإغلاق الأحمر - مسافة واضحة أسفل الخيارات */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeAll}
                  className="w-full py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-xs hover:bg-rose-100 active:scale-95 transition"
                >
                  ✕ إغلاق القائمة
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  return createPortal(fabContent, document.body);
}
