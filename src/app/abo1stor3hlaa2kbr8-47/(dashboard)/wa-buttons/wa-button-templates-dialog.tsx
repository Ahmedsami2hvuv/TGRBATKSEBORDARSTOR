"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateMandoubWaButtonTemplates,
  type WaButtonsFormState,
} from "./actions";
import { ad } from "@/lib/admin-ui";
import { splitMandoubWaTemplateVariants } from "@/lib/mandoub-wa-button-template";
import { WA_BUTTON_VARIABLE_CHIPS } from "./wa-buttons-constants";

type Props = {
  row: { id: string; label: string; templateText: string };
  onDismiss: () => void;
};

export function WaButtonTemplatesDialog({ row, onDismiss }: Props) {
  const router = useRouter();
  const initialState: WaButtonsFormState = {};
  const [state, formAction, pending] = useActionState(
    updateMandoubWaButtonTemplates,
    initialState,
  );

  const [templateVariants, setTemplateVariants] = useState<string[]>(() =>
    splitMandoubWaTemplateVariants(row.templateText),
  );
  const [draftTemplate, setDraftTemplate] = useState("");
  /** فهرس النموذج الذي يُعدَّل في المسودة — إن وُجد لا نُكرّر المسودة كإضافة جديدة */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const nextDraftCursorRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const combinedTemplateText = useMemo(() => {
    const parts = templateVariants.map((s, i) =>
      editingIndex === i ? draftTemplate : s,
    );
    const cleaned = parts.map((s) => s.trim()).filter(Boolean);
    if (editingIndex === null) {
      const d = draftTemplate.trim();
      if (d) cleaned.push(d);
    }
    return cleaned.join("\n---\n");
  }, [templateVariants, editingIndex, draftTemplate]);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    const el = draftTextareaRef.current;
    const cursor = nextDraftCursorRef.current;
    if (!el || cursor == null) return;
    el.setSelectionRange(cursor, cursor);
    nextDraftCursorRef.current = null;
  }, [draftTemplate]);

  function addDraftAsVariant() {
    if (editingIndex !== null) return;
    const t = draftTemplate.trim();
    if (!t) return;
    setTemplateVariants((prev) => [...prev, t]);
    setDraftTemplate("");
  }

  function startEditVariant(idx: number) {
    if (editingIndex !== null && editingIndex !== idx) {
      window.alert("أنهِ التعديل الحالي (تطبيق أو إلغاء) قبل تعديل نموذج آخر.");
      return;
    }
    if (editingIndex === idx) return;
    setDraftTemplate(templateVariants[idx] ?? "");
    setEditingIndex(idx);
  }

  function applyEditVariant() {
    if (editingIndex === null) return;
    const t = draftTemplate.trim();
    if (!t) return;
    setTemplateVariants((prev) => {
      const next = [...prev];
      next[editingIndex] = t;
      return next;
    });
    setEditingIndex(null);
    setDraftTemplate("");
  }

  function cancelEditVariant() {
    setEditingIndex(null);
    setDraftTemplate("");
  }

  function insertVariable(key: string) {
    const el = draftTextareaRef.current;
    if (!el) return;
    el.focus();

    const token = `{{{${key}}}}`;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setDraftTemplate(next);
    nextDraftCursorRef.current = start + token.length;
  }

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    dialogRef.current?.close();
  }, [state.ok, router]);

  return (
    <dialog
      ref={dialogRef}
      className="w-[min(100%,42rem)] max-h-[90vh] rounded-2xl border border-sky-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
      onClose={onDismiss}
    >
      <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={ad.h2}>نماذج الرسالة</h2>
            <p className="mt-1 text-sm text-slate-600">
              الزر: <span className="font-bold text-slate-900">{row.label}</span>
            </p>
            <p className="mt-2 text-xs text-slate-600">
              عدة نماذج لنفس الزر يُختار منها واحد عشوائياً عند فتح واتساب. الزر واحد وليس عدة
              أزرار.
            </p>
          </div>
          <button
            type="button"
            className={ad.btnDark}
            onClick={() => dialogRef.current?.close()}
          >
            إغلاق
          </button>
        </div>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="templateText" value={combinedTemplateText} readOnly />

          <p className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs text-violet-900">
            اكتب نموذجاً ثم <strong>إضافة نموذج</strong> لتجميع أكثر من صيغة، أو استخدم{" "}
            <strong>تعديل النموذج</strong> على أحد النماذج الموجودة. يمكنك حفظ مسودة جديدة مع
            حفظ النماذج.
          </p>

          <div className="rounded-xl border border-sky-200 bg-sky-50/30 p-3">
            <p className="text-sm font-bold text-slate-800">مربع كتابة المسودة</p>

            <textarea
              ref={draftTextareaRef}
              className={`${ad.input} mt-2 min-h-[120px] resize-y font-mono`}
              value={draftTemplate}
              onChange={(e) => setDraftTemplate(e.target.value)}
              placeholder="اكتب نموذج الرسالة هنا…"
              aria-label="مسودة نموذج الرسالة"
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {editingIndex !== null ? (
                <>
                  <button
                    type="button"
                    onClick={applyEditVariant}
                    className={ad.btnPrimary}
                  >
                    تطبيق التعديل
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditVariant}
                    className={ad.btnDark}
                  >
                    إلغاء التعديل
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={addDraftAsVariant}
                  className={ad.btnDark}
                >
                  إضافة نموذج
                </button>
              )}
              <span className="text-xs text-slate-600">
                {editingIndex !== null
                  ? "عدّل النص داخل المربع ثم طبّق أو ألغِ."
                  : "يمكنك حفظ مسودة جديدة مع «حفظ النماذج» دون «إضافة نموذج»."}
              </span>
            </div>

            <div className="mt-3">
              <p className="text-xs font-bold text-slate-700">إدراج متغير:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WA_BUTTON_VARIABLE_CHIPS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-50"
                    title={`${v.label} — {{{${v.key}}}}`}
                  >
                    {v.label} · {"{{{" + v.key + "}}}"}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-xs font-bold text-slate-700">شرح المتغيرات:</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {WA_BUTTON_VARIABLE_CHIPS.map((v) => (
                    <li key={`help-${v.key}`}>
                      <span className="font-bold text-slate-900">{v.label}</span>
                      <span className="mx-1 text-slate-500">←</span>
                      <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-sky-900">
                        {"{{{" + v.key + "}}}"}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {templateVariants.length > 0 ? (
            <ul className="space-y-2">
              {templateVariants.map((text, idx) => (
                <li
                  key={`v-${idx}-${text.slice(0, 24)}`}
                  className="flex flex-wrap items-start gap-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-500">نموذج {idx + 1}</p>
                    {editingIndex === idx ? (
                      <p className="mt-1 text-xs font-bold text-amber-800">
                        يُعدّل داخل المسودة بالأعلى — اضغط «تطبيق التعديل» أو «إلغاء التعديل».
                      </p>
                    ) : (
                      <pre className="mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap break-words font-mono text-sm text-slate-800">
                        {text}
                      </pre>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editingIndex === idx ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateVariants((prev) => prev.filter((_, i) => i !== idx));
                          cancelEditVariant();
                        }}
                        className={ad.btnDanger}
                      >
                        حذف
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditVariant(idx)}
                          className={ad.btnPrimary}
                        >
                          تعديل النموذج
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setTemplateVariants((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className={ad.btnDanger}
                        >
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {state.error ? <p className={ad.error}>{state.error}</p> : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button type="submit" disabled={pending} className={ad.btnPrimary}>
              {pending ? "جارٍ الحفظ…" : "حفظ النماذج"}
            </button>
            <button
              type="button"
              className={ad.btnDark}
              onClick={() => dialogRef.current?.close()}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
