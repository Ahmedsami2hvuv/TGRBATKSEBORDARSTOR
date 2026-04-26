"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setCourierPresenceFromForm, type MandoubPresenceState } from "./mandoub-presence-actions";

const initial: MandoubPresenceState = {};

export function MandoubPresenceToggle({
  auth,
  availableForAssignment,
}: {
  auth: { c: string; exp: string; s: string };
  availableForAssignment: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(setCourierPresenceFromForm, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const nextAvailable = !availableForAssignment;

  return (
    <form action={formAction} className="flex min-w-0 flex-col">
      <input type="hidden" name="c" value={auth.c} />
      <input type="hidden" name="exp" value={auth.exp} />
      <input type="hidden" name="s" value={auth.s} />
      <input type="hidden" name="available" value={nextAvailable ? "true" : "false"} />
      {state.error ? (
        <p className="mb-1 text-[10px] font-bold text-rose-700">تعذّر الحفظ: {state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex h-8 w-full shrink-0 items-center justify-center rounded-lg px-2.5 text-[11px] font-black shadow-sm ring-1 transition sm:h-9 sm:w-auto sm:px-3 sm:text-xs ${
          availableForAssignment
            ? "bg-emerald-600 text-white ring-emerald-400 hover:bg-emerald-700"
            : "bg-slate-500 text-white ring-slate-400 hover:bg-slate-600"
        }`}
        title={availableForAssignment ? "متاح للإسناد — اضغط لإيقاف التوفر" : "غير متاح — اضغط لإعلان التوفر"}
      >
        {pending ? "…" : availableForAssignment ? "✓ متاح للإسناد" : "⏸ غير متاح"}
      </button>
    </form>
  );
}
