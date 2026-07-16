"use client";

import Link from "next/link";

type Auth = { c: string; exp?: string; s: string };

type Props = {
  auth: Auth;
  availableForAssignment: boolean;
  telegramLink: string | null;
  baseQueryString: string;
};

export function MandoubSettingsDropdown({
  auth,
  availableForAssignment,
  telegramLink,
  baseQueryString,
}: Props) {
  return (
    <Link
      href={`/mandoub/settings?${baseQueryString}`}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-[#00f3ff]/30 text-lg shadow-sm transition hover:scale-105 active:scale-95"
      title="إعدادات التطبيق"
    >
      ⚙️
    </Link>
  );
}
