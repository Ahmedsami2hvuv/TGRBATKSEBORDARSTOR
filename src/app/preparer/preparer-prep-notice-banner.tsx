"use client";

import { useActionState } from "react";
import Link from "next/link";
import { dismissCompanyPreparerPrepNotice } from "./actions";

type Notice = { id: string; title: string; body: string };

const initial: { error?: string } = {};

export function PreparerPrepNoticeBanner({
  notices,
  auth,
  preparationHref,
}: {
  notices: Notice[];
  auth: { p: string; exp: string; s: string };
  preparationHref: string;
}) {
  const [state, formAction, pending] = useActionState(dismissCompanyPreparerPrepNotice, initial);

  if (notices.length === 0) return null;

  return (
    <div className="mb-2 space-y-2" dir="rtl">
      {state.error ? (
        <p className="text-center text-xs font-semibold text-rose-700">{state.error}</p>
      ) : null}
      {notices.map((n) => (
        <div
          key={n.id}
          className="flex flex-col gap-2 rounded-xl border border-violet-300 bg-gradient-to-l from-violet-50 to-white px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-violet-900">🔔 طلب تجهيز من الإدارة</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{n.title}</p>
            {n.body.trim() ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{n.body}</p>
            ) : null}
            <Link
              href={preparationHref}
              className="mt-2 inline-block text-xs font-bold text-violet-800 underline hover:text-violet-950"
            >
              فتح تجهيز الطلبات ←
            </Link>
          </div>
          <form action={formAction} className="flex shrink-0 flex-col gap-1 sm:items-end">
            <input type="hidden" name="p" value={auth.p} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="noticeId" value={n.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              تمت القراءة
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
