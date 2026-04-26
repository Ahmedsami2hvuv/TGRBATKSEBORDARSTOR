"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import type { WalletTxnReportRow } from "@/lib/wallet-transactions-report";

function fmtWhen(d: Date | string): string {
  const dateObj = d instanceof Date ? d : new Date(d);
  return dateObj.toLocaleString("ar-IQ-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WalletTransactionsTable({ rows }: { rows: WalletTxnReportRow[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-2xl border border-sky-200 bg-white shadow-sm">
      <table className="min-w-[720px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-sky-200 bg-sky-50/90 text-sky-950">
            <th className="px-3 py-2 text-right font-bold">الوقت</th>
            <th className="px-3 py-2 text-right font-bold">النوع</th>
            <th className="px-3 py-2 text-right font-bold">صاحب المعاملة</th>
            <th className="px-3 py-2 text-right font-bold">التفاصيل</th>
            <th className="px-3 py-2 text-left font-bold" dir="ltr">
              المبلغ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                لا توجد معاملات في هذا النطاق أو للفلتر المختار.
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const signed = r.signedAmountDinar != null ? Number(r.signedAmountDinar) : null;
              const absolute = Number(r.absoluteAmountDinar);

              const amtClass =
                signed == null
                  ? "text-slate-700"
                  : signed > 0
                    ? "text-emerald-800 font-bold"
                    : signed < 0
                      ? "text-rose-800 font-bold"
                      : "text-slate-600";

              const amtText =
                signed == null
                  ? `${formatDinarAsAlfWithUnit(absolute)} (تحويل)`
                  : `${signed > 0 ? "+" : ""}${formatDinarAsAlfWithUnit(signed)}`;

              const isOrder = !!r.orderId;

              return (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100/90 transition-colors ${isOrder ? "cursor-pointer hover:bg-sky-50/80" : "hover:bg-slate-50/80"}`}
                  onClick={() => {
                    if (isOrder) {
                      router.push(`/admin/orders/${r.orderId}`);
                    }
                  }}
                >
                  <td className="px-3 py-2 align-top whitespace-nowrap tabular-nums text-slate-700">
                    {fmtWhen(r.createdAt)}
                  </td>
                  <td className="px-3 py-2 align-top font-semibold text-slate-800">{r.category}</td>
                  <td className="px-3 py-2 align-top text-slate-700">{r.ownerLabel}</td>
                  <td className="px-3 py-2 align-top text-slate-600 leading-snug">
                    {r.summary}
                    {isOrder && (
                      <Link
                        href={`/admin/orders/${r.orderId}`}
                        className="mt-1 block text-[10px] font-bold text-sky-700 underline hover:text-sky-900"
                        onClick={(e) => e.stopPropagation()}
                      >
                        انقر لفتح الطلبية ↗
                      </Link>
                    )}
                  </td>
                  <td className={`px-3 py-2 align-top text-left tabular-nums ${amtClass}`} dir="ltr">
                    {amtText}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <p className={`border-t border-sky-100 px-3 py-2 text-xs ${ad.muted}`}>
        المبالغ المعروضة بالألف. موجب (+) = وارد للمحفظة، سالب (-) = صادر. انقر على معاملات الطلبات لفتحها.
      </p>
    </div>
  );
}
