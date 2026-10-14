"use client";

import { useActionState, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { recordCourierShiftPresenceAction, type MandoubPresenceState } from "./mandoub-presence-actions";

type Props = {
  auth: { c: string; exp: string; s: string };
  initialShow: boolean;
};

const initial: MandoubPresenceState = {};

export function MandoubShiftPresenceButton({ auth, initialShow }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(recordCourierShiftPresenceAction, initial);
  const [visible, setVisible] = useState(initialShow);
  const [justRecorded, setJustRecorded] = useState(false);

  // إحداثيات السحب والتحريك الحر للزر العائم
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    moved: false,
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

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      dragRef.current.moved = true;
    }
    setPosition({
      x: dragRef.current.initX + dx,
      y: dragRef.current.initY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: "none",
      }}
      className={`fixed top-4 inset-x-4 z-[999] mx-auto max-w-xs transition-shadow duration-200 select-none ${
        isDragging ? "cursor-grabbing scale-105" : "cursor-grab"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <form action={formAction} className="w-full">
        <input type="hidden" name="c" value={auth.c} />
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
            <span>تم تسجيل الحضور بنجاح</span>
          </div>
        ) : (
          <button
            type="submit"
            onClick={handleButtonClick}
            disabled={pending}
            className="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 font-black text-white shadow-[0_10px_30px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400/80 transition-transform active:scale-95 hover:brightness-110 disabled:opacity-80"
          >
            <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 text-xs pointer-events-none">
              ⋮⋮
            </span>

            {pending ? (
              <span className="flex items-center gap-2 text-base">
                <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>جاري تسجيل الحضور...</span>
              </span>
            ) : (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </span>
                <span className="text-lg tracking-wide">تسجيل حضور</span>
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
