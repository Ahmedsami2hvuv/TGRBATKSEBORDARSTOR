"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { openUrlFromUserGesture, telHref, whatsappMeUrl } from "@/lib/whatsapp";
import { DynamicIcon } from "./dynamic-icon";
import { getGlobalIcons, type GlobalIconsConfig } from "@/lib/icon-settings";

export const FAB_SIZE = 56;
const DRAG_THRESHOLD = 5;
const LONG_PRESS_DURATION = 800;

const GLOBAL_FAB_POS_KEY = "global_mandoub_fab_position";
const GLOBAL_FAB_OPACITY_KEY = "global_mandoub_fab_opacity";

export const FAB_SCALE_MIN = 0.55;
export const FAB_SCALE_MAX = 1.85;

export function loadFabScale(storageKey: string): number {
  try {
    const raw = localStorage.getItem(`${storageKey}_fabScale`);
    return raw ? Number(raw) : 1;
  } catch { return 1; }
}

export function saveFabScale(storageKey: string, scale: number) {
  try {
    localStorage.setItem(`${storageKey}_fabScale`, String(scale));
  } catch { /* ignore */ }
}

export function loadFabOpacity(): number {
  try {
    const raw = localStorage.getItem(GLOBAL_FAB_OPACITY_KEY);
    return raw ? Number(raw) : 1;
  } catch { return 1; }
}

export function saveFabOpacity(opacity: number) {
  try {
    localStorage.setItem(GLOBAL_FAB_OPACITY_KEY, String(opacity));
  } catch { /* ignore */ }
}

type Pos = { left: number; top: number };

export type OrderFabDockProps = {
  storageKey: string;
  orderId: string;
  shopPhone: string;
  customerPhone: string;
  customerAlternatePhone?: string;
  secondCustomerPhone?: string;
  secondCustomerAlternatePhone?: string;
  preparerPhone?: string;
  editUrl?: string;
  customWaButtons?: Array<{
    id: string;
    label: string;
    iconKey: string | null;
    messages: string[];
    recipient?: string;
  }>;
  hideAllButtons?: boolean;
  showCallBtn?: boolean;
  showWhatsAppBtn?: boolean;
  isDoubleRoute?: boolean;
};

