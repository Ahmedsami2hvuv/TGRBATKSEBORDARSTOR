/**
 * أنماط موحّدة لحقول الصادر (أخضر) والوارد (أحمر) ومبالغ السجل — تباين عالٍ على الجوال.
 */

/** عدد الأيام المعروضة في سجل محفظة المندوب/المجهز (إخفاء عرضي فقط — لا يحذف من قاعدة البيانات) */
export const WALLET_LEDGER_VISIBLE_DAYS = 10;

export function filterLedgerByRecentDays<T extends { createdAt: string; deletedAt?: string | null }>(
  lines: T[],
  days: number = WALLET_LEDGER_VISIBLE_DAYS,
): T[] {
  const cutoff = Date.now() - days * 86400000;
  return lines.filter((l) => {
    if (l.deletedAt) return true;
    return new Date(l.createdAt).getTime() >= cutoff;
  });
}

/** صندوق «سعر الطلب / المبلغ الكلي» و«المتبقي» — صادر */
export const moneySaderSummaryBoxClass =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 rounded-xl border-2 border-emerald-700 bg-lime-300 px-3 py-2.5 text-xs text-emerald-950 shadow-inner sm:text-sm dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-100";

export const moneySaderTotalValueClass =
  "text-lg font-black tabular-nums text-emerald-950 sm:text-xl drop-shadow-sm dark:text-emerald-100";

export const moneySaderRemainValueClass =
  "text-lg font-black tabular-nums text-orange-950 sm:text-xl drop-shadow-sm dark:text-amber-200";

/** حقل إدخال المبلغ — صادر */
export const moneySaderAmountInputClass =
  "w-full rounded-xl border-2 border-emerald-800 bg-lime-100 px-3 py-2.5 text-lg font-black tabular-nums text-emerald-950 shadow-inner placeholder:text-emerald-800/50 dark:bg-slate-900 dark:border-emerald-900 dark:text-emerald-100";

/** صندوق المبلغ الكلي والمتبقي — وارد */
export const moneyWardSummaryBoxClass =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 rounded-xl border-2 border-red-800 bg-red-500 px-3 py-2.5 text-xs text-red-950 shadow-inner sm:text-sm dark:bg-red-900/40 dark:border-red-800 dark:text-red-100";

export const moneyWardTotalValueClass =
  "text-lg font-black tabular-nums text-white sm:text-xl drop-shadow-md dark:text-red-100";

export const moneyWardRemainValueClass =
  "text-lg font-black tabular-nums text-amber-100 sm:text-xl drop-shadow-md dark:text-amber-200";

/** حقل إدخال المبلغ — وارد */
export const moneyWardAmountInputClass =
  "w-full rounded-xl border-2 border-red-800 bg-red-100 px-3 py-2.5 text-lg font-black tabular-nums text-red-950 shadow-inner placeholder:text-red-800/55 dark:bg-slate-900 dark:border-red-900 dark:text-red-100";

/** مبلغ «أخذت» (وارد للمحفظة) */
export const moneyMiscWardAmountInputClass = moneyWardAmountInputClass;

/** مبلغ «أعطيت» (صادر من المحفظة) */
export const moneyMiscSaderAmountInputClass = moneySaderAmountInputClass;

/** حقل مبلغ التحويل بين الأطراف */
export const moneyTransferAmountInputClass =
  "mt-1 w-full rounded-xl border-2 border-violet-600 bg-violet-100 px-3 py-2.5 font-mono text-lg font-black tabular-nums text-violet-950 shadow-inner placeholder:text-violet-700/50 dark:bg-slate-900 dark:border-violet-900 dark:text-violet-100";

/** مبلغ بارز في بطاقة معاملة */
export const moneyLedgerAmountClass =
  "text-xl font-black tabular-nums tracking-tight sm:text-2xl";
