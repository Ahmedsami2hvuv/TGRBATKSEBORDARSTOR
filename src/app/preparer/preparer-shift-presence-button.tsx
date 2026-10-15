"use client";

import { useActionState, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { recordPreparerShiftPresenceAction, type PreparerActionState } from "./actions";

type Props = {
  auth: { p: string; exp: string; s: string };
  initialShow: boolean;
  shiftLabel?: string;
};

const initial: PreparerActionState = {};

export function PreparerShiftPresenceButton({ auth, initialShow, shiftLabel }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(recordPreparerShiftPresenceAction, initial);
  const [visible, setVisible] = useState(initialShow);
  const [justRecorded, setJustRecorded] = useState(false);

  // إحداثيات السحب والتحريك الحر للزر العائم
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    hasMoved: false,
  });

  useEffect(() => {
    if (state.ok) {
      setJustRecorded(true);
      const timer = setTimeout(() => {
        setVisible(false);
        router.refresh();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state.ok, router]);

  // منع ميزة Pull-to-refresh وتحديث الصفحة في الهواتف نهائياً أثناء لمس الزر
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        dragRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          initX: position.x,
          initY: position.y,
          hasMoved: false,
        };
        setIsDragging(true);
      }
    };

    const onTouchMoveNative = (e: TouchEvent) => {
      // منع المتصفح من عمل ريفريش للشاشة
      e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragRef.current.startX;
        const dy = touch.clientY - dragRef.current.startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          dragRef.current.hasMoved = true;
        }
        setPosition({
          x: dragRef.current.initX + dx,
          y: dragRef.current.initY + dy,
        });
      }
    };

    const onTouchEndNative = () => {
      setIsDragging(false);
    };

    el.addEventListener("touchstart", onTouchStartNative, { passive: true });
    el.addEventListener("touchmove", onTouchMoveNative, { passive: false });
    el.addEventListener("touchend", onTouchEndNative, { passive: true });
    el.addEventListener("touchcancel", onTouchEndNative, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStartNative);
      el.removeEventListener("touchmove", onTouchMoveNative);
      el.removeEventListener("touchend", onTouchEndNative);
      el.removeEventListener("touchcancel", onTouchEndNative);
    };
  }, [position, visible]);

  // دعم السحب بالماوس للكمبيوتر
  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
      hasMoved: false,
    };
    setIsDragging(true);

    const onMouseMove = (moveEvt: MouseEvent) => {
      moveEvt.preventDefault();
      const dx = moveEvt.clientX - dragRef.current.startX;
      const dy = moveEvt.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragRef.current.hasMoved = true;
      }
      setPosition({
        x: dragRef.current.initX + dx,
        y: dragRef.current.initY + dy,
      });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    // إذا كان المجهز يقوم بسحب الزر، نمنع إرسال النموذج
    if (dragRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: "none",
        overscrollBehavior: "none",
      }}
      className={`fixed top-4 inset-x-4 z-[9999] mx-auto max-w-xs transition-shadow duration-200 select-none ${
        isDragging ? "cursor-grabbing scale-105" : "cursor-grab"
      }`}
      onMouseDown={handleMouseDown}
    >
      <form ref={formRef} action={formAction} className="w-full">
        <input type="hidden" name="p" value={auth.p} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />

        {state.error ? (
          <div className="mb-2 rounded-xl bg-rose-600/95 px-3 py-2 text-center text-xs font-bold text-white shadow-lg backdrop-blur">
            {state.error}
          </div>
        ) : null}

        {justRecorded ? (
          <div className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-black text-white shadow-2xl ring-2 ring-emerald-400">
            <svg className="h-6 w-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            <span>{shiftLabel ? `تم تسجيل الشفت ${shiftLabel} بنجاح` : "تم تسجيل الشفت بنجاح"}</span>
          </div>
        ) : (
          <button
            type="submit"
            onClick={handleButtonClick}
            disabled={pending}
            style={{ touchAction: "none" }}
            className="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 font-black text-white shadow-[0_10px_30px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400/80 transition-transform active:scale-95 hover:brightness-110 disabled:opacity-80"
          >
            {/* لمعة متحركة مستمرة لتأكيد أنه عائم ومتحرك */}
            <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

            {/* مقبض سحب جانبي */}
            <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 text-xs font-mono pointer-events-none">
              ⋮⋮
            </span>

            {pending ? (
              <span className="flex items-center gap-2 text-base">
                <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>جاري تسجيل الشفت...</span>
              </span>
            ) : (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span className="text-lg tracking-wide">{shiftLabel ? `تسجيل الشفت ${shiftLabel}` : "تسجيل شفت"}</span>
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
