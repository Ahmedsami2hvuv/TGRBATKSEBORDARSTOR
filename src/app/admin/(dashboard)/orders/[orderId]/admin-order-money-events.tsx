"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import {
  hardDeleteOrderCourierMoneyEventAdmin,
  softDeleteMandoubMoneyEventAdmin,
  type MandoubCashState,
} from "@/app/mandoub/cash-actions";
import { ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE } from "@/lib/mandoub-cash-constants";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { MONEY_KIND_DELIVERY, MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";

const initial: MandoubCashState = {};

export type AdminOrderMoneyEventRow = {
  id: string;
  kind: string;
  amountDinar: number;
  expectedDinar: number | null;
  matchesExpected: boolean;
  mismatchReason: string;
  mismatchNote: string;
  recordedAt: string;
  deletedAt: string | null;
  deletedReason: string | null;
  deletedByDisplayName: string | null;
  performedByDisplayName: string;
  recordedByCompanyPreparerId: string | null;
};

function formatRecordedAt(iso: string): string {
  const dateObj = new Date(iso);
  if (Number.isNaN(dateObj.getTime())) return "—";
  const date = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
  const time = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj);
  return `${date} ${time}`;
}

function isManualDeletionReason(
  r: string | null | undefined,
): boolean {
  return r === "manual_admin" || r === "manual_courier";
}

