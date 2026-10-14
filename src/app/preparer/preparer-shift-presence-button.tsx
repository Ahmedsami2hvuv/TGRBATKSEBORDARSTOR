"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordPreparerShiftPresenceAction, type PreparerActionState } from "./actions";

type Props = {
  auth: { p: string; exp: string; s: string };
  initialShow: boolean;
};

const initial: PreparerActionState = {};

export function PreparerShiftPresenceButton({ auth, initialShow }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(recordPreparerShiftPresenceAction, initial);
  const [visible, setVisible] = useState(initialShow);
  const [justRecorded, setJustRecorded] = useState(false);

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

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 inset-x-4 z-50 mx-auto max-w-xs transition-all duration-300 ease-in-out">
      <form action={formAction} className="w-full">
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
            <span>تم تسجيل الشفت بنجاح</span>
          </div>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 font-black text-white shadow-[0_10px_25px_-5px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400/80 transition-all duration-200 active:scale-95 hover:brightness-110 disabled:opacity-80"
          >
            {/* لمعة متحركة لجذب انتباه المجهز */}
            <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

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
                <span className="text-lg tracking-wide">تسجيل شفت</span>
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
