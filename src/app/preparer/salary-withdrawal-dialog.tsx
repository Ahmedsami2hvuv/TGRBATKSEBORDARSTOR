"use client";

import { useState, useEffect, useRef } from "react";
import { getPreparerSalaryStats, setPreparerSalaryPinCode, withdrawPreparerSalary } from "./actions";
import { toast } from "sonner";

type Props = {
  auth: { p: string; exp: string; s: string };
  preparerName: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function SalaryWithdrawalDialog({ auth, preparerName, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<{ dailySalary: number; todaySalary: number; accumulatedSalary: number; hasPinCode: boolean; pinDisabled: boolean } | null>(null);
  
  // لتعيين الرمز السري لأول مرة
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  
  // لإدخال الرمز السري عند السحب
  const [pin, setPin] = useState("");
  const pinInputRef = useRef<HTMLInputElement>(null);

  const baseQuery = new URLSearchParams();
  baseQuery.set("p", auth.p);
  if (auth.exp) baseQuery.set("exp", auth.exp);
  baseQuery.set("s", auth.s);

  // جلب إحصائيات الراتب عند فتح النافذة
  useEffect(() => {
    const fd = new FormData();
    fd.set("p", auth.p);
    fd.set("exp", auth.exp);
    fd.set("s", auth.s);

    getPreparerSalaryStats(null, fd)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          onClose();
        } else {
          setStats({
            dailySalary: res.dailySalary || 0,
            todaySalary: res.todaySalary || 0,
            accumulatedSalary: res.accumulatedSalary || 0,
            hasPinCode: !!res.hasPinCode,
            pinDisabled: !!res.pinDisabled
          });
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("فشل جلب بيانات الراتب.");
        onClose();
      });
  }, [auth, onClose]);

  // التحقق التلقائي بمجرد اكتمال كتابة الرمز السري
  useEffect(() => {
    if (stats?.hasPinCode && !stats?.pinDisabled && pin.length === 4 && !submitting) {
      handleWithdraw(pin);
    }
  }, [pin, stats]);

  // إعداد الرمز السري لأول مرة
  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      toast.error("الرمز السري يجب أن يتكون من 4 أرقام على الأقل.");
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
      setStats((prev) => prev ? { ...prev, hasPinCode: true } : null);
      // التركيز على حقل الإدخال فوراً بعد التعيين
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  };

  // معالجة طلب سحب الراتب
  const handleWithdraw = async (codeToSubmit: string) => {
    setSubmitting(true);
    const fd = new FormData();
    fd.set("p", auth.p);
    fd.set("exp", auth.exp);
    fd.set("s", auth.s);
    fd.set("pinCode", codeToSubmit);

    const res = await withdrawPreparerSalary(null, fd);
    setSubmitting(false);

    if (res.error) {
      toast.error(res.error);
      setPin(""); // مسح الرمز الخاطئ للمحاولة مجدداً
    } else {
      toast.success("تم تسليم الراتب وإضافة الحركة المالية بنجاح!");
      onSuccess();
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 p-8 text-center shadow-2xl">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm font-black text-slate-600 dark:text-slate-300">جارٍ جلب تفاصيل الراتب والشفتات…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" dir="rtl">
      <div className="w-full max-w-md rounded-[2.5rem] bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
        
        {/* تصميم زجاجي ومشرق في الخلفية */}
        <div className="absolute -top-24 -left-24 size-48 rounded-full bg-sky-400/20 blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 size-48 rounded-full bg-violet-400/20 blur-3xl"></div>

        {/* زر الإغلاق */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center"
        >
          ✕
        </button>

        <div className="relative z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-3xl mx-auto mb-4">
            💵
          </div>

          <h3 className="text-xl font-black text-slate-900 dark:text-[#00f3ff]">
            استلام راتب المجهز
          </h3>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
            المجهز: {preparerName}
          </p>

          {/* لوحة تفاصيل الراتب */}
          <div className="my-6 grid grid-cols-2 gap-3 bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800">
            <div className="text-right">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">راتب اليوم الحالي</span>
              <span className="text-lg font-black text-slate-800 dark:text-white tabular-nums">
                {stats?.todaySalary} <span className="text-xs font-bold text-slate-400">الف</span>
              </span>
            </div>
            <div className="text-left border-r border-slate-200/60 dark:border-slate-800/60 pr-4">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">الراتب المتراكم</span>
              <span className="text-xl font-black text-sky-600 dark:text-[#00f3ff] tabular-nums">
                {stats?.accumulatedSalary} <span className="text-xs font-bold text-slate-400">الف</span>
              </span>
            </div>
          </div>

          {/* حالة تصفير أو عدم توفر راتب */}
          {stats?.accumulatedSalary === 0 ? (
            <div className="py-4">
              <p className="text-sm font-black text-amber-600 dark:text-amber-400">⚠️ لا يوجد راتب متراكم للاستلام حالياً.</p>
              <p className="text-xs font-bold text-slate-400 mt-1">يجب حضور شفتات العمل (الصباحية أو المسائية) وحفظ العمليات لتجميع الراتب.</p>
            </div>
          ) : (
            <>
              {stats?.pinDisabled ? (
                /* الاستلام المباشر بدون رمز سري */
                <div className="space-y-4">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    الرمز السري موقوف حالياً. يمكنك استلام الراتب مباشرة.
                  </p>
                  <button
                    onClick={() => handleWithdraw("")}
                    disabled={submitting}
                    className="w-full h-14 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-3xl shadow-lg shadow-sky-100 dark:shadow-none transition active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? "جاري تسليم الراتب..." : "تأكيد استلام الراتب المباشر"}
                  </button>
                </div>
              ) : !stats?.hasPinCode ? (
                <form onSubmit={handleSetupPin} className="space-y-4">
                  <div className="text-right bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-2xl p-3 text-xs font-bold text-amber-800 dark:text-amber-300">
                    أهلاً ({preparerName})، عين رمزاً لاستلام راتبك لأول مرة.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-right">
                      <span className="text-[10px] font-black text-slate-400 mr-2">الرمز الجديد (4 أرقام)</span>
                      <input
                        type="password"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                        className="h-12 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 px-4 text-center font-black text-lg outline-none focus:border-sky-500"
                        placeholder="••••"
                      />
                    </label>
                    <label className="block text-right">
                      <span className="text-[10px] font-black text-slate-400 mr-2">تأكيد الرمز السري</span>
                      <input
                        type="password"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        maxLength={4}
                        required
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
                        className="h-12 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 px-4 text-center font-black text-lg outline-none focus:border-sky-500"
                        placeholder="••••"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-2xl shadow-lg shadow-sky-100 transition active:scale-98 disabled:opacity-50"
                  >
                    {submitting ? "جاري الحفظ والتعيين..." : "حفظ وتثبيت الرمز"}
                  </button>
                </form>
              ) : (
                /* كتابة الرمز السري واستلام الراتب تلقائياً */
                <div className="space-y-4">
                  <p className="text-sm font-black text-slate-650 dark:text-slate-350">
                    أدخل الرمز السري لتأكيد الاستلام فوراً
                  </p>
                  
                  <div className="max-w-[200px] mx-auto relative">
                    <input
                      ref={pinInputRef}
                      type="password"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      disabled={submitting}
                      className="h-14 w-full rounded-2xl border-2 border-sky-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-6 text-center font-black text-2xl tracking-[0.75em] outline-none focus:border-sky-500 focus:bg-white transition"
                      placeholder="••••"
                      autoFocus
                    />
                  </div>

                  {submitting && (
                    <p className="text-xs font-black text-amber-600 animate-pulse">
                      جارٍ التحقق من الرمز وتنفيذ معاملة الاستلام…
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