export function AdminOrderMoneyEvents({
  orderNumber,
  nextPath,
  events,
}: {
  orderNumber: number;
  /** مسار إعادة التوجيه بعد الحذف (عرض أو تعديل الطلب) */
  nextPath: string;
  events: AdminOrderMoneyEventRow[];
}) {
  const router = useRouter();
  const [softState, softAction, softPending] = useActionState(
    softDeleteMandoubMoneyEventAdmin,
    initial,
  );
  const [hardState, hardAction, hardPending] = useActionState(
    hardDeleteOrderCourierMoneyEventAdmin,
    initial,
  );

  const [phraseById, setPhraseById] = useState<Record<string, string>>({});
  const [localEvents, setLocalEvents] = useState(events);

  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  useEffect(() => {
    if (!softState.ok || !softState.deletedEventId) return;
    setLocalEvents((prev) =>
      prev.map((ev) =>
        ev.id === softState.deletedEventId
          ? {
              ...ev,
              deletedAt: new Date().toISOString(),
              deletedReason: "manual_admin",
              deletedByDisplayName: "لوحة الإدارة",
            }
          : ev,
      ),
    );
    router.refresh();
  }, [softState.ok, softState.deletedEventId, router]);

  useEffect(() => {
    if (!hardState.ok || !hardState.deletedEventId) return;
    setLocalEvents((prev) => prev.filter((ev) => ev.id !== hardState.deletedEventId));
    router.refresh();
  }, [hardState.ok, hardState.deletedEventId, router]);

  return (
    <div className={`${ad.section} space-y-4`} dir="rtl">
      <div>
        <h2 className={ad.h2}>معاملات النقد لهذا الطلب</h2>
        <p className={`mt-1 text-sm ${ad.muted}`}>
          صادر (من الزبون) ووارد (للمندوب) كما سجّلها المندوب أو المجهز. «مسح» يبقي
          أثراً في السجل كمعاملة ملغاة؛ «حذف نهائي» يزيل السجل من النظام بالكامل بعد
          التأكيد.
        </p>
      </div>

      {softState.error ? (
        <p className={`rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 ${ad.error}`}>
          {softState.error}
        </p>
      ) : null}
      {hardState.error ? (
        <p className={`rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 ${ad.error}`}>
          {hardState.error}
        </p>
      ) : null}

      {localEvents.length === 0 ? (
        <p className="text-center text-slate-600">
          لا توجد معاملات نقد مسجّلة لهذا الطلب بعد.
        </p>
      ) : (
        <ul className="space-y-4">
          {localEvents.map((ev) => {
            const deleted = ev.deletedAt != null;
            const manualDel = isManualDeletionReason(ev.deletedReason);
            const dirLabel = ev.kind === MONEY_KIND_PICKUP ? "صادر" : "وارد";
            const noteParts: string[] = [];
            if (ev.mismatchReason?.trim()) noteParts.push(ev.mismatchReason.trim());
            if (ev.mismatchNote?.trim()) noteParts.push(ev.mismatchNote.trim());
            const noteLine = noteParts.length > 0 ? noteParts.join(" — ") : "—";
            const phrase = phraseById[ev.id] ?? "";
            const canSubmitHard =
              phrase.trim() === ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE;

            return (
              <li
                key={ev.id}
                className={`rounded-xl border px-3 py-3 text-sm sm:px-4 sm:py-3.5 ${
                  deleted
                    ? "border-slate-200 bg-slate-100/80 text-slate-600"
                    : ev.kind === MONEY_KIND_PICKUP
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
                      : "border-red-200 bg-red-50/80 text-red-950"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5 leading-relaxed">
                      <p className="text-base font-black sm:text-lg">
                        {dirLabel} —{ev.performedByDisplayName?.trim() || "—"}
                      </p>
                      <p className="text-sm font-bold text-slate-700">
                        طلب {orderNumber}
                        <span className="mr-0 text-xs font-semibold text-slate-500">
                          — {formatRecordedAt(ev.recordedAt)}
                        </span>
                      </p>
                      <p className="text-sm flex flex-wrap items-baseline">
                        <span className="font-bold">
                          متوقع:
                          <span className="font-mono font-black tabular-nums">
                            {ev.expectedDinar != null
                              ? formatDinarAsAlfWithUnit(ev.expectedDinar)
                              : "—"}
                          </span>{" "}
                          مسجّل:
                          <span className="font-mono font-black tabular-nums">
                            {formatDinarAsAlfWithUnit(ev.amountDinar)}
                          </span>
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="font-bold">ملاحظة: </span>
                        <span className="whitespace-pre-wrap break-words">{noteLine}</span>
                      </p>
                      {ev.recordedByCompanyPreparerId ? (
                        <p className="text-xs font-semibold text-violet-800">
                          سُجّلت من لوحة المجهز — حذفها الناعم من المندوب غير متاح من
                          لوحة المندوب.
                        </p>
                      ) : null}
                      {deleted ? (
                        <p className="text-xs font-semibold text-slate-600">
                          {manualDel ? (
                            <>
                              محذوف يدوياً
                              {ev.deletedByDisplayName?.trim() ? (
                                <>
                                  {" "}
                                  — بواسطة:{" "}
                                  <span className="font-bold text-slate-800">
                                    {ev.deletedByDisplayName.trim()}
                                  </span>
                                </>
                              ) : null}
                            </>
                          ) : ev.deletedReason === "status_revert" ? (
                            <>أُلغيت تلقائياً عند تغيير حالة الطلب</>
                          ) : (
                            <>محذوف</>
                          )}
                        </p>
                      ) : null}
                    </div>

                    {!deleted ? (
                      <form action={softAction} className="shrink-0 flex flex-col gap-1">
                        <input type="hidden" name="eventId" value={ev.id} />
                        <input type="hidden" name="nextPath" value={nextPath} />
                        <button
                          type="submit"
                          disabled={softPending}
                          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border-2 border-rose-400 bg-white px-3 py-2 text-sm font-black text-rose-900 shadow-sm transition hover:bg-rose-50 disabled:opacity-60"
                          onClick={(e) => {
                            if (
                              !window.confirm(
                                `تأكيد مسح (إلغاء) حركة «${dirLabel}» للطلب #${orderNumber}؟ تبقى في السجل كمعاملة ملغاة.`,
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <span aria-hidden>🗑️</span> مسح
                        </button>
                      </form>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-200/80 pt-3">
                    <p className="mb-2 text-xs font-bold text-rose-950">
                      حذف نهائي من النظام (قاعدة البيانات والحسابات — لا أثر)
                    </p>
                    <form action={hardAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                      <input type="hidden" name="eventId" value={ev.id} />
                      <input type="hidden" name="nextPath" value={nextPath} />
                      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-slate-700">
                        اكتب للتأكيد:{" "}
                        <code className="rounded bg-slate-100 px-1 text-rose-800">
                          {ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}
                        </code>
                        <input
                          type="text"
                          name="confirmPhrase"
                          value={phrase}
                          onChange={(e) =>
                            setPhraseById((prev) => ({
                              ...prev,
                              [ev.id]: e.target.value,
                            }))
                          }
                          autoComplete="off"
                          className={ad.input}
                          placeholder={ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={hardPending || !canSubmitHard}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-rose-800 bg-rose-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-rose-900 disabled:opacity-50"
                        onClick={(e) => {
                          if (
                            !window.confirm(
                              "تأكيد أول: سيتم حذف هذه المعاملة نهائياً من كل السجلات والتقارير.",
                            )
                          ) {
                            e.preventDefault();
                            return;
                          }
                          if (
                            !window.confirm(
                              "تأكيد نهائي: لا يمكن التراجع. المتابعة؟",
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        حذف نهائي
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
