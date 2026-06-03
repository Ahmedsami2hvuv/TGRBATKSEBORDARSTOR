"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setPreparerPresenceFromForm, type PreparerActionState } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";
import { preparerPath } from "@/lib/preparer-portal-nav";

const initial: PreparerActionState = {};

export function PreparerPresenceToggle({
  auth,
  availableForAssignment,
  icons,
}: {
  auth: { p: string; exp: string; s: string };
  availableForAssignment: boolean;
  icons?: GlobalIconsConfig | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(setPreparerPresenceFromForm, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const nextAvailable = !availableForAssignment;

  return (
    <div className="flex w-full items-center gap-1 sm:w-auto">
      <form action={formAction} className="flex-1 min-w-0 flex flex-col">
        <input type="hidden" name="p" value={auth.p} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />
        <input type="hidden" name="available" value={nextAvailable ? "true" : "false"} />
        {state.error ? (
          <p className="mb-1 text-[10px] font-bold text-rose-700">تعذّر الحفظ: {state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className={`flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-xl px-1.5 text-[10px] font-black shadow-sm ring-1 transition sm:h-9 sm:w-auto sm:px-2.5 sm:text-xs ${
            availableForAssignment
              ? "bg-emerald-600 text-white ring-emerald-400 hover:bg-emerald-700"
              : "bg-slate-500 text-white ring-slate-400 hover:bg-slate-600"
          }`}
          title={
            availableForAssignment
              ? "متاح للإسناد — اضغط لإيقاف التوفر"
              : "غير متاح — اضغط لإعلان التوفر"
          }
        >
          {pending ? (
            "…"
          ) : (
            <>
              <DynamicIcon
                iconKey={availableForAssignment ? "ui_success" : "wallet_pending"}
                config={icons}
                className="h-3 w-3"
                fallback={<span>{availableForAssignment ? "✓" : "⏸"}</span>}
              />
              {availableForAssignment ? "متاح للإسناد" : "غير متاح"}
            </>
          )}
        </button>
      </form>

      <FullscreenWalletLauncher
        href={preparerPath("/preparer/debts", auth)}
        className="inline-flex h-8 w-1/3 shrink-0 items-center justify-center gap-1 rounded-xl border border-rose-500 bg-rose-600 px-2 text-center text-[10px] font-black text-white shadow-sm hover:bg-rose-700 transition sm:h-9 sm:w-auto sm:px-3 sm:text-xs"
        title="الديون"
      >
        الديون
      </FullscreenWalletLauncher>
    </div>
  );
}
