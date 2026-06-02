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
  preparerPhone?: string;
  editUrl?: string;
  customWaButtons?: Array<{
    id: string;
    label: string;
    iconKey: string | null;
    messages: string[];
  }>;
  hideAllButtons?: boolean;
  showCallBtn?: boolean;
  showWhatsAppBtn?: boolean;
};

export function OrderFabDock(props: OrderFabDockProps) {
  const {
    storageKey,
    shopPhone,
    customerPhone,
    customWaButtons,
    hideAllButtons = false,
    showCallBtn = true,
    showWhatsAppBtn = true,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [activeMenu, setActiveMenu] = useState<null | "call" | "wa" | { type: "custom", btn: any }>(null);
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
          <button
            onClick={() => {
              const phone = shopPhone;
              if (activeMenu === "call") openUrlFromUserGesture(telHref(phone));
              else if (activeMenu === "wa") openUrlFromUserGesture(whatsappMeUrl(phone));
              else if (typeof activeMenu === 'object') openUrlFromUserGesture(whatsappMeUrl(phone, activeMenu.btn.messages[0] || ""));
              closeAll();
            }}
            className="flex h-12 w-40 items-center justify-center rounded-xl bg-white text-slate-800 shadow-2xl font-black border-2 border-indigo-600 active:scale-95 text-sm"
          >
            المحل (العميل)
          </button>
          <button
            onClick={() => {
              const phone = customerPhone;
              if (activeMenu === "call") openUrlFromUserGesture(telHref(phone));
              else if (activeMenu === "wa") openUrlFromUserGesture(whatsappMeUrl(phone));
              else if (typeof activeMenu === 'object') openUrlFromUserGesture(whatsappMeUrl(phone, activeMenu.btn.messages[0] || ""));
              closeAll();
            }}
            className="flex h-12 w-40 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xl font-black active:scale-95 text-sm"
          >
            الزبون
          </button>
          <button onClick={() => setActiveMenu(null)} className="mt-1 text-xs font-bold text-white bg-slate-800/90 py-2 rounded-lg text-center shadow-lg">رجوع للخلف</button>
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
            <button key={btn.id} onClick={() => setActiveMenu({ type: "custom", btn })} className="flex h-12 w-48 items-center justify-center gap-3 rounded-2xl bg-violet-600 text-white shadow-2xl font-bold ring-2 ring-white active:scale-95">
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
          transition: isDragging ? 'none' : 'transform 0.2s, background-color 0.3s, opacity 0.3s'
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
