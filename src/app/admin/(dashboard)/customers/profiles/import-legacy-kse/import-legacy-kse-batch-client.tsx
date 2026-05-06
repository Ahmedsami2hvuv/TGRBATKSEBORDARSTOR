"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import {
  runLegacyKseOrderDetailsBatchImport,
  getLegacyKseImportRangeStats,
  type LegacyKseBatchImportRow,
  type LegacyKseRangeStats,
} from "../actions";

const LEGACY_COOKIE_SESSION_KEY = "kse_legacy_order_cookie_v1";
const CURSOR_STORAGE_KEY = "legacy_kse_import_next_id";

function statusUi(status: LegacyKseBatchImportRow["status"]): {
  label: string;
  className: string;
  fallbackDetail: string;
} {
  switch (status) {
    case "imported":
      return {
        label: "تمت الإضافة",
        className: "text-emerald-600",
        fallbackDetail: "الزبون كان غير موجود وتمت إضافته.",
      };
    case "photo_updated":
      return {
        label: "تم تحديث الصورة",
        className: "text-teal-600",
        fallbackDetail: "الزبون موجود سابقاً وتمت إضافة صورة الباب الناقصة.",
      };
    case "already_in_db":
      return {
        label: "موجود مسبقاً",
        className: "text-sky-600",
        fallbackDetail: "الزبون موجود مسبقاً، وتم التعامل مع النواقص إن وُجدت.",
      };
    case "cached":
      return {
        label: "موجود في السجل",
        className: "text-indigo-600",
        fallbackDetail: "هذا الطلب تمت معالجته سابقاً وفق السجل.",
      };
    case "skipped":
      return {
        label: "تم التخطي",
        className: "text-amber-600",
        fallbackDetail: "تم تخطي هذا الطلب بسبب عدم توفر بيانات كافية.",
      };
    case "error":
      return {
        label: "خطأ",
        className: "text-rose-600",
        fallbackDetail: "حدث خطأ أثناء معالجة هذا الطلب.",
      };
    default:
      return {
        label: status,
        className: "text-slate-600",
        fallbackDetail: "تمت معالجة الطلب.",
      };
  }
}

type ImportLegacyKseBatchClientProps = {
  onClose?: () => void;
};

