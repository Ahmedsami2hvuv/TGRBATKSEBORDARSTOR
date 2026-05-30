/**
 * لوحة الإدارة — الهوية البصرية الجديدة "Tech/Clean"
 * Slate-900, Indigo-600, Sky-600
 */
export const ad = {
  h1: "text-2xl font-black tracking-tight text-slate-900 sm:text-3xl",
  h2: "text-lg font-bold text-indigo-900",
  h3: "text-base font-bold text-slate-800",
  lead: "text-sm font-medium text-slate-600",
  muted: "text-sm text-slate-500",
  link: "font-bold text-indigo-600 hover:text-indigo-700 transition-colors",
  navButton: "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600",
  section:
    "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6",
  input:
    "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all",
  select:
    "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer",
  label: "text-[11px] font-black text-slate-500 uppercase tracking-wider pr-1 mb-1.5 block",
  warn: "text-sm font-bold text-amber-600",
  success: "text-sm font-bold text-emerald-600",
  error: "text-sm font-bold text-rose-600",
  listDivide: "divide-y divide-slate-100",
  listTitle: "font-bold text-slate-900",
  listMuted: "text-sm text-slate-500",
  btnPrimary:
    "rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2",
  btnDark:
    "rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-200 transition-all hover:bg-black hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2",
  btnSecondary:
    "rounded-2xl border-2 border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2",
  btnDanger:
    "rounded-2xl border-2 border-rose-100 bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 transition-all hover:bg-rose-100 hover:border-rose-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2",
  dangerLink: "text-sm font-bold text-rose-600 hover:text-rose-700 underline underline-offset-4",
  /** أسفل جداول الطلبات — عدد الصفوف المعروضة */
  orderListCountFooter:
    "mt-4 border-t border-slate-100 pt-4 text-center text-xs font-black tabular-nums text-slate-400 uppercase tracking-widest",
  badge: "px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums",
  card: "rounded-3xl border border-slate-200 bg-white transition-all duration-300",
  overlay: "bg-indigo-500/10",
} as const;

