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
  // القوالب والقواعد الديناميكية من صفحة الإعدادات
  twoWayTemplates?: Partial<TwoWayTemplatesConfig> | null;
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
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -1, top: -1 });
  const [isDragging, setIsDragging] = useState(false);

  // الزر الرئيسي المحدد حالياً (مراسلة، اتصال، طلب لكيشن، تبليغ)
  const [activeAction, setActiveAction] = useState<"chat" | "call" | "location" | "notify" | null>(null);

  const dragRef = useRef({ startX: 0, startY: 0, origLeft: 0, origTop: 0, moved: false });

  // القوالب المحملة ديناميكياً
  const [dynTemplates, setDynTemplates] = useState<Partial<TwoWayTemplatesConfig> | null>(twoWayTemplates || null);

  useEffect(() => {
    setMounted(true);
    if (!twoWayTemplates) {
      fetch("/api/mandoub-wa-buttons", { cache: "no-store" })
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null);
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem(FAB_POS_STORAGE_KEY) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPos(parsed);
        return;
      } catch (e) { /* fallback below */ }
    }
    setPos({
      left: Math.max(16, (typeof window !== "undefined" ? window.innerWidth : 360) - FAB_SIZE - 20),
      top: Math.max(16, (typeof window !== "undefined" ? window.innerHeight : 640) - 180),
    });
  }, [twoWayTemplates]);

  if (!mounted || pos.left === -1) return null;

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
      localStorage.setItem(FAB_POS_STORAGE_KEY, JSON.stringify(pos));
    } else {
      setIsOpen((prev) => !prev);
      setActiveAction(null);
    }
  };

  const closeAll = () => {
    setIsOpen(false);
    setActiveAction(null);
  };

  // توليد وصياغة النص المبرمج من صفحة الإعدادات لكل نوع وجبهة
  const getRenderedMessage = (type: "chat" | "location" | "notify", isSender: boolean): string => {
    const activeTpl = twoWayTemplates || dynTemplates;
    let tpl = "";
    if (type === "chat") {
      tpl = isSender
        ? (activeTpl?.chatSenderTemplate || getDefaultTwoWayChatSenderTemplate())
        : (activeTpl?.chatRecipientTemplate || getDefaultTwoWayChatRecipientTemplate());
    } else if (type === "location") {
      tpl = isSender
        ? (activeTpl?.locationSenderTemplate || getDefaultTwoWayLocationSenderTemplate())
        : (activeTpl?.locationRecipientTemplate || getDefaultTwoWayLocationRecipientTemplate());
    } else if (type === "notify") {
      tpl = isSender
        ? (activeTpl?.notifySenderTemplate || getDefaultTwoWayNotifySenderTemplate())
        : (activeTpl?.notifyRecipientTemplate || getDefaultTwoWayNotifyRecipientTemplate());
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
    location: "طلب لكيشن",
    notify: "تبليغ زبون",
  };

  return (
    <>
      {/* الزر العائم السريع */}
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
          aria-label="أزرار التواصل للوجهتين"
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

        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] font-black text-white opacity-0 group-hover:opacity-100 transition">
          اسحب للتحريك
        </div>
      </div>

      {/* خلفية الإغلاق السريع */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9997] bg-black/20"
          onClick={closeAll}
        />
      )}

      {/* القائمة المنبثقة المختصرة بالأزرار الأربعة */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(window.innerWidth - 270, Math.max(10, pos.left - 90))}px`,
            top: `${Math.max(10, pos.top - 260)}px`,
            zIndex: 9998,
          }}
          className="w-64 rounded-3xl border border-indigo-200 bg-white/95 backdrop-blur-md p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 space-y-3 text-slate-800"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
            <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              <span>⇄</span> أزرار الوجهتين السريعة
            </span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              #{orderNumber}
            </span>
          </div>

          {!activeAction ? (
            // العرض الأول: الأزرار الأربعة الأساسية فقط
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setActiveAction("chat")}
                className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-right text-emerald-950 font-black text-xs hover:bg-emerald-100 transition active:scale-95 shadow-xs"
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
                className="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50/80 p-3 text-right text-sky-950 font-black text-xs hover:bg-sky-100 transition active:scale-95 shadow-xs"
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
                className="flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50/80 p-3 text-right text-teal-950 font-black text-xs hover:bg-teal-100 transition active:scale-95 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">📍</span>
                  <span>طلب لكيشن</span>
                </div>
                <span className="text-[10px] opacity-60">←</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAction("notify")}
                className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3 text-right text-indigo-950 font-black text-xs hover:bg-indigo-100 transition active:scale-95 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🔔</span>
                  <span>تبليغ زبون</span>
                </div>
                <span className="text-[10px] opacity-60">←</span>
              </button>
            </div>
          ) : (
            // العرض الثاني: اختيار الشخص الفوري للفتح مباشرة دون نموذج وسيط
            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-100">
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

              <div className="flex flex-col gap-2 pt-1">
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
            </div>
          )}
        </div>
      )}
    </>
  );
}
