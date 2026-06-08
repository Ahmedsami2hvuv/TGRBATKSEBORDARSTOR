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
      className="inline-flex h-8 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sky-200/90 bg-sky-50 px-3 text-center text-[10px] font-black text-sky-600 shadow-sm hover:bg-sky-100 transition sm:h-9 sm:w-auto sm:px-4 sm:text-xs dark:bg-[#0ea5e9]/10 dark:text-[#38bdf8] dark:border-[#0ea5e9]/20 dark:hover:bg-[#0ea5e9]/20"
      title="استلام الراتب اليومي والمتراكم"
    >
      <span>💸</span>
      استلام راتب
    </Link>
  );
}