export function OrderFabDock(props: OrderFabDockProps) {
  const {
    storageKey,
    shopPhone,
    customerPhone,
    customerAlternatePhone,
    secondCustomerPhone,
    secondCustomerAlternatePhone,
    customWaButtons,
    hideAllButtons = false,
    showCallBtn = true,
    showWhatsAppBtn = true,
    isDoubleRoute = false,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [activeMenu, setActiveMenu] = useState<
    | null
    | "call"
    | "wa"
    | {
        type: "custom";
        btn: {
          id: string;
          label: string;
          iconKey: string | null;
          messages: string[];
          recipient?: string;
        };
        contacts: Array<{
          type: string;
          phone: string;
          label: string;
        }>;
      }
  >(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const [pos, setPos] = useState<Pos>({ left: -1, top: -1 });
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, origLeft: 0, origTop: 0, moved: false });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    getGlobalIcons().then(setIcons);
    setScale(loadFabScale(storageKey));
    setOpacity(loadFabOpacity());

    const saved = localStorage.getItem(GLOBAL_FAB_POS_KEY);
    if (saved) {
      try { setPos(JSON.parse(saved)); } catch (e) {
        setPos({ left: window.innerWidth - FAB_SIZE - 20, top: window.innerHeight - 150 });
      }
    } else {
      setPos({ left: window.innerWidth - FAB_SIZE - 20, top: window.innerHeight - 150 });
    }
  }, [storageKey]);

  if (!mounted || hideAllButtons || pos.left === -1) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isExpanded || isConfiguring) return;
    if (e.cancelable) {
      try { e.preventDefault(); } catch {}
    }
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: pos.left,
      origTop: pos.top,
      moved: false
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);

    // بدء مؤقت الضغط المطول
    longPressTimer.current = setTimeout(() => {
      setIsDragging(false);
      setIsConfiguring(true);
    }, LONG_PRESS_DURATION);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    if (e.cancelable) {
      try { e.preventDefault(); } catch {}
    }
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    const newLeft = Math.max(0, Math.min(window.innerWidth - FAB_SIZE, dragRef.current.origLeft + dx));
    const newTop = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, dragRef.current.origTop + dy));
    setPos({ left: newLeft, top: newTop });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (dragRef.current.moved) {
      localStorage.setItem(GLOBAL_FAB_POS_KEY, JSON.stringify(pos));
    } else if (!isConfiguring) {
      setIsExpanded(!isExpanded);
      setActiveMenu(null);
    }
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (e) {}
  };

  const handleCustomWaButtonClick = (btn: {
    id: string;
    label: string;
    iconKey: string | null;
    messages: string[];
    recipient?: string;
  }) => {
    const allowedRecipients = (btn.recipient || "customer")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const availableContacts: Array<{
      type: string;
      phone: string;
      label: string;
    }> = [];

    if (isDoubleRoute) {
      // في الطلب بوجهتين: المحل/المرسل = زبون الوجهة الأولى، المستلم = زبون الوجهة الثانية
      if (allowedRecipients.includes("shop") || allowedRecipients.includes("sender")) {
        if (customerPhone?.trim()) {
          availableContacts.push({
            type: "sender1",
            phone: customerPhone.trim(),
            label: customerAlternatePhone?.trim() ? "المرسل (رقم 1)" : "المرسل",
          });
        }
        if (customerAlternatePhone?.trim()) {
          availableContacts.push({
            type: "sender2",
            phone: customerAlternatePhone.trim(),
            label: "المرسل (رقم 2)",
          });
        }
      }

      if (allowedRecipients.includes("customer") || allowedRecipients.includes("receiver") || allowedRecipients.includes("recipient")) {
        if (secondCustomerPhone?.trim()) {
          availableContacts.push({
            type: "receiver1",
            phone: secondCustomerPhone.trim(),
            label: secondCustomerAlternatePhone?.trim() ? "المستلم (رقم 1)" : "المستلم",
          });
        }
        if (secondCustomerAlternatePhone?.trim()) {
          availableContacts.push({
            type: "receiver2",
            phone: secondCustomerAlternatePhone.trim(),
            label: "المستلم (رقم 2)",
          });
        }
      }

      if (allowedRecipients.includes("customer2") && secondCustomerAlternatePhone?.trim() && !availableContacts.some(c => c.phone === secondCustomerAlternatePhone.trim())) {
        availableContacts.push({
          type: "receiver2",
          phone: secondCustomerAlternatePhone.trim(),
          label: "المستلم (رقم 2)",
        });
      }
    } else {
      // طلب عادي غبر بوجهتين (محل + زبون)
      if (allowedRecipients.includes("shop") && shopPhone?.trim()) {
        availableContacts.push({
          type: "shop",
          phone: shopPhone.trim(),
          label: "المحل (العميل)",
        });
      }
      if (allowedRecipients.includes("customer") && customerPhone?.trim()) {
        const hasAlt = !!customerAlternatePhone?.trim();
        availableContacts.push({
          type: "customer",
          phone: customerPhone.trim(),
          label: hasAlt ? "الزبون الأول" : "الزبون",
        });
        if (hasAlt) {
          availableContacts.push({
            type: "customer2",
            phone: customerAlternatePhone.trim(),
            label: "الزبون الثاني",
          });
        }
      }
      if (allowedRecipients.includes("customer2") && customerAlternatePhone?.trim() && !availableContacts.some(c => c.type === "customer2")) {
        availableContacts.push({
          type: "customer2",
          phone: customerAlternatePhone.trim(),
          label: "الزبون الثاني",
        });
      }
    }

    // إذا لم يتوفر أي هاتف مطابق، نضع الهاتف الأول المتاح لتجنب تعطل الإرسال
    if (availableContacts.length === 0) {
      if (isDoubleRoute) {
        if (secondCustomerPhone?.trim()) {
          availableContacts.push({ type: "receiver1", phone: secondCustomerPhone.trim(), label: "المستلم" });
        } else if (customerPhone?.trim()) {
          availableContacts.push({ type: "sender1", phone: customerPhone.trim(), label: "المرسل" });
        }
      } else if (customerPhone?.trim()) {
        availableContacts.push({ type: "customer", phone: customerPhone.trim(), label: "الزبون الأول" });
      }
    }

    if (availableContacts.length === 1) {
      // مستلم واحد فقط -> إرسال مباشر دون سؤاله مع اختيار صيغة عشوائية
      const randomMsg = btn.messages.length > 0 ? btn.messages[Math.floor(Math.random() * btn.messages.length)] : "";
      openUrlFromUserGesture(whatsappMeUrl(availableContacts[0].phone, randomMsg));
      closeAll();
    } else {
      // أكثر من مستلم -> عرض الخيارات المحددة فقط
      setActiveMenu({
        type: "custom",
        btn,
        contacts: availableContacts,
      });
    }
  };

  const closeAll = () => {
    setIsExpanded(false);
    setIsConfiguring(false);
    setActiveMenu(null);
  };

  const resetAll = () => {
    const defLeft = window.innerWidth - FAB_SIZE - 20;
    const defTop = window.innerHeight - 150;
    setPos({ left: defLeft, top: defTop });
    setScale(1);
    setOpacity(1);
    localStorage.removeItem(GLOBAL_FAB_POS_KEY);
    saveFabScale(storageKey, 1);
    saveFabOpacity(1);
    setIsConfiguring(false);
  };

  const isOnLeftSide = pos.left < window.innerWidth / 2;
  const isOnTopHalf = pos.top < window.innerHeight / 2;
  const menuClass = isOnTopHalf ? "top-full mt-4" : "bottom-full mb-4";
  const animationClass = isOnTopHalf ? "slide-in-from-top-4" : "slide-in-from-bottom-4";

  // إعداد قائمة الهواتف المتاحة في خيار الاتصال الهاتفي ومراسلة الواتساب الرئيسية
  const mainContacts: Array<{ phone: string; label: string; isShop?: boolean }> = [];

  if (isDoubleRoute) {
    if (customerPhone?.trim()) {
      mainContacts.push({
        phone: customerPhone.trim(),
        label: customerAlternatePhone?.trim() ? "المرسل (رقم 1)" : "المرسل",
        isShop: true,
      });
    }
    if (customerAlternatePhone?.trim()) {
      mainContacts.push({
        phone: customerAlternatePhone.trim(),
        label: "المرسل (رقم 2)",
        isShop: true,
      });
    }
    if (secondCustomerPhone?.trim()) {
      mainContacts.push({
        phone: secondCustomerPhone.trim(),
        label: secondCustomerAlternatePhone?.trim() ? "المستلم (رقم 1)" : "المستلم",
      });
    }
    if (secondCustomerAlternatePhone?.trim()) {
      mainContacts.push({
        phone: secondCustomerAlternatePhone.trim(),
        label: "المستلم (رقم 2)",
      });
    }
  } else {
    if (shopPhone?.trim()) {
      mainContacts.push({
        phone: shopPhone.trim(),
        label: "المحل (العميل)",
        isShop: true,
      });
    }
    if (customerPhone?.trim()) {
      mainContacts.push({
        phone: customerPhone.trim(),
        label: customerAlternatePhone?.trim() ? "الزبون الأول" : "الزبون",
      });
    }
    if (customerAlternatePhone?.trim()) {
      mainContacts.push({
        phone: customerAlternatePhone.trim(),
        label: "الزبون الثاني",
      });
    }
  }

  const fabContent = (
    <div
      className="fixed z-[9999999]"
      style={{
        left: pos.left,
        top: pos.top,
        width: FAB_SIZE,
        height: FAB_SIZE,
        position: 'fixed',
        pointerEvents: 'auto',
        touchAction: 'none'
      }}
    >
      {/* خلفية الإغلاق (بدون تغويش) */}
      {(isExpanded || isConfiguring) && (
        <div
          className="fixed inset-0 bg-black/20 z-[-1]"
          style={{ width: '100vw', height: '100vh', left: -pos.left, top: -pos.top }}
          onClick={closeAll}
        />
      )}

      {/* لوحة التحكم في الحجم والشفافية */}
      {isConfiguring && (
        <div className={`absolute ${menuClass} flex flex-col gap-4 p-5 rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-2 border-indigo-600 animate-in fade-in zoom-in duration-200 ${isOnLeftSide ? 'left-0' : 'right-0'}`} style={{ width: '240px' }}>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase">
              <span>الحجم</span>
              <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{Math.round(scale * 100)}%</span>
            </div>
            <input type="range" min={FAB_SCALE_MIN} max={FAB_SCALE_MAX} step="0.05" value={scale} onChange={(e) => {
              const s = Number(e.target.value);
              setScale(s);
              saveFabScale(storageKey, s);
            }} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase">
              <span>الشفافية</span>
              <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">{Math.round(opacity * 100)}%</span>
            </div>
            <input type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={(e) => {
              const o = Number(e.target.value);
              setOpacity(o);
              saveFabOpacity(o);
            }} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" />
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <button onClick={resetAll} className="w-full py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold active:scale-95 transition-transform border border-rose-100">إعادة ضبط المصنع</button>
            <button onClick={() => setIsConfiguring(false)} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform shadow-lg shadow-indigo-200">حفظ وإغلاق</button>
          </div>
        </div>
      )}

      {/* قوائم الاختيار الفرعية */}
      {isExpanded && activeMenu && (
        <div className={`absolute ${menuClass} flex flex-col gap-2 animate-in fade-in zoom-in duration-200 ${isOnLeftSide ? 'left-0' : 'right-0'}`} style={{ width: 'max-content' }}>
          {typeof activeMenu === "object" && activeMenu.type === "custom" ? (
            // عرض جهات الاتصال الخاصة بالزر المخصص فقط
            activeMenu.contacts.map((contact, idx) => (
              <button
                key={`${contact.type}-${idx}`}
                onClick={() => {
                  const msgs = activeMenu.btn.messages;
                  const randomMsg = msgs.length > 0 ? msgs[Math.floor(Math.random() * msgs.length)] : "";
                  openUrlFromUserGesture(whatsappMeUrl(contact.phone, randomMsg));
                  closeAll();
                }}
                className={`flex h-12 w-44 items-center justify-center rounded-xl shadow-2xl font-black active:scale-95 text-sm ${
                  contact.type.startsWith("sender") || contact.type === "shop"
                    ? "bg-white text-slate-800 border-2 border-indigo-600"
                    : "bg-indigo-600 text-white"
                }`}
              >
                {contact.label}
              </button>
            ))
          ) : (
            // الاتصال ومراسلة واتساب العادية الافتراضية
            mainContacts.map((contact, idx) => (
              <button
                key={`${contact.phone}-${idx}`}
                onClick={() => {
                  if (activeMenu === "call") openUrlFromUserGesture(telHref(contact.phone));
                  else if (activeMenu === "wa") openUrlFromUserGesture(whatsappMeUrl(contact.phone));
                  closeAll();
                }}
                className={`flex h-12 w-44 items-center justify-center rounded-xl shadow-2xl font-black active:scale-95 text-sm ${
                  contact.isShop
                    ? "bg-white text-slate-800 border-2 border-indigo-600"
                    : "bg-indigo-600 text-white"
                }`}
              >
                {contact.label}
              </button>
            ))
          )}
          <button onClick={() => setActiveMenu(null)} className="flex h-12 w-44 items-center justify-center rounded-xl text-white bg-slate-800/90 shadow-lg font-bold text-sm active:scale-95 mt-1">رجوع للخلف</button>
        </div>
      )}

      {/* القائمة الرئيسية */}
      {isExpanded && !activeMenu && (
        <div className={`absolute ${menuClass} flex flex-col gap-3 animate-in fade-in ${animationClass} duration-200 ${isOnLeftSide ? 'left-0 items-start' : 'right-0 items-end'}`}>
          {showWhatsAppBtn && (
            <button onClick={() => setActiveMenu("wa")} className="flex h-12 w-48 items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-white shadow-2xl font-bold ring-2 ring-white active:scale-95">
              <DynamicIcon iconKey="ui_whatsapp" config={icons} className="h-5 w-5" />
              <span>مراسلة واتساب</span>
            </button>
          )}
          {showCallBtn && (
            <button onClick={() => setActiveMenu("call")} className="flex h-12 w-48 items-center justify-center gap-3 rounded-2xl bg-sky-500 text-white shadow-2xl font-bold ring-2 ring-white active:scale-95">
              <DynamicIcon iconKey="ui_call" config={icons} className="h-5 w-5" />
              <span>اتصال هاتفي</span>
            </button>
          )}
          {customWaButtons?.map((btn) => (
            <button key={btn.id} onClick={() => handleCustomWaButtonClick(btn)} className="flex h-12 w-48 items-center justify-center gap-3 rounded-2xl bg-violet-600 text-white shadow-2xl font-bold ring-2 ring-white active:scale-95">
              <DynamicIcon iconKey={btn.iconKey || undefined} config={icons} className="h-6 w-6" />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* الزر الرئيسي */}
      <div
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        className={`flex h-[56px] w-[56px] cursor-grab items-center justify-center rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.5)] ring-4 ring-white transition-all duration-300 active:cursor-grabbing ${isExpanded ? "bg-rose-500" : "bg-indigo-600"}`}
        style={{
          transform: `scale(${scale})`,
          opacity: opacity,
          transition: isDragging ? 'none' : 'transform 0.2s, background-color 0.3s, opacity 0.3s',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          overscrollBehavior: 'none',
        }}
      >
        {isExpanded ? (
          <svg className="h-8 w-8 text-white animate-in spin-in-90 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
        )}
      </div>
    </div>
  );

  return createPortal(fabContent, document.body);
}
