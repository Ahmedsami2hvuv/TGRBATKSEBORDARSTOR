"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className={ad.label}>كلمة مرور الإدارة</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          spellCheck={false}
          autoCapitalize="off"
          className={ad.input}
        />
      </label>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={ad.btnPrimary}
      >
        {pending ? "جارٍ الدخول…" : "تسجيل الدخول"}
      </button>
      <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-4">
        <Link
          href="/register"
          className="text-sm font-bold text-sky-800 transition hover:text-sky-950 hover:underline"
        >
          إنشاء الحساب
        </Link>
        <Link
          href="/forgot-password"
          className="text-sm font-semibold text-slate-600 transition hover:text-slate-900 hover:underline"
        >
          نسيت الرمز؟
        </Link>
      </div>
    </form>
  );
}
