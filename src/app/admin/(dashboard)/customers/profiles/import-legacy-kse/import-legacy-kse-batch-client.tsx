"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export function ImportLegacyKseBatchClient() {
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

  const effectiveCookie = useMemo(() => {
    const o = cookieOverride.trim();
    if (o) return o;
    try {
      return sessionStorage.getItem(LEGACY_COOKIE_SESSION_KEY)?.trim() ?? "";
    } catch {
      return "";
    }
  }, [cookieOverride]);

  const runBatch = useCallback(async () => {
    setLastError(null);
    const start = Math.min(rangeStart, rangeEnd);
    const end = Math.max(rangeStart, rangeEnd);
    const size = Math.min(15, Math.max(1, Math.floor(batchSize)));
    const from = Math.max(start, Math.min(nextId, end));
    if (from > end) {
      setLastError("اكتمل النطاق — غيّر المؤشر أو النطاق.");
      return;
    }
    const to = Math.min(end, from + size - 1);
    const orderIds: number[] = [];
    for (let id = from; id <= to; id++) orderIds.push(id);

    if (!effectiveCookie) {
      setLastError(
        "لا يوجد Cookie. احفظ الكوكي من صفحة «إضافة زبون مرجعي» أو الصقه في المربع أدناه.",
      );
      return;
    }

    setBusy(true);
    setLog([]);
    try {
      const r = await runLegacyKseOrderDetailsBatchImport({
        orderIds,
        legacyCookie: effectiveCookie,
        delayMs,
      });
      if (!r.ok) {
        setLastError(r.error);
        return;
      }
      setLog(r.rows);
      const advanced = to + 1;
      setNextId(advanced);
      try {
        localStorage.setItem(CURSOR_STORAGE_KEY, String(advanced));
      } catch {
        /* ignore */
      }
      void loadStats();
    } finally {
      setBusy(false);
    }
  }, [rangeStart, rangeEnd, batchSize, delayMs, nextId, effectiveCookie, loadStats]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <nav className="text-sm flex flex-wrap gap-3">
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
            <span className="font-bold">حجم الدفعة (حد أقصى 15)</span>
            <input
              type="number"
              min={1}
              max={15}
              value={batchSize}
              onChange={(e) =>
                setBatchSize(Math.min(15, Math.max(1, parseInt(e.target.value, 10) || 10)))
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

        <label className="block text-sm">
          <span className="font-bold">Cookie (اختياري إن وُجد محفوظ من صفحة إضافة الزبون)</span>
          <textarea
            value={cookieOverride}
            onChange={(e) => setCookieOverride(e.target.value)}
            rows={2}
            dir="ltr"
            placeholder="اتركه فارغاً لاستخدام الجلسة المحفوظة، أو الصق Cookie هنا"
            className={`${ad.input} mt-1 w-full font-mono text-xs`}
            spellCheck={false}
          />
        </label>

        {lastError ? <p className={ad.error}>{lastError}</p> : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void runBatch()}
          className={`${ad.btnPrimary} w-full py-3 text-base`}
        >
          {busy ? "جارٍ معالجة الدفعة…" : "تشغيل الدفعة التالية"}
        </button>
      </section>

      {log.length > 0 ? (
        <section className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-600">
          <h2 className="mb-2 font-bold">نتيجة آخر دفعة</h2>
          <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs" dir="ltr">
            {log.map((row) => (
              <li key={row.orderId}>
                #{row.orderId}{" "}
                <span
                  className={
                    row.status === "imported" || row.status === "photo_updated"
                      ? "text-emerald-600"
                      : row.status === "already_in_db"
                        ? "text-sky-600"
                        : row.status === "cached"
                          ? "text-indigo-600"
                          : row.status === "skipped"
                            ? "text-amber-600"
                            : "text-rose-600"
                  }
                >
                  {row.status}
                </span>
                {row.detail ? ` — ${row.detail.slice(0, 120)}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
