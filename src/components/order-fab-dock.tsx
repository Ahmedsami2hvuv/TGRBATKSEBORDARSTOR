"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { openUrlFromUserGesture, telHref, whatsappMeUrl } from "@/lib/whatsapp";
import { DynamicIcon } from "./dynamic-icon";
import { getGlobalIcons, type GlobalIconsConfig } from "@/lib/icon-settings";

export const FAB_SIZE = 56;
const DRAG_THRESHOLD = 10;

/** قيم مضافة لإصلاح خطأ البيلد في فيرسل */
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
    customerAlternatePhone,
    preparerPhone,
    editUrl,
    customWaButtons,
    hideAllButtons = false,
    showCallBtn = true,
    showWhatsAppBtn = true,
  } = props;

  const [isExpanded, setIsExpanded] = useState(false);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const [pos, setPos] = useState<Pos>({ left: -1, top: -1 });
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, origLeft: 0, origTop: 0, moved: false });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
    // تحميل الموقع المحفوظ
    const saved = localStorage.getItem(`fab_pos_${storageKey}`);
    if (saved) {
      try { setPos(JSON.parse(saved)); } catch (e) { /* ignore */ }
    }
  }, [storageKey]);

  // الموقع الافتراضي إذا لم يوجد موقع محفوظ
  useEffect(() => {
    if (pos.left === -1 && typeof window !== "undefined") {
      setPos({
        left: window.innerWidth - FAB_SIZE - 20,
        top: window.innerHeight - FAB_SIZE - 100
      });
    }
  }, [pos]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isExpanded) return; // منع السحب والقائمة مفتوحة
    const clientX = e.clientX;
    const clientY = e.clientY;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      origLeft: pos.left,
      origTop: pos.top,
      moved: false
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
    }

    const newLeft = Math.max(0, Math.min(window.innerWidth - FAB_SIZE, dragRef.current.origLeft + dx));
    const newTop = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, dragRef.current.origTop + dy));

    setPos({ left: newLeft, top: newTop });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if (dragRef.current.moved) {
      localStorage.setItem(`fab_pos_${storageKey}`, JSON.stringify(pos));
    } else {
      // إذا لم يتحرك، اعتبرها نقرة
      setIsExpanded(!isExpanded);
    }
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (e) {}
  };

  if (hideAllButtons || pos.left === -1) return null;

  const handleCall = (phone: string) => {
    openUrlFromUserGesture(telHref(phone));
    setIsExpanded(false);
  };

  const handleWa = (phone: string, message = "") => {
    openUrlFromUserGesture(whatsappMeUrl(phone, message));
    setIsExpanded(false);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {/* خلفية شفافة للإغلاق عند النقر في الخارج */}
      {isExpanded && (
        <div
          className="pointer-events-auto fixed inset-0 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div
        ref={containerRef}
        className="pointer-events-auto absolute touch-none"
        style={{ left: pos.left, top: pos.top, width: FAB_SIZE, height: FAB_SIZE }}
      >
        {/* القائمة المنبثقة */}
        {isExpanded && (
          <div className="absolute bottom-full right-0 mb-4 flex flex-col items-end gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {editUrl && (
              <a href={editUrl} className="flex h-12 items-center gap-2 rounded-2xl bg-sky-600 px-4 text-white shadow-2xl font-bold ring-2 ring-white">
                <span>تعديل الطلب</span>
              </a>
            )}

            {showWhatsAppBtn && (
              <button onClick={() => handleWa(customerPhone)} className="flex h-12 w-44 items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-white shadow-2xl font-bold ring-2 ring-white">
                <DynamicIcon iconKey="ui_whatsapp" config={icons} className="h-5 w-5" />
                <span>مراسلة واتساب</span>
              </button>
            )}

            {showCallBtn && (
              <button onClick={() => handleCall(customerPhone)} className="flex h-12 w-44 items-center justify-center gap-3 rounded-2xl bg-sky-500 text-white shadow-2xl font-bold ring-2 ring-white">
                <DynamicIcon iconKey="ui_call" config={icons} className="h-5 w-5" />
                <span>اتصال هاتفي</span>
              </button>
            )}

            {customWaButtons?.map((btn) => (
              <button
                key={btn.id}
                onClick={() => handleWa(customerPhone, btn.messages[0] || "")}
                className="flex h-12 w-44 items-center justify-center gap-3 rounded-2xl bg-violet-600 text-white shadow-2xl font-bold ring-2 ring-white"
              >
                <DynamicIcon iconKey={btn.iconKey || undefined} config={icons} className="h-6 w-6" />
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* الزر الرئيسي الجميل */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`flex h-full w-full cursor-grab items-center justify-center rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] ring-4 ring-white transition-colors duration-300 active:cursor-grabbing ${
            isExpanded ? "bg-rose-500" : "bg-indigo-600"
          }`}
        >
          {isExpanded ? (
            <svg className="h-8 w-8 text-white animate-in spin-in-90 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
