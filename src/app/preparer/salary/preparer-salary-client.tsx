"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPreparerSalaryStats, withdrawPreparerSalary, verifyPreparerSalaryPinCode } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type PendingShift = {
  date: string;
  kind: "morning" | "evening";
  shiftLabel: string;
  walletLabel: string;
  amount: number;
  isToday: boolean;
};

type Props = {
  auth: { p: string; exp: string; s: string };
  preparerName: string;
};

export default function PreparerSalaryClient({ auth, preparerName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<{
    dailySalary: number;
    todaySalary: number;
    accumulatedSalary: number;
    withdrawableSalary: number;
    hasPinCode: boolean;
    pinDisabled: boolean;
    unwithdrawnDays?: Array<{ date: string; morning: boolean; evening: boolean; amount: number; isToday?: boolean }>;
    pendingShifts?: PendingShift[];
    rawAccumulatedSalary?: number;
    alreadyWithdrawnAlf?: number;
  } | null>(null);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");

  const baseQuery = new URLSearchParams();
  baseQuery.set("p", auth.p);
  if (auth.exp) baseQuery.set("exp", auth.exp);
  baseQuery.set("s", auth.s);

  const loadStats = () => {
    const fd = new FormData();
    fd.set("p", auth.p);
    fd.set("exp", auth.exp);
    fd.set("s", auth.s);

    getPreparerSalaryStats(null, fd)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
        } else {
          const hasPin = !!res.hasPinCode;
          const pinDis = !!res.pinDisabled;
          const withdrawable = res.withdrawableSalary || 0;
          setStats({
            dailySalary: res.dailySalary || 0,
            todaySalary: res.todaySalary || 0,
            accumulatedSalary: res.accumulatedSalary || 0,
            withdrawableSalary: withdrawable,
            hasPinCode: hasPin,
            pinDisabled: pinDis,
            unwithdrawnDays: res.unwithdrawnDays || [],
            pendingShifts: (res.pendingShifts || []) as PendingShift[],
            rawAccumulatedSalary: res.rawAccumulatedSalary || 0,
            alreadyWithdrawnAlf: res.alreadyWithdrawnAlf || 0
          });

          if (!hasPin || pinDis) {
            setIsUnlocked(true);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("فشل جلب بيانات الراتب.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStats();
  }, [auth]);

  const handleVerifyUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      toast.error("يرجى إدخال الرمز السري.");
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.set("p", auth.p);
    fd.set("exp", auth.exp);
    fd.set("s", auth.s);
    fd.set("pinCode", pin);

    const res = await verifyPreparerSalaryPinCode(null, fd);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      setIsUnlocked(true);
      toast.success("تم فتح صفحة الراتب بنجاح!");
    }
  };

  const runWithdraw = async (shift?: PendingShift) => {
    setSubmitting(true);
    const fd = new FormData();
    fd.set("p", auth.p);
    fd.set("exp", auth.exp);
    fd.set("s", auth.s);
    fd.set("pinCode", pin);
    if (shift) {
      fd.set("shiftDate", shift.date);
      fd.set("shiftKind", shift.kind);
    }

    const res = await withdrawPreparerSalary(null, fd);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    const labels = res.withdrawnLabels?.join(" و ") || "الراتب";
    toast.success(`تم تسجيل أعطيت ${res.withdrawnAmount} الف في المحفظة (${labels})`);
    router.refresh();
    window.location.href = `/preparer?${baseQuery.toString()}`;
  };

  if (loading) {
    return (
      <div className="kse-app-bg min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-100" dir="rtl">
        <div className="w-full max-w-md rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800 p-8 text-center shadow-2xl">
          <div className="relative size-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-sky-500/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm font-black text-slate-650 dark:text-slate-300">جارٍ جلب تفاصيل الراتب…</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked && stats?.hasPinCode && !stats?.pinDisabled) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-855 dark:text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[2.5rem] bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 size-48 rounded-full bg-indigo-500/10 blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 size-48 rounded-full bg-purple-500/10 blur-3xl"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-550/10 text-3xl mx-auto">
              🔒
            </div>
            
            <div>
              <h2 className="text-xl font-black bg-gradient-to-l from-indigo-600 to-sky-550 dark:from-[#00f3ff] dark:to-cyan-400 bg-clip-text text-transparent">صفحة الراتب محمية</h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">الرجاء كتابة رمز الأمان السري الخاص بك للمتابعة</p>
            </div>

            <form onSubmit={handleVerifyUnlock} className="space-y-4">
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="h-14 w-full rounded-2xl border-2 border-sky-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-center font-black text-xl tracking-[0.25em] outline-none focus:border-indigo-500 dark:focus:border-[#00f3ff] transition-all text-slate-850 dark:text-white"
                placeholder="أدخل الرمز السري"
                autoFocus
              />

              <div className="flex gap-3 pt-2">
                <Link
                  href={`/preparer?${baseQuery.toString()}`}
                  className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-xl flex items-center justify-center transition"
                >
                  إلغاء
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] h-12 bg-gradient-to-l from-indigo-650/10 to-sky-500 bg-indigo-600 hover:from-indigo-700 hover:to-sky-600 text-white font-black rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
                >
                  {submitting ? "جاري التحقق..." : "فتح الصفحة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const pendingShifts = stats?.pendingShifts || [];
  const halfSalary = (stats?.dailySalary || 0) / 2;

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-855 dark:text-slate-100">
      <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6 pb-24">
        
        <header className="kse-glass-dark mb-8 flex items-center gap-4 border border-sky-200/40 dark:border-sky-800/20 px-4 py-4 shadow-xl rounded-[2rem] backdrop-blur-md">
          <Link
            href={`/preparer?${baseQuery.toString()}`}
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all shadow-sm"
            title="رجوع"
          >
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black bg-gradient-to-l from-sky-600 to-indigo-500 dark:from-[#00f3ff] dark:to-cyan-400 bg-clip-text text-transparent">استلام راتب الشفت</h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">المجهز: {preparerName}</p>
          </div>
        </header>

        <section className="relative overflow-hidden mb-6 rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-indigo-950 p-8 text-white shadow-2xl border border-sky-500/20">
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-sky-500/20 blur-3xl"></div>
          <div className="absolute -left-16 -bottom-16 size-48 rounded-full bg-purple-500/20 blur-3xl"></div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="text-sm font-black text-sky-400 tracking-wider mb-2">المتوفر للاستلام الآن</span>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-black bg-gradient-to-l from-white to-sky-100 bg-clip-text text-transparent tracking-tight tabular-nums">
                {stats?.withdrawableSalary}
              </span>
              <span className="text-lg font-black text-sky-300">الف دينار</span>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-md border-t border-white/10 pt-6">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <span className="block text-[10px] font-bold text-slate-400 mb-1">الراتب اليومي الكامل</span>
                <span className="text-lg font-black tabular-nums">{stats?.dailySalary} <span className="text-xs">الف</span></span>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <span className="block text-[10px] font-bold text-slate-400 mb-1">قيمة الشفت الواحد</span>
                <span className="text-lg font-black tabular-nums text-emerald-300">{halfSalary} <span className="text-xs">الف</span></span>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40 p-4 text-right">
          <p className="text-xs font-bold text-sky-800 dark:text-sky-200 leading-relaxed">
            الراتب على شفتين: صبح ونص · عصر ونص. بعد تسجيل الحضور ينحسب الشفت فوراً. عند الضغط على الزر أدناه يتنزل للمحفظة كـ «أعطيت» مع كتابة راتب الصبح أو راتب العصر.
          </p>
        </div>

        <div className="kse-glass-dark border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-lg space-y-4">
          {pendingShifts.length === 0 ? (
            <div className="py-8 text-center">
              <div className="size-16 rounded-full bg-amber-500/10 flex items-center justify-center text-3xl mx-auto mb-4">⏳</div>
              <p className="text-base font-black text-amber-600 dark:text-amber-400">لا يوجد راتب جاهز للاستلام</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                اضغط أولاً على زر تسجيل الحضور في وقت الشفت (الصبح أو العصر) حتى ينحسب لك نصف الراتب، ثم ارجع هنا لاستلامه.
              </p>
            </div>
          ) : (
            <>
              {pendingShifts.map((shift) => (
                <button
                  key={`${shift.date}_${shift.kind}`}
                  type="button"
                  disabled={submitting}
                  onClick={() => runWithdraw(shift)}
                  className="w-full rounded-3xl border border-emerald-200/70 dark:border-emerald-800/50 bg-gradient-to-l from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white p-5 shadow-xl transition transform active:scale-[0.98] disabled:opacity-50 text-right"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-black">{shift.shiftLabel}</div>
                      <div className="text-[11px] font-semibold text-emerald-100/90 mt-1">
                        {new Date(shift.date).toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                        {shift.isToday ? " · اليوم" : ""}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-50/80 mt-1">يتسجل في المحفظة: أعطيت · {shift.shiftLabel}</div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="text-2xl font-black tabular-nums">{shift.amount}</div>
                      <div className="text-[10px] font-bold text-emerald-100">الف دينار</div>
                    </div>
                  </div>
                </button>
              ))}

              {pendingShifts.length > 1 ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => runWithdraw()}
                  className="w-full h-14 rounded-3xl border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg transition active:scale-95 disabled:opacity-50"
                >
                  {submitting ? "جاري التسجيل..." : `استلام الكل الآن (${stats?.withdrawableSalary} الف)`}
                </button>
              ) : null}
            </>
          )}
        </div>

        {stats?.unwithdrawnDays && stats.unwithdrawnDays.length > 0 && (
          <section className="mt-8 kse-glass-dark border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-lg">
            <h3 className="text-sm font-black text-slate-850 dark:text-slate-200 mb-4 text-right">
              الشفتات المسجّلة وغير المستلمة بعد
            </h3>
            <div className="space-y-3">
              {stats.unwithdrawnDays.map((day) => (
                <div key={day.date} className={`flex items-center justify-between p-3.5 rounded-2xl border ${day.isToday ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/60' : 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/60 dark:border-orange-800/60'}`}>
                  <div className="text-right">
                    <span className={`block text-xs font-bold ${day.isToday ? 'text-emerald-800 dark:text-emerald-300' : 'text-orange-800 dark:text-orange-300'}`}>
                      {new Date(day.date).toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      {day.isToday && " (اليوم)"}
                    </span>
                    <span className="inline-flex gap-2 mt-1">
                      {day.morning && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg leading-none ${day.isToday ? 'bg-emerald-200/60 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-orange-200/60 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200'}`}>
                          راتب الصبح
                        </span>
                      )}
                      {day.evening && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg leading-none ${day.isToday ? 'bg-emerald-200/60 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-orange-200/60 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200'}`}>
                          راتب العصر
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={`text-left font-black ${day.isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    +{day.amount} الف
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
