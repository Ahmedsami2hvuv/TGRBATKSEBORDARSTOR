"use client";

import Link from "next/link";
import { preparerPath } from "@/lib/preparer-portal-nav";

type Props = {
  auth: { p: string; exp: string; s: string };
  preparerName: string;
};

export function SalaryWithdrawalButton({ auth }: Props) {
  const href = preparerPath("/preparer/salary", auth);

  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-sky-200 bg-sky-50 px-3 py-2 text-center text-sm font-black text-sky-600 shadow-sm hover:bg-sky-100 transition dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-800"
      title="استلام الراتب اليومي والمتراكم"
    >
      <span>💸</span>
      استلام راتب
    </Link>
  );
}
