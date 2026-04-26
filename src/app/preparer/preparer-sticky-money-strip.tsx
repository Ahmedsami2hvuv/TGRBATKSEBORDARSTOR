"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { ThemeSwitcher } from "@/components/theme-switcher";

type Summary = {
  wardStr: string;
  saderStr: string;
  remainStr: string;
};

export function PreparerStickyMoneyStrip() {
  const sp = useSearchParams();
  const p = sp.get("p") ?? "";
  const exp = sp.get("exp") ?? "";
  const s = sp.get("s") ?? "";
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!p || !exp || !s) {
      setData(null);
      setFailed(false);
      return;
    }
    const q = new URLSearchParams({ p, exp, s });
    let cancelled = false;
    setFailed(false);
    fetch(`/api/preparer/money-summary?${q.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("bad");
        return r.json() as Promise<Summary>;
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [p, exp, s]);

  if (!p || !exp || !s) return null;

  const walletHref = preparerPath("/preparer/wallet", { p, exp, s });
  const dash = "—";

  const ward = failed ? dash : data?.wardStr ?? "…";
  const sader = failed ? dash : data?.saderStr ?? "…";
  const remain = failed ? dash : data?.remainStr ?? "…";

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 px-2 py-2 shadow-sm backdrop-blur-sm sm:px-3 dark:bg-[#09090b]/90 dark:border-[rgba(0,243,255,0.2)]">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <p className="text-[11px] font-bold text-slate-600 sm:text-xs dark:text-slate-300">ملخص الأموال (طلبات محلاتك)</p>
        <div className="scale-75 origin-left sm:origin-center sm:scale-100">
           <ThemeSwitcher />
        </div>
      </div>
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:overflow-visible sm:pb-0">
        <Link
          href={walletHref}
          className="flex min-w-[4.75rem] max-w-[33%] flex-1 shrink-0 flex-col rounded-lg border-2 border-red-500 bg-red-50/95 px-1.5 py-1.5 text-center shadow-sm ring-red-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2"
          title="ما استُلم من الزبون (وارد) — حركات الطلبات لمحلاتك"
        >
          <span className="text-[9px] font-bold leading-tight text-red-900 sm:text-[10px]">الوارد</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-red-800 sm:text-base">
            {ward}
          </span>
        </Link>
        <Link
          href={walletHref}
          className="flex min-w-[4.75rem] max-w-[33%] flex-1 shrink-0 flex-col rounded-lg border-2 border-emerald-600 bg-emerald-50/95 px-1.5 py-1.5 text-center shadow-sm ring-emerald-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2"
          title="ما دُفع للعميل (صادر) — حركات الطلبات لمحلاتك"
        >
          <span className="text-[9px] font-bold leading-tight text-emerald-900 sm:text-[10px]">الصادر</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-emerald-800 sm:text-base">
            {sader}
          </span>
        </Link>
        <Link
          href={walletHref}
          className="flex min-w-[4.75rem] max-w-[33%] flex-1 shrink-0 flex-col rounded-lg border-2 border-blue-600 bg-blue-50/95 px-1.5 py-1.5 text-center shadow-sm ring-blue-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2"
          title="وارد − صادر — تفاصيل محفظتك في «محفظتي»"
        >
          <span className="text-[9px] font-bold leading-tight text-blue-900 sm:text-[10px]">المتبقي</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-blue-800 sm:text-base">
            {remain}
          </span>
        </Link>
      </div>
    </div>
  );
}
