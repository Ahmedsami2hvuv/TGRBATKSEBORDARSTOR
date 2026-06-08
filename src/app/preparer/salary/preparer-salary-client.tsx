"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPreparerSalaryStats, setPreparerSalaryPinCode, withdrawPreparerSalary, verifyPreparerSalaryPinCode } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
    isBeforeEightPM: boolean;
    hasPinCode: boolean;
    pinDisabled: boolean;
  } | null>(null);

  // حالة إلغاء قفل الصفحة
  const [isUnlocked, setIsUnlocked] = useState(false);

  // لتعيين الرمز السري لأول مرة
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");

  // لإدخال الرمز السري عند الدخول والسحب
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
          
          setStats({
            dailySalary: res.dailySalary || 0,
            todaySalary: res.todaySalary || 0,
            accumulatedSalary: res.accumulatedSalary || 0,
            withdrawableSalary: res.withdrawableSalary || 0,
            isBeforeEightPM: !!res.isBeforeEightPM,
            hasPinCode: hasPin,
            pinDisabled: pinDis
          });

          // إذا لم يكن هناك رمز سري أصلاً، أو إذا كان الرمز موقفاً، نفتح الصفحة مباشرة
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

  // التحقق من الرمز لفتح قفل الصفحة
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

  // إعداد الرمز السري لأول مرة
  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim()) {
      toast.error("الرمز السري لا يمكن أن يكون فارغاً.");
      return;
    }
    if (newPin !== confirmNewPin) {
      toast.error("الرموز السرية غير متطابقة.");
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.set("p", auth.p);
    fd.set("exp", auth.exp);
    fd.set("s", auth.s);
    fd.set("pinCode", newPin);

    const res = await setPreparerSalaryPinCode(null, fd);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("تم تعيين الرمز السري بنجاح!");
      loadStats();
    }
  };

  // معالجة طلب سحب الراتب الفعلي
  const handleWithdraw = async () => {
    setSubmitting(true);
    const fd = new FormData();
    fd.set("p", auth.p);
    fd.set("exp", auth.exp);
    fd.set("s", auth.s);
    fd.set("pinCode", pin); // نمرر الرمز الذي تم استخدامه لفتح القفل (أو فارغ إذا كان معطلاً)

    const res = await withdrawPreparerSalary(null, fd);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("تم استلام الراتب وإضافته للمحفظة بنجاح!");
      router.push(`/preparer?${baseQuery.toString()}`);
    }
  };

  if (loading) {
    return (
      <div className="kse-app-bg min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-100" dir="rtl">
        <div className="w-full max-w-md rounded-3xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800 p-8 text-center shadow-2xl">
          <div className="relative size-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-sky-500/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm font-black text-slate-650 dark:text-slate-300">جارٍ جلب تفاصيل الراتب الفخمة…</p>
        </div>
      </div>
    );
  }

  // إذا كانت الصفحة مقفلة ويوجد رمز سري مفعل، نعرض شاشة التحقق الفخمة أولاً
  if (!isUnlocked && stats?.hasPinCode && !stats?.pinDisabled) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-850 dark:text-slate-100 flex items-center justify-center p-4">
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

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-855 dark:text-slate-100">
      <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6 pb-24">
        
        {/* Header */}
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
            <h1 className="text-xl font-black bg-gradient-to-l from-sky-600 to-indigo-500 dark:from-[#00f3ff] dark:to-cyan-400 bg-clip-text text-transparent">بوابة استلام الراتب</h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">المجهز الفني: {preparerName}</p>
          </div>
        </header>

        {/* كارد الرصيد المالي الفاخر */}
        <section className="relative overflow-hidden mb-8 rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-indigo-950 p-8 text-white shadow-2xl border border-sky-500/20">
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-sky-500/20 blur-3xl"></div>
          <div className="absolute -left-16 -bottom-16 size-48 rounded-full bg-purple-500/20 blur-3xl"></div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <span className="text-sm font-black text-sky-400 tracking-wider mb-2">الراتب المتاح للسحب</span>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-black bg-gradient-to-l from-white to-sky-100 bg-clip-text text-transparent tracking-tight tabular-nums">
                {stats?.withdrawableSalary}
              </span>
              <span className="text-lg font-black text-sky-300">الف دينار</span>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md border-t border-white/10 pt-6 mt-2">
              <div className="text-right">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">راتب اليوم الحالي</span>
                <span className="text-lg font-black text-white tabular-nums">
                  {stats?.todaySalary} <span className="text-xs text-slate-450 font-bold">الف</span>
                </span>
              </div>
              <div className="text-left border-r border-white/10 pr-4">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">المتراكم الكلي للعمل</span>
                <span className="text-lg font-black text-sky-200 tabular-nums">
                  {stats?.accumulatedSalary} <span className="text-xs text-slate-450 font-bold">الف</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* التنبيهات وقسم السحب */}
        <div className="kse-glass-dark border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-lg">
          
          {stats?.isBeforeEightPM && stats.todaySalary > 0 && (
            <div className="mb-6 flex gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black p-4 rounded-2xl text-right leading-relaxed">
              <span className="text-lg leading-none">⏳</span>
              <div>
                <p className="font-black text-sm mb-0.5">قيد توقيت السحب نشط</p>
                <p className="font-medium text-slate-500 dark:text-slate-400">راتب اليوم الحالي سيتاح للسحب بعد الساعة 8 مساءً لتتمكن من استلام المستحقات بالكامل.</p>
              </div>
            </div>
          )}

          {stats?.withdrawableSalary === 0 ? (
            <div className="py-8 text-center">
              <div className="size-16 rounded-full bg-amber-500/10 flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
              <p className="text-base font-black text-amber-600 dark:text-amber-400">لا يوجد راتب متاح للسحب حالياً</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                {stats?.isBeforeEightPM && stats?.todaySalary > 0 
                  ? "سيصبح راتب اليوم الحالي متاحاً للسحب فوراً بمجرد تجاوز الساعة 8 مساءً بتوقيت العراق."
                  : "يرجى إتمام شفتات العمل الإضافية وحفظ عمليات الإسناد أو التسعير لتراكم الراتب."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* أول استخدام: تعيين رمز سري لأول مرة */}
              {!stats?.hasPinCode ? (
                <form onSubmit={handleSetupPin} className="space-y-4">
                  <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 text-xs font-bold text-sky-700 dark:text-sky-400 text-right leading-relaxed">
                    ✨ أهلاً بك في بوابة استلام الراتب! يرجى تعيين رمز الأمان الخاص بك لأول مرة لتأكيد عمليات السحب المستقبلية. 
                    <span className="block mt-1 font-semibold text-slate-500 dark:text-slate-400">يمكنك كتابة أي رمز تفضله (أحرف، أرقام، عربي، إنجليزي، حرف واحد أو أكثر).</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-right mb-1.5 text-xs font-black text-slate-500 dark:text-slate-400 mr-1">أدخل الرمز السري الجديد</label>
                      <input
                        type="text"
                        required
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-center font-black text-lg outline-none focus:border-sky-500 dark:focus:border-[#00f3ff] transition-all text-slate-850 dark:text-white"
                        placeholder="اكتب رمزك هنا (مثال: 1234 أو A)"
                      />
                    </div>

                    <div>
                      <label className="block text-right mb-1.5 text-xs font-black text-slate-500 dark:text-slate-400 mr-1">تأكيد الرمز السري</label>
                      <input
                        type="text"
                        required
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-center font-black text-lg outline-none focus:border-sky-500 dark:focus:border-[#00f3ff] transition-all text-slate-850 dark:text-white"
                        placeholder="أعد كتابة الرمز للتأكيد"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-14 bg-gradient-to-l from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black rounded-2xl shadow-lg transition transform active:scale-98 disabled:opacity-50 mt-2"
                  >
                    {submitting ? "جاري الحفظ..." : "حفظ وتثبيت الرمز السري"}
                  </button>
                </form>
              ) : (
                /* الاستلام المباشر حيث تم التحقق من الرمز بالفعل في Lock Screen */
                <div className="text-center py-4 space-y-6">
                  {stats?.pinDisabled && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-black p-4 rounded-2xl text-right leading-relaxed">
                      🔓 ميزة الرمز السري معطلة حالياً بناءً على إعداداتك. سيتم السحب مباشرة دون طلب الرمز.
                    </div>
                  )}

                  <button
                    onClick={handleWithdraw}
                    disabled={submitting}
                    className="w-full h-16 bg-gradient-to-l from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-base rounded-3xl shadow-xl transition transform active:scale-95 disabled:opacity-50 animate-pulse-slow"
                  >
                    {submitting ? "جاري تحويل الراتب للمحفظة..." : "تأكيد استلام الراتب فوراً"}
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
