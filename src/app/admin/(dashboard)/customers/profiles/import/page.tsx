"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { importCustomersFromSql, undoImportBatch } from "../import-actions";

export default function CustomerImportPage() {
  const [state, formAction, pending] = useActionState(importCustomersFromSql, null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [undoPending, setUndoPending] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4">
      <nav className="text-sm">
        <Link href="/admin/customers/profiles" className={ad.link}>
          ← العودة لبروفايلات الزبائن
        </Link>
      </nav>

      <header className="space-y-2">
        <h1 className={ad.h1}>استيراد بيانات الزبائن (SQL)</h1>
        <p className={ad.muted}>
          قم برفع ملف الـ SQL الخاص بك. سيقوم النظام بتحليل الأسطر واستخراج أرقام الهواتف والمواقع الجغرافية وصور الأبواب وربطها بالمناطق تلقائياً.
        </p>
      </header>

      <section className={ad.section}>
        <form action={(fd) => {
          formAction(fd);
        }} className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-8 text-center">
            <input
              type="file"
              name="sqlFile"
              accept=".sql,.txt"
              required
              className="mx-auto block w-full max-w-xs text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-sky-700"
            />
            <p className="mt-4 text-xs text-slate-500">
              ملاحظة: الملفات الكبيرة قد تستغرق دقيقة أو أكثر للمعالجة.
            </p>
          </div>

          {state?.error && (
            <div className={ad.error}>{state.error}</div>
          )}

          {state?.successCount !== undefined && (
            <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
              <p className="text-sm font-bold text-emerald-800">✅ اكتملت العملية:</p>
              <ul className="mt-2 text-xs text-emerald-700 space-y-1">
                <li>• تم استيراد/تحديث: <strong>{state.successCount}</strong> زبون.</li>
                <li>• أسطر تم تخطيها: <strong>{state.errorCount}</strong>.</li>
              </ul>
              {state.batchId && (
                <div className="mt-4 pt-4 border-t border-emerald-200">
                  <p className="text-xs text-slate-600 mb-2">هل اكتشفت خطأ في البيانات المستوردة؟</p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm("هل أنت متأكد من تراجع عن هذه الدفعة؟ سيتم حذف جميع البروفايلات التي تمت إضافتها في هذه العملية فقط.")) {
                        setUndoPending(true);
                        await undoImportBatch(state.batchId!);
                        alert("تم التراجع وحذف الدفعة.");
                        window.location.reload();
                      }
                    }}
                    disabled={undoPending}
                    className="text-xs font-bold text-rose-700 underline hover:text-rose-900"
                  >
                    {undoPending ? "جاري التراجع..." : "↩ التراجع عن عملية الاستيراد هذه"}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className={`${ad.btnPrimary} w-full py-4 text-lg`}
          >
            {pending ? "⏳ جاري المعالجة... يرجى الانتظار" : "بدء استيراد الملف"}
          </button>
        </form>
      </section>

      {state?.errors && state.errors.length > 0 && (
        <section className="rounded-xl bg-slate-50 p-4 border border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 mb-2">سجل الملاحظات:</h2>
          <div className="max-h-40 overflow-y-auto text-[10px] font-mono text-slate-600 space-y-1">
            {state.errors.slice(0, 100).map((err, i) => (
              <p key={i}>{err}</p>
            ))}
            {state.errors.length > 100 && <p>... والمزيد</p>}
          </div>
        </section>
      )}
    </div>
  );
}
