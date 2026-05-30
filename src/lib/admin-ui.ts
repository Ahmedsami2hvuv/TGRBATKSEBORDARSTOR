/**
 * لوحة الإدارة — ثيم فاتح: أبيض + سمائي + أزرق + أخضر زمردي
 */
export const ad = {
  h1: "text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl",
  h2: "text-lg font-semibold text-sky-800",
  h3: "text-base font-semibold text-emerald-800",
  lead: "text-sm text-slate-600",
  muted: "text-sm text-slate-500",
  link: "font-medium text-sky-700 hover:text-emerald-700 hover:underline",
  navButton: "inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100 hover:text-sky-950",
  section:
    "rounded-2xl border border-sky-200/90 bg-white p-4 shadow-sm shadow-sky-100/50 sm:p-5",
  input:
    "rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200",
  select:
    "rounded-xl border border-sky-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200",
  label: "text-sm font-medium text-sky-900",
  warn: "text-sm font-medium text-amber-800",
  success: "text-sm font-medium text-emerald-700",
  error: "text-sm font-medium text-rose-600",
  listDivide: "divide-y divide-slate-200",
  listTitle: "font-medium text-slate-800",
  listMuted: "text-sm text-slate-500",
  btnPrimary:
    "rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-sky-200/80 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700 disabled:opacity-50",
  btnDark:
    "rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-50 disabled:opacity-50",
  btnDanger:
    "rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50",
  dangerLink: "text-sm text-rose-600 underline hover:text-rose-700",
  /** أسفل جداول الطلبات — عدد الصفوف المعروضة */
  orderListCountFooter:
    "mt-3 border-t border-sky-100 pt-3 text-center text-sm font-semibold tabular-nums text-slate-600",
} as const;
