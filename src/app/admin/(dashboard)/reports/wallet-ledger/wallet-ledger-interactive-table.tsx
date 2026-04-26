"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useMemo, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE } from "@/lib/mandoub-cash-constants";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  bulkHardDeleteWalletLedgerRows,
  bulkSoftDeleteWalletLedgerRows,
  hardDeleteWalletLedgerRow,
  softDeleteWalletLedgerRow,
  type WalletLedgerDeleteState,
} from "./actions";

export type WalletLedgerRowSerialized = {
  id: string;
  createdAt: string;
  category: string;
  summary: string;
  ownerLabel: string;
  signedAmountDinar: string | null;
  absoluteAmountDinar: string;
  orderId: string | null;
};

const initialDel: WalletLedgerDeleteState = {};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("ar-IQ-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** صادر = سالب للمحفظة — أخضر. وارد = موجب — أحمر. */
function rowTone(signedStr: string | null): "out" | "in" | "neutral" {
  if (signedStr == null || signedStr === "") return "neutral";
  const n = Number(signedStr);
  if (Number.isNaN(n)) return "neutral";
  if (n < 0) return "out";
  if (n > 0) return "in";
  return "neutral";
}

export function WalletLedgerInteractiveTable({
  rows,
  returnUrl,
}: {
  rows: WalletLedgerRowSerialized[];
  returnUrl: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkPhrase, setBulkPhrase] = useState("");
  const [phraseById, setPhraseById] = useState<Record<string, string>>({});

  const [softState, softAction, softPending] = useActionState(
    softDeleteWalletLedgerRow,
    initialDel,
  );
  const [hardState, hardAction, hardPending] = useActionState(
    hardDeleteWalletLedgerRow,
    initialDel,
  );
  const [bulkSoftState, bulkSoftAction, bulkSoftPending] = useActionState(
    bulkSoftDeleteWalletLedgerRows,
    initialDel,
  );
  const [bulkHardState, bulkHardAction, bulkHardPending] = useActionState(
    bulkHardDeleteWalletLedgerRows,
    initialDel,
  );

  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const selectedArr = useMemo(() => Array.from(selected), [selected]);
  const softBulkIds = useMemo(
    () => selectedArr.filter((id) => !id.startsWith("wt:")),
    [selectedArr],
  );
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, [allSelected, visibleIds]);

  const rowClick = useCallback(
    (r: WalletLedgerRowSerialized) => {
      if (r.orderId) {
        router.push(`/admin/orders/${r.orderId}`);
      }
    },
    [router],
  );

  const err =
    softState.error ||
    hardState.error ||
    bulkSoftState.error ||
    bulkHardState.error;

  return (
    <div className="space-y-4">
      {err ? (
        <p className={`rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900`}>
          {err}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm">
        <span className="font-bold text-sky-900">
          محدّد:{" "}
          <span className="tabular-nums">{selectedArr.length}</span> / {rows.length}
        </span>
        {selectedArr.length > 0 ? (
          <>
            <form action={bulkSoftAction} className="inline">
              <input type="hidden" name="rowIds" value={softBulkIds.join(",")} />
              <input type="hidden" name="returnUrl" value={returnUrl} />
              <button
                type="submit"
                disabled={bulkSoftPending || softBulkIds.length === 0}
                className={`${ad.btnDanger} text-xs`}
                onClick={(e) => {
                  if (softBulkIds.length === 0) {
                    e.preventDefault();
                    return;
                  }
                  if (
                    !window.confirm(
                      `مسح ناعم لـ ${softBulkIds.length} معاملة؟ (تحويلات المحفظة لا تُمسح ناعماً — أزلها من التحديد أو استخدم الحذف النهائي لها)`,
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                مسح المحدد ({softBulkIds.length})
              </button>
            </form>
            <label className="flex flex-wrap items-center gap-1 text-xs text-slate-700">
              <span>تأكيد حذف نهائي جماعي:</span>
              <input
                type="text"
                value={bulkPhrase}
                onChange={(e) => setBulkPhrase(e.target.value)}
                className={`${ad.input} max-w-[10rem] py-1 text-xs`}
                placeholder={ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}
              />
            </label>
            <form action={bulkHardAction} className="inline">
              <input type="hidden" name="rowIds" value={selectedArr.join(",")} />
              <input type="hidden" name="returnUrl" value={returnUrl} />
              <input type="hidden" name="confirmPhrase" value={bulkPhrase} />
              <button
                type="submit"
                disabled={
                  bulkHardPending ||
                  bulkPhrase.trim() !== ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE
                }
                className="rounded-xl border-2 border-rose-900 bg-rose-950 px-3 py-1.5 text-xs font-black text-white hover:bg-rose-900 disabled:opacity-50"
                onClick={(e) => {
                  if (
                    !window.confirm(
                      `حذف نهائي لـ ${selectedArr.length} معاملة من قاعدة البيانات؟ لا رجعة.`,
                    )
                  ) {
                    e.preventDefault();
                    return;
                  }
                  if (!window.confirm("تأكيد نهائي؟")) {
                    e.preventDefault();
                  }
                }}
              >
                حذف نهائي للمحدد
              </button>
            </form>
          </>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-sky-200 bg-white shadow-sm">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-sky-200 bg-sky-50/90 text-sky-950">
              <th className="w-10 px-1 py-2 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="تحديد الكل"
                  className="h-4 w-4"
                />
              </th>
              <th className="px-2 py-2 text-right font-bold">الوقت</th>
              <th className="px-2 py-2 text-right font-bold">النوع</th>
              <th className="px-2 py-2 text-right font-bold">صاحب المعاملة</th>
              <th className="px-2 py-2 text-right font-bold">التفاصيل</th>
              <th className="px-2 py-2 text-left font-bold" dir="ltr">
                المبلغ
              </th>
              <th className="px-2 py-2 text-center font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  لا توجد معاملات تطابق البحث أو النطاق.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const tone = rowTone(r.signedAmountDinar);
                const signed =
                  r.signedAmountDinar != null && r.signedAmountDinar !== ""
                    ? Number(r.signedAmountDinar)
                    : null;
                const rowBg =
                  tone === "out"
                    ? "bg-emerald-50/90 hover:bg-emerald-100/80"
                    : tone === "in"
                      ? "bg-red-50/90 hover:bg-red-100/80"
                      : "bg-slate-50/70 hover:bg-slate-100/80";
                const amtClass =
                  tone === "out"
                    ? "text-emerald-900 font-bold"
                    : tone === "in"
                      ? "text-red-800 font-bold"
                      : "text-slate-700";
                const amtText =
                  signed == null || Number.isNaN(signed)
                    ? `${formatDinarAsAlfWithUnit(Number(r.absoluteAmountDinar))} (تحويل)`
                    : `${signed > 0 ? "+" : ""}${formatDinarAsAlfWithUnit(signed)}`;
                const canSoft = !r.id.startsWith("wt:");
                const phrase = phraseById[r.id] ?? "";
                const canHard = phrase.trim() === ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE;

                return (
                  <tr
                    key={r.id}
                    className={`cursor-pointer border-b border-slate-100/90 ${rowBg}`}
                    onClick={() => rowClick(r)}
                  >
                    <td
                      className="px-1 py-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        className="h-4 w-4"
                        aria-label="تحديد"
                      />
                    </td>
                    <td className="px-2 py-2 align-top whitespace-nowrap tabular-nums text-slate-800">
                      {fmtWhen(r.createdAt)}
                    </td>
                    <td className="px-2 py-2 align-top font-semibold text-slate-900">
                      {r.category}
                    </td>
                    <td className="px-2 py-2 align-top text-slate-800">{r.ownerLabel}</td>
                    <td className="px-2 py-2 align-top text-slate-700 leading-snug">
                      {r.summary}
                      {r.orderId ? (
                        <span className="mt-1 block text-xs text-sky-700">
                          <Link
                            href={`/admin/orders/${r.orderId}`}
                            className={ad.link}
                            onClick={(e) => e.stopPropagation()}
                          >
                            فتح الطلبية
                          </Link>
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`px-2 py-2 align-top text-left tabular-nums ${amtClass}`}
                      dir="ltr"
                    >
                      {amtText}
                    </td>
                    <td
                      className="px-1 py-2 align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-1.5">
                        {canSoft ? (
                          <form action={softAction} className="inline">
                            <input type="hidden" name="rowId" value={r.id} />
                            <input type="hidden" name="returnUrl" value={returnUrl} />
                            <button
                              type="submit"
                              disabled={softPending}
                              className="w-full rounded-lg border border-rose-400 bg-white px-2 py-1 text-xs font-bold text-rose-900 hover:bg-rose-50 disabled:opacity-50"
                              onClick={(e) => {
                                if (
                                  !window.confirm(
                                    "مسح ناعم لهذه المعاملة؟ (تبقى أثراً كملغاة)",
                                  )
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              مسح
                            </button>
                          </form>
                        ) : (
                          <span className="text-[10px] text-slate-500">لا مسح ناعم للتحويل</span>
                        )}
                        <form action={hardAction} className="flex flex-col gap-0.5">
                          <input type="hidden" name="rowId" value={r.id} />
                          <input type="hidden" name="returnUrl" value={returnUrl} />
                          <input
                            type="text"
                            name="confirmPhrase"
                            value={phrase}
                            onChange={(e) =>
                              setPhraseById((prev) => ({
                                ...prev,
                                [r.id]: e.target.value,
                              }))
                            }
                            className={`${ad.input} py-0.5 text-[10px]`}
                            placeholder={ADMIN_MONEY_HARD_DELETE_CONFIRM_PHRASE}
                            onClick={(e) => e.stopPropagation()}
                            autoComplete="off"
                          />
                          <button
                            type="submit"
                            disabled={hardPending || !canHard}
                            className="w-full rounded-lg border border-rose-950 bg-rose-950 px-2 py-1 text-[10px] font-black text-white hover:bg-rose-900 disabled:opacity-40"
                            onClick={(e) => {
                              if (!canHard) {
                                e.preventDefault();
                                return;
                              }
                              if (
                                !window.confirm(
                                  "حذف نهائي من قاعدة البيانات — لا رجعة؟",
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <p className={`border-t border-sky-100 px-3 py-2 text-xs ${ad.muted}`}>
          انقر على الصف لفتح الطلبية عند توفرها.{" "}
          <span className="text-emerald-800 font-semibold">أخضر</span> ≈ صادر،{" "}
          <span className="text-red-800 font-semibold">أحمر</span> ≈ وارد (بحسب اتجاه
          المحفظة). المبالغ بالألف.
        </p>
      </div>
    </div>
  );
}
