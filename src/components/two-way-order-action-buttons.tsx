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
  shouldShowButtonRule,
  getDefaultTwoWayLocationSenderTemplate,
  getDefaultTwoWayLocationRecipientTemplate,
  getDefaultTwoWayNotifySenderTemplate,
  getDefaultTwoWayNotifyRecipientTemplate,
  getDefaultTwoWayChatSenderTemplate,
  getDefaultTwoWayChatRecipientTemplate,
  getDefaultTwoWayButtonRules,
  type TwoWayTemplatesConfig,
  type TwoWayButtonRule,
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
  buttonRules?: TwoWayButtonRule[];
  twoWayTemplates?: Partial<TwoWayTemplatesConfig> | null;
};

const FAB_POS_STORAGE_KEY = "mandoub_two_way_fab_position";
const FAB_SCALE_STORAGE_KEY = "mandoub_two_way_fab_scale";
const FAB_OPACITY_STORAGE_KEY = "mandoub_two_way_fab_opacity";

const FAB_SIZE = 56;
const LONG_PRESS_DURATION = 750;

export function TwoWayOrderActionButtons({
  orderNumber,
  orderStatus = "pending",
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
  const openTimeRef = useRef<number>(0);

  // القوالب والقواعد المحملة
  const [dynConfig, setDynConfig] = useState<Partial<TwoWayTemplatesConfig> | null>(
    twoWayTemplates || (buttonRules ? { buttonRules } : null)
  );

  useEffect(() => {
    setMounted(true);
    if (!twoWayTemplates && !buttonRules) {
      fetch("/api/mandoub-wa-buttons", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }

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
  }, [twoWayTemplates, buttonRules]);

  if (!mounted || pos.left === -1) return null;

  // قواعد الأزرار المطبقة فعلياً
  const currentRules =
    dynConfig?.buttonRules && dynConfig.buttonRules.length > 0
      ? dynConfig.buttonRules
      : buttonRules && buttonRules.length > 0
      ? buttonRules
      : getDefaultTwoWayButtonRules();

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
    setIsDragging(true);

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

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      dragRef.current.moved = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      const nextLeft = Math.max(10, Math.min(window.innerWidth - FAB_SIZE - 10, dragRef.current.origLeft + dx));
      const nextTop = Math.max(10, Math.min(window.innerHeight - FAB_SIZE - 10, dragRef.current.origTop + dy));
      setPos({ left: nextLeft, top: nextTop });
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const moved = dragRef.current.moved;
    setIsDragging(false);

    if (moved) {
      localStorage.setItem(FAB_POS_STORAGE_KEY, JSON.stringify(pos));
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!dragRef.current.moved && !isConfiguring) {
      openTimeRef.current = Date.now();
      setIsOpen((prev) => !prev);
      setActiveAction(null);
    }
  };

  const closeAll = (force = false) => {
    if (!force && Date.now() - openTimeRef.current < 400) {
      return;
    }
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

  // -------------------------------------------------------------
  // الفلترة والتصفية الذكية بناءً على شروط الإعدادات (Order Status + Customer Location)
  // -------------------------------------------------------------
  const sPhone1 = digitsOnly(senderPhone || "");
  const sPhone2 = digitsOnly(senderAlternatePhone || "");
  const rPhone1 = digitsOnly(recipientPhone || "");
  const rPhone2 = digitsOnly(recipientAlternatePhone || "");

  const allPossibleParties = [
    {
      partyKey: "sender_1" as const,
      phone: sPhone1,
      label: sPhone2 ? "المرسل (رقم 1)" : "المرسل",
      isSender: true,
      locStatus: { hasLocation: senderHasLocation, gpsUploaded: senderGpsUploaded },
    },
    {
      partyKey: "sender_2" as const,
      phone: sPhone2 !== sPhone1 ? sPhone2 : "",
      label: "المرسل (رقم 2)",
      isSender: true,
      locStatus: { hasLocation: senderHasLocation, gpsUploaded: senderGpsUploaded },
    },
    {
      partyKey: "recipient_1" as const,
      phone: rPhone1,
      label: rPhone2 ? "المستلم (رقم 1)" : "المستلم",
      isSender: false,
      locStatus: { hasLocation: recipientHasLocation, gpsUploaded: recipientGpsUploaded },
    },
    {
      partyKey: "recipient_2" as const,
      phone: rPhone2 !== rPhone1 ? rPhone2 : "",
      label: "المستلم (رقم 2)",
      isSender: false,
      locStatus: { hasLocation: recipientHasLocation, gpsUploaded: recipientGpsUploaded },
    },
  ].filter((p) => !!p.phone);

  // دالة فحص استحقاق الطرف لزر/إجراء معين
  const isPartyAllowedForAction = (
    partyKey: "sender_1" | "sender_2" | "recipient_1" | "recipient_2",
    actionType: "whatsapp" | "call" | "location_request" | "notify",
    locStatus: { hasLocation: boolean; gpsUploaded: boolean }
  ): { allowed: boolean; template?: string } => {
    // نحدد القواعد المطابقة لهذا الإجراء والطرف
    const matchingRules = currentRules.filter((r) => {
      if (!r.active) return false;
      if (r.actionType !== actionType) return false;
      if (r.targetParty !== "any" && r.targetParty !== partyKey) return false;
      return true;
    });

    if (matchingRules.length === 0) {
      // إذا لم توجد قاعدة تخصيص افتراضية للطرف تفترض السماح كـ fallback
      return { allowed: actionType === "chat" || actionType === "call" };
    }

    for (const rule of matchingRules) {
      if (shouldShowButtonRule(rule, orderStatus, locStatus)) {
        return { allowed: true, template: rule.template };
      }
    }

    return { allowed: false };
  };

  // قائمة الأشخاص المتاحين لكل نوع إجراء بالتحديد
  const getAllowedContactsForAction = (actionType: "chat" | "call" | "location" | "notify") => {
    const actType = actionType === "chat" ? "whatsapp" : actionType === "location" ? "location_request" : actionType;

    return allPossibleParties.filter((party) => {
      const res = isPartyAllowedForAction(party.partyKey, actType, party.locStatus);
      return res.allowed;
    });
  };

  const allowedChats = getAllowedContactsForAction("chat");
  const allowedCalls = getAllowedContactsForAction("call");
  const allowedLocations = getAllowedContactsForAction("location");
  const allowedNotifies = getAllowedContactsForAction("notify");

  // توليد وصياغة النص المبرمج من صفحة الإعدادات لكل نوع وجبهة
  const getRenderedMessage = (
    type: "chat" | "location" | "notify",
    partyKey: "sender_1" | "sender_2" | "recipient_1" | "recipient_2",
    isSender: boolean
  ): string => {
    const actType = type === "chat" ? "whatsapp" : type === "location" ? "location_request" : type;
    const locStatus = isSender
      ? { hasLocation: senderHasLocation, gpsUploaded: senderGpsUploaded }
      : { hasLocation: recipientHasLocation, gpsUploaded: recipientGpsUploaded };

    const check = isPartyAllowedForAction(partyKey, actType, locStatus);
    let tpl = check.template !== undefined ? check.template : undefined;

    if (tpl === undefined) {
      const activeTpl = twoWayTemplates || dynConfig;
      if (type === "chat") {
        tpl = isSender
          ? activeTpl?.chatSenderTemplate ?? ""
          : activeTpl?.chatRecipientTemplate ?? "";
      } else if (type === "location") {
        tpl = isSender
          ? activeTpl?.locationSenderTemplate ?? ""
          : activeTpl?.locationRecipientTemplate ?? "";
      } else if (type === "notify") {
        tpl = isSender
          ? activeTpl?.notifySenderTemplate ?? ""
          : activeTpl?.notifyRecipientTemplate ?? "";
      }
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
  const handleExecuteTarget = (
    partyKey: "sender_1" | "sender_2" | "recipient_1" | "recipient_2",
    targetPhoneRaw: string,
    isSender: boolean
  ) => {
    const cleanPhone = digitsOnly(targetPhoneRaw || "");
    if (!cleanPhone || !activeAction) return;

    if (activeAction === "call") {
      openUrlFromUserGesture(telHref(cleanPhone));
      closeAll();
      return;
    }

    const message = getRenderedMessage(activeAction, partyKey, isSender);
    const url = whatsappMeUrl(cleanPhone, message);
    openUrlFromUserGesture(url);
    closeAll();
  };

  const actionTitles = {
    chat: "مراسلة واتساب",
    call: "اتصال هاتفي",
    location: "طلب لوكيشن",
    notify: "تبليغ زبون",
  };

  const currentActiveContacts = activeAction ? getAllowedContactsForAction(activeAction) : [];

  const fabContent = (
    <>
      {/* الزر العائم المصمم بنفس الديزاين القديم بالكامل (يختفي عند فتح القائمة) */}
      {!isOpen && (
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
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleButtonClick}
            className="flex h-[56px] w-[56px] cursor-pointer touch-none select-none items-center justify-center rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.4)] ring-4 ring-white transition-all duration-300 active:scale-95 bg-indigo-600 hover:bg-indigo-700 outline-none focus:outline-none"
            style={{
              transform: `scale(${scale})`,
              opacity: opacity,
              transition: isDragging ? "none" : "transform 0.2s, background-color 0.3s, opacity 0.3s",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            <svg
              className="h-7 w-7 text-white drop-shadow-xs pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </button>

          {/* تلميح السحب والتحريك */}
          {!isConfiguring && (
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] font-black text-white opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
              اسحب للتحريك | اضغط مطولاً للإعدادات
            </div>
          )}
        </div>
      )}

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

      {/* --- القائمة المنبثقة المختصرة للأزرار مع الفلترة الذكية القاطعة --- */}
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
            // العرض الأول: الأزرار المتاحة المنطبقة عليها الشروط فقط
            <div className="grid grid-cols-1 gap-2">
              {allowedChats.length > 0 && (
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
              )}

              {allowedCalls.length > 0 && (
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
              )}

              {allowedLocations.length > 0 && (
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
              )}

              {allowedNotifies.length > 0 && (
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
              )}

              {allowedChats.length === 0 &&
                allowedCalls.length === 0 &&
                allowedLocations.length === 0 &&
                allowedNotifies.length === 0 && (
                  <p className="text-center text-xs font-bold text-slate-400 py-3">
                    لا توجد أزرار مفعّلة تنطبق على حالة الطلب أو اللوكيشن الحالية.
                  </p>
                )}

              {/* زر الإغلاق الأحمر - إبعاده مسافة محترمة */}
              <div className="pt-2 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => closeAll(true)}
                  className="w-full py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-xs hover:bg-rose-100 active:scale-95 transition"
                >
                  ✕ إغلاق القائمة
                </button>
              </div>
            </div>
          ) : (
            // العرض الثاني: اختيار الشخص الفوري المنطبق عليه شرط الإجراء فقط
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
                {currentActiveContacts.length > 0 ? (
                  currentActiveContacts.map((contact) => (
                    <button
                      key={contact.partyKey}
                      type="button"
                      onClick={() => handleExecuteTarget(contact.partyKey, contact.phone, contact.isSender)}
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
                    لا يوجد أشخاص ينطبق عليهم هذا الإجراء وشروطه في الوقت الحالي.
                  </p>
                )}
              </div>

              {/* زر الإغلاق الأحمر */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => closeAll(true)}
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