export function ImportLegacyKseBatchClient({ onClose }: ImportLegacyKseBatchClientProps) {
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(16443);
  const [batchSize, setBatchSize] = useState(10);
  const [delayMs, setDelayMs] = useState(400);
  const [nextId, setNextId] = useState(1);
  const [cookieOverride, setCookieOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LegacyKseBatchImportRow[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [stats, setStats] = useState<LegacyKseRangeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showCookieInput, setShowCookieInput] = useState(false);
  const [cookieEditMode, setCookieEditMode] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    active: boolean;
    total: number;
    done: number;
    currentOrderId: number | null;
    imported: number;
    photoUpdated: number;
    alreadyInDb: number;
    cached: number;
    skipped: number;
    failed: number;
  }>({
    active: false,
    total: 0,
    done: 0,
    currentOrderId: null,
    imported: 0,
    photoUpdated: 0,
    alreadyInDb: 0,
    cached: 0,
    skipped: 0,
    failed: 0,
  });
  const cookieAutoSavedRef = useRef(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const start = Math.min(rangeStart, rangeEnd);
      const end = Math.max(rangeStart, rangeEnd);
      const r = await getLegacyKseImportRangeStats({ rangeStart: start, rangeEnd: end });
      if (r.ok) setStats(r.stats);
      else setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(CURSOR_STORAGE_KEY);
      if (s) {
        const n = parseInt(s, 10);
        if (Number.isFinite(n) && n > 0) setNextId(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const hasSessionCookie = !!sessionStorage.getItem(LEGACY_COOKIE_SESSION_KEY)?.trim();
      setShowCookieInput(!hasSessionCookie);
    } catch {
      setShowCookieInput(true);
    }
  }, []);

  const effectiveCookie = useMemo(() => {
    const o = cookieOverride.trim();
    if (o) return o;
    try {
      return sessionStorage.getItem(LEGACY_COOKIE_SESSION_KEY)?.trim() ?? "";
    } catch {
      return "";
    }
  }, [cookieOverride]);

  useEffect(() => {
    const e = (lastError ?? "").toLowerCase();
    if (
      e.includes("cookie") ||
      e.includes("انتهت الجلسة") ||
      e.includes("ردّ برمز 401") ||
      e.includes("ردّ برمز 403")
    ) {
      setShowCookieInput(true);
    }
  }, [lastError]);

  const saveCookieForSession = () => {
    const t = cookieOverride.trim();
    if (!t) return;
    try {
      sessionStorage.setItem(LEGACY_COOKIE_SESSION_KEY, t);
      setCookieEditMode(false);
      setShowCookieInput(false);
      setLastError(null);
    } catch {
      setLastError("المتصفح يمنع التخزين المحلي للكوكي.");
    }
  };

  useEffect(() => {
    const t = cookieOverride.trim();
    if (!showCookieInput || !t || cookieEditMode) {
      cookieAutoSavedRef.current = false;
      return;
    }
    if (cookieAutoSavedRef.current) return;
    try {
      sessionStorage.setItem(LEGACY_COOKIE_SESSION_KEY, t);
      cookieAutoSavedRef.current = true;
      setCookieEditMode(false);
      setShowCookieInput(false);
      setLastError(null);
    } catch {
      setLastError("المتصفح يمنع التخزين المحلي للكوكي.");
    }
  }, [cookieOverride, showCookieInput, cookieEditMode]);

  const runBatch = useCallback(async (): Promise<"ok" | "done" | "blocked" | "failed"> => {
    setLastError(null);
    const start = Math.min(rangeStart, rangeEnd);
    const end = Math.max(rangeStart, rangeEnd);
    const size = Math.min(25, Math.max(1, Math.floor(batchSize)));
    const from = Math.max(start, Math.min(nextId, end));
    if (from > end) {
      setLastError("اكتمل النطاق — غيّر المؤشر أو النطاق.");
      return "done";
    }
    const to = Math.min(end, from + size - 1);
    const orderIds: number[] = [];
    for (let id = from; id <= to; id++) orderIds.push(id);

    if (!effectiveCookie) {
      setCookieEditMode(false);
      setShowCookieInput(true);
      setLastError(
        "لا يوجد Cookie. احفظ الكوكي من صفحة «إضافة زبون مرجعي» أو الصقه في المربع أدناه.",
      );
      return "blocked";
    }

    setBusy(true);
    setLog([]);
    setBatchProgress({
      active: true,
      total: orderIds.length,
      done: 0,
      currentOrderId: null,
      imported: 0,
      photoUpdated: 0,
      alreadyInDb: 0,
      cached: 0,
      skipped: 0,
      failed: 0,
    });
    try {
      const rowsAcc: LegacyKseBatchImportRow[] = [];
      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i]!;
        setBatchProgress((p) => ({ ...p, currentOrderId: orderId }));
        const r = await runLegacyKseOrderDetailsBatchImport({
          orderIds: [orderId],
          legacyCookie: effectiveCookie,
          delayMs: 0,
        });
        if (!r.ok) {
          const errRow: LegacyKseBatchImportRow = {
            orderId,
            status: "error",
            detail: r.error,
          };
          rowsAcc.push(errRow);
          setLog([...rowsAcc]);
          setLastError(`تعذر جلب الطلب #${orderId}: ${r.error} — تم التجاوز والاستمرار.`);
          setBatchProgress((p) => ({
            ...p,
            done: p.done + 1,
            failed: p.failed + 1,
          }));
          if (i < orderIds.length - 1 && delayMs > 0) {
            await new Promise((res) => setTimeout(res, delayMs));
          }
          continue;
        }
        const row = r.rows[0];
        if (row) {
          rowsAcc.push(row);
          setLog([...rowsAcc]);
          setBatchProgress((p) => ({
            ...p,
            done: p.done + 1,
            imported: p.imported + (row.status === "imported" ? 1 : 0),
            photoUpdated: p.photoUpdated + (row.status === "photo_updated" ? 1 : 0),
            alreadyInDb: p.alreadyInDb + (row.status === "already_in_db" ? 1 : 0),
            cached: p.cached + (row.status === "cached" ? 1 : 0),
            skipped: p.skipped + (row.status === "skipped" ? 1 : 0),
            failed: p.failed + (row.status === "error" ? 1 : 0),
          }));
        }
        if (i < orderIds.length - 1 && delayMs > 0) {
          await new Promise((res) => setTimeout(res, delayMs));
        }
      }
      if (effectiveCookie) setShowCookieInput(false);
      const advanced = to + 1;
      setNextId(advanced);
      try {
        localStorage.setItem(CURSOR_STORAGE_KEY, String(advanced));
      } catch {
        /* ignore */
      }
      void loadStats();
      return "ok";
    } finally {
      setBatchProgress((p) => ({ ...p, active: false, currentOrderId: null }));
      setBusy(false);
    }
  }, [rangeStart, rangeEnd, batchSize, delayMs, nextId, effectiveCookie, loadStats]);

  useEffect(() => {
    if (!autoRun || busy) return;
    let cancelled = false;
    (async () => {
      const status = await runBatch();
      if (cancelled) return;
      if (status !== "ok") {
        setAutoRun(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoRun, busy, runBatch]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      if (typeof window !== "undefined") {
        window.history.back();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div className="relative mx-auto max-h-[95vh] w-full max-w-3xl space-y-6 overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900">
        <button
          type="button"
          onClick={handleClose}
          className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          aria-label="إغلاق"
        >
          ×
        </button>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/customers/profiles/new" className={ad.link}>
            ← إضافة زبون (يدوي / رابط واحد)
          </Link>
          <Link href="/admin/customers/profiles/import" className={ad.link}>
            استيراد SQL
          </Link>
        </nav>

        <header className="space-y-2">
        <div className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100">
          <strong>أين الصفحة؟</strong> من القائمة الجانبية للوحة الإدارة اختر{" "}
          <strong>«استيراد زبائن KSE (دفعات)»</strong> — أو الرابط المباشر:{" "}
          <code className="text-xs" dir="ltr">
            /admin/customers/profiles/import-legacy-kse
          </code>
          . تحتاج <strong>Cookie</strong> الموقع القديم (نفسه المستخدم في «إضافة زبون مرجعي»).
        </div>
        <h1 className={ad.h1}>استيراد دفعي — زبائن من طلبات الموقع القديم (KSE)</h1>
        <p className={`${ad.muted} text-sm leading-relaxed`}>
          على عكس <strong>استيراد Railway</strong> (جدول زبائن جاهز في قاعدة البيانات)، على الموقع القديم{" "}
          <strong>كل زبون مرتبط بطلب</strong>: المصدر هو صفحة{" "}
          <code className="text-xs" dir="ltr">
            /dashboard/orders_status/details/&#123;id&#125;
          </code>
          . تُجلب الدفعات بالتتابع لتخفيف الضغط على الخادم القديم.
        </p>
        <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
          <strong>تجديد الكوكي:</strong> إذا انتهت الجلسة، أعد لصق Cookie ثم نفّذ الدفعات كالمعتاد. النظام يقرأ سجلاً في
          قاعدة البيانات لكل رقم طلب: الطلبات التي اكتملت (بروفايل جديد، أو الزبون كان موجوداً مسبقاً من ريلوي، أو
          الصفحة بلا قسم زبون) <strong>لا يُعاد جلبها من الشبكة</strong> — يُكمَل من حيث توقفت دون البدء من الصفر.
          الطلبات التي فشلت لخطأ شبكة/جلسة تُعاد محاولتها تلقائياً عند مرور المؤشر عليها مجدداً.
        </p>
        <p className="rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2 text-xs text-teal-950 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-100">
          <strong>صور الباب الناقصة:</strong> إن وُجد بروفايل بلا صورة باب لكن صفحة الطلب تحتوي رابط صورة باب، يُعاد جلب
          الصفحة تلقائياً حتى لو سُجّل الطلب سابقاً كـ «موجود في النظام». مرّر نفس نطاق الطلبات من جديد لملء الصور
          للزبائن القدامى (مثلاً بعد تحسين استخراج رابط الصورة). جرّب أولاً من «إضافة زبون مرجعي» برابط طلب واحد
          للتأكد من ظهور المعاينة ثم نفّذ الدفعات.
        </p>
      </header>

      {stats ? (
        <section
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-900/60"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black text-slate-800 dark:text-slate-100">
              إحصائية النطاق {stats.rangeStart}–{stats.rangeEnd}
            </h2>
            <button
              type="button"
              onClick={() => void loadStats()}
              disabled={statsLoading}
              className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-bold dark:border-slate-600 dark:bg-slate-800"
            >
              {statsLoading ? "…" : "تحديث"}
            </button>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
            <li className="sm:col-span-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2.5 dark:border-violet-700 dark:bg-violet-950/40">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-black text-violet-950 dark:text-violet-100">
                  عدد الزبائن الفريدين (جوال + منطقة) من الطلبات المُسجَّلة:
                </span>
                <span className="text-lg font-black tabular-nums text-violet-700 dark:text-violet-300">
                  {stats.uniqueCustomersFromLoggedOrders}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] font-normal leading-relaxed text-violet-900/85 dark:text-violet-200/90">
                كل طلبات نفس الزبون تُحسب مرة واحدة. العدد يعتمد على الصفوف التي خُزّن فيها الرقم والمنطقة (بعد نجاح
                تحليل الصفحة). الطلبات غير المجرّبة أو الفاشلة قبل استخراج الرقم لا تدخل هنا — مع تقدم السحب يرتفع
                هذا الرقم ويقارن بـ {stats.totalOrdersInRange} طلباً في النطاق.
              </p>
            </li>
            <li>
              <strong>إجمالي أرقام الطلبات في النطاق:</strong> {stats.totalOrdersInRange}
            </li>
            <li>
              <strong>طلبات جرّبت على الأقل مرة (مسجّلة):</strong> {stats.ordersLogged}
            </li>
            <li className="text-amber-800 dark:text-amber-200">
              <strong>لم يُجرَّب بعد:</strong> {stats.neverAttempted}
            </li>
            <li className="text-emerald-700 dark:text-emerald-300">
              <strong>بروفايل جديد أُضيف من KSE:</strong> {stats.importedNew}
            </li>
            <li className="text-teal-700 dark:text-teal-300">
              <strong>بروفايل كان بلا صورة باب — أُضيفت الصورة من صفحة الطلب:</strong>{" "}
              {stats.profilesPhotoFilled}
            </li>
            <li className="text-sky-800 dark:text-sky-200">
              <strong>تخطّي — الزبون موجود مسبقاً (ريلوي / مكرر طلبات):</strong> {stats.skipAlreadyInDb}
            </li>
            <li>
              <strong>تخطّي — صفحة بلا قسم «معلومات الزبون»:</strong> {stats.skipNoCustomer}
            </li>
            <li className="text-rose-700 dark:text-rose-300">
              <strong>أخطاء قابلة لإعادة المحاولة (جلسة/شبكة/منطقة…):</strong> {stats.errorsRetryable}
            </li>
          </ul>
        </section>
      ) : null}

      <section className={`${ad.section} space-y-4`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold">من رقم طلب</span>
            <input
              type="number"
              min={1}
              value={rangeStart}
              onChange={(e) => setRangeStart(parseInt(e.target.value, 10) || 1)}
              className={`${ad.input} mt-1 w-full`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold">إلى رقم طلب</span>
            <input
              type="number"
              min={1}
              value={rangeEnd}
              onChange={(e) => setRangeEnd(parseInt(e.target.value, 10) || 1)}
              className={`${ad.input} mt-1 w-full`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold">حجم الدفعة (حد أقصى 25)</span>
            <input
              type="number"
              min={1}
              max={25}
              value={batchSize}
              onChange={(e) =>
                setBatchSize(Math.min(25, Math.max(1, parseInt(e.target.value, 10) || 10)))
              }
              className={`${ad.input} mt-1 w-full`}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold">تأخير بين الطلبات (مللي ثانية)</span>
            <input
              type="number"
              min={0}
              max={3000}
              value={delayMs}
              onChange={(e) =>
                setDelayMs(Math.min(3000, Math.max(0, parseInt(e.target.value, 10) || 0)))
              }
              className={`${ad.input} mt-1 w-full`}
            />
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40">
          <p className="text-sm font-bold">المؤشر الحالي (أول طلب في الدفعة التالية)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={nextId}
              onChange={(e) => setNextId(parseInt(e.target.value, 10) || 1)}
              className={`${ad.input} w-32`}
            />
            <button
              type="button"
              onClick={() => {
                setNextId(rangeStart);
                try {
                  localStorage.setItem(CURSOR_STORAGE_KEY, String(rangeStart));
                } catch {
                  /* ignore */
                }
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold dark:border-slate-600 dark:bg-slate-900"
            >
              ضبط المؤشر = بداية النطاق
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            يُحفظ المؤشر في المتصفح لتكملة الاستيراد لاحقاً.
          </p>
        </div>

        {!showCookieInput && effectiveCookie ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">✓ Cookie متوفر لهذه الجلسة</span>
              <button
                type="button"
                onClick={() => {
                  setCookieEditMode(true);
                  setShowCookieInput(true);
                }}
                className="rounded-md border border-emerald-600 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500 dark:bg-slate-900 dark:text-emerald-200"
              >
                تعديل الكوكي
              </button>
            </div>
          </div>
        ) : (
          <label className="block text-sm">
            <span className="font-bold">Cookie (يظهر فقط عند الحاجة)</span>
            <textarea
              value={cookieOverride}
              onChange={(e) => setCookieOverride(e.target.value)}
              rows={2}
              dir="ltr"
              placeholder="الصق Cookie — تُحفظ تلقائياً وتختفي الخانة مباشرة"
              className={`${ad.input} mt-1 w-full font-mono text-xs`}
              spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveCookieForSession}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700"
              >
                حفظ الكوكي للجلسة
              </button>
              {cookieEditMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setCookieEditMode(false);
                    setShowCookieInput(false);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold dark:border-slate-600 dark:bg-slate-900"
                >
                  إلغاء
                </button>
              ) : null}
              {effectiveCookie ? (
                <button
                  type="button"
                  onClick={() => {
                    setCookieEditMode(false);
                    setShowCookieInput(false);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold dark:border-slate-600 dark:bg-slate-900"
                >
                  إخفاء
                </button>
              ) : null}
            </div>
          </label>
        )}

        {lastError ? <p className={ad.error}>{lastError}</p> : null}

        {(batchProgress.active || batchProgress.done > 0) && batchProgress.total > 0 ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-indigo-900 dark:text-indigo-100">
                تقدم الدفعة: {batchProgress.done}/{batchProgress.total}
              </span>
              <span className="font-mono text-indigo-700 dark:text-indigo-300">
                {Math.round((batchProgress.done / batchProgress.total) * 100)}%
                {batchProgress.currentOrderId ? ` — الآن: #${batchProgress.currentOrderId}` : ""}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/50">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, (batchProgress.done / batchProgress.total) * 100))}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-3">
              <span className="text-emerald-700 dark:text-emerald-300">جديد: {batchProgress.imported}</span>
              <span className="text-teal-700 dark:text-teal-300">صورة أضيفت: {batchProgress.photoUpdated}</span>
              <span className="text-sky-700 dark:text-sky-300">موجود مسبقاً: {batchProgress.alreadyInDb}</span>
              <span className="text-indigo-700 dark:text-indigo-300">مخزّن/كاش: {batchProgress.cached}</span>
              <span className="text-amber-700 dark:text-amber-300">تخطي: {batchProgress.skipped}</span>
              <span className="text-rose-700 dark:text-rose-300">أخطاء: {batchProgress.failed}</span>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy || autoRun}
            onClick={() => void runBatch()}
            className={`${ad.btnPrimary} w-full py-3 text-base sm:flex-1`}
          >
            {busy && !autoRun ? "جارٍ معالجة الدفعة…" : "تشغيل الدفعة التالية"}
          </button>
          {!autoRun ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setAutoRun(true)}
              className="w-full rounded-lg bg-emerald-600 py-3 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto sm:px-5"
            >
              بدء السحب التلقائي
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAutoRun(false)}
              className="w-full rounded-lg bg-rose-600 py-3 text-base font-black text-white hover:bg-rose-700 sm:w-auto sm:px-5"
            >
              إيقاف السحب
            </button>
          )}
        </div>
        {autoRun ? (
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
            السحب التلقائي يعمل الآن: بعد كل دفعة ينتقل تلقائياً للدفعة التالية حتى نهاية النطاق أو ظهور خطأ.
          </p>
        ) : null}
      </section>

      {log.length > 0 ? (
        <section className="rounded-xl border border-slate-200 p-4 text-base dark:border-slate-600">
          <h2 className="mb-3 text-base font-black">نتيجة آخر دفعة</h2>
          <ul className="max-h-72 space-y-2 overflow-y-auto text-sm" dir="ltr">
            {log.map((row) => {
              const ui = statusUi(row.status);
              return (
                <li
                  key={row.orderId}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <span className="font-mono font-bold">#{row.orderId}</span>{" "}
                  <span className={`${ui.className} font-bold`}>{ui.label}</span>
                  {row.detail || ui.fallbackDetail ? (
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                      {row.detail || ui.fallbackDetail}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      </div>
    </div>
  );
}
