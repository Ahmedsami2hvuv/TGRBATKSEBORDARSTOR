import Link from "next/link";
import {
  clientOrderAccountPath,
  clientOrderEditPath,
  clientOrderFormPath,
} from "@/lib/client-order-portal-nav";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { CancelOrderButton } from "./cancel-order-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "سجل الطلبات — أبو الأكبر للتوصيل",
};

function invalidMessage(reason: EmployeeOrderPortalVerifyReason): string {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من موظف المحل.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
  }
}

function statusAr(v: string): string {
  switch (v) {
    case "pending":
      return "طلب جديد";
    case "assigned":
      return "بانتظار المندوب";
    case "delivering":
      return "عند المندوب";
    case "delivered":
      return "تم التسليم";
    case "cancelled":
      return "ملغي/مرفوض";
    case "archived":
      return "مؤرشف";
    default:
      return v || "—";
  }
}

type Props = {
  searchParams: Promise<{ e?: string; exp?: string; s?: string; phone?: string; customerPhone?: string }>;
};

export default async function ClientOrderHistoryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyEmployeeOrderPortalQuery(sp.e, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح سجل الطلبات</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: v.employeeId },
    include: { shop: true },
  });

  if (!employee) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl p-8 text-center">
            <p className="text-lg font-bold text-slate-800">الموظف غير موجود</p>
          </div>
        </div>
      </div>
    );
  }

  if (employee.orderPortalToken !== v.token) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح سجل الطلبات</p>
            <p className="mt-2 text-sm text-slate-600">الرابط غير صالح. اطلب رابطاً جديداً من الإدارة.</p>
          </div>
        </div>
      </div>
    );
  }

  const viewer =
    normalizeIraqMobileLocal11(sp.phone ?? "") ??
    normalizeIraqMobileLocal11(sp.customerPhone ?? "") ??
    "";

  const orders = await prisma.order.findMany({
    where: { shopId: employee.shop.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customerRegion: { select: { name: true } },
      moneyEvents: {
        where: { deletedAt: null, kind: "delivery_in", matchesExpected: true },
        select: { id: true }
      },
    }
  });

  const e = sp.e ?? "";
  const exp = sp.exp ?? "";
  const sig = sp.s ?? "";
  // تعديل: تمرير رقم الهاتف (viewer) ليعرف النظام اسم العميل في صفحة الطلب
  const orderFormHref = clientOrderFormPath(e, exp, sig, viewer);
  const accountHref = clientOrderAccountPath(e, exp, sig);

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-16 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-lg space-y-5">
        <header className="kse-glass-dark rounded-2xl border border-sky-200 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800">
            أبو الأكبر للتوصيل
          </p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">سجل الطلبات</h1>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{employee.shop.name}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href={accountHref}
              className="inline-flex w-full items-center justify-center rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
            >
              إحصائيات طلباتك
            </Link>
            <Link
              href={orderFormHref}
              className="inline-flex w-full items-center justify-center rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
            >
              رفع طلب جديد
            </Link>
          </div>
        </header>

        <section className="kse-glass-dark rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-800">رقم الهاتف لمتابعة وتعديل طلباتك</h2>
          <p className="mt-1 text-xs text-slate-500 mb-3">أدخل رقم هاتفك لتتمكن من رؤية كافة التفاصيل وتعديل طلباتك النشطة.</p>
          <form
            method="get"
            action="/client/order/history"
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="e" value={sp.e ?? ""} />
            <input type="hidden" name="exp" value={sp.exp ?? ""} />
            <input type="hidden" name="s" value={sp.s ?? ""} />
            <label className="min-w-0 flex-1">
              <span className="sr-only">رقم الهاتف</span>
              <input
                name="phone"
                defaultValue={sp.phone ?? sp.customerPhone ?? ""}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="مثال: 07701234567"
                className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm font-mono tabular-nums text-slate-800 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900"
            >
              تحديث
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700">
            آخر الطلبات ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600">
              لا توجد طلبات مسجّلة لهذا المحل بعد.
            </p>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => {
                const rowPhone = o.customerPhone?.trim() ?? "";
                const rowNorm = normalizeIraqMobileLocal11(rowPhone);
                const isYours = Boolean(viewer && rowNorm && rowNorm === viewer);
                const canEdit = (o.status === "pending" || o.status === "assigned");

                const typeLine = o.orderType?.trim() || "—";
                const timeNote = o.orderNoteTime?.trim();
                const regionName = o.customerRegion?.name || "بدون منطقة";
                const summary = o.summary?.trim();

                return (
                  <li
                    key={o.orderNumber}
                    className={`rounded-2xl border px-4 py-4 shadow-sm transition-all ${
                      isYours
                        ? "border-emerald-300 bg-emerald-50/90 ring-1 ring-emerald-200 dark:border-emerald-500/80 dark:bg-emerald-900/70 dark:ring-emerald-400/30"
                        : "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-950/90"
                    } ${o.prepaidAll ? "ring-2 ring-emerald-300/50 dark:ring-emerald-400/40" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3 dark:border-slate-700">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-black tabular-nums text-slate-900 dark:text-slate-100">
                          #{o.orderNumber}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${o.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/80 dark:text-blue-200' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/70 dark:text-sky-200'}`}>
                          {statusAr(o.status)}
                        </span>
                        {o.prepaidAll && (
                          <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm ring-1 ring-emerald-300/80">
                            كل شي واصل
                          </span>
                        )}
                        {o.moneyEvents && o.moneyEvents.length > 0 && (
                          <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-900/70 dark:text-teal-200 dark:ring-1 dark:ring-teal-300/30">
                            مُسددة بالكامل
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isYours
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {isYours ? "طلبي" : `زبون آخر · ${rowPhone}`}
                        </span>
                        {canEdit ? (
                          <div className="flex items-center gap-2">
                            <Link
                              href={clientOrderEditPath(e, exp, sig, o.orderNumber, rowPhone)}
                              aria-label={`تعديل الطلب رقم ${o.orderNumber}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-400 bg-white text-lg leading-none text-amber-600 shadow-md transition hover:scale-110 hover:bg-amber-50 active:scale-95"
                              title="تعديل بيانات الطلب"
                            >
                              ✏️
                            </Link>
                            <CancelOrderButton
                              orderNumber={o.orderNumber}
                              e={e}
                              exp={exp}
                              s={sig}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-900">{typeLine}</p>
                          <p className="text-xs text-slate-600 mt-0.5">📍 {regionName}</p>
                        </div>
                        <div className="text-left shrink-0">
                          {o.orderSubtotal != null && (
                            <p className="text-sm font-bold text-slate-900 tabular-nums" dir="ltr">
                              {formatDinarAsAlfWithUnit(o.orderSubtotal)} بدون توصيل
                            </p>
                          )}
                          {o.deliveryPrice != null && (
                            <p className="text-xs text-slate-500 tabular-nums" dir="ltr">
                              {formatDinarAsAlfWithUnit(o.deliveryPrice)} كلفة توصيل
                            </p>
                          )}
                          {o.totalAmount != null && (
                            <p className="mt-1 text-sm font-black text-emerald-700 tabular-nums" dir="ltr">
                              بضاعة: {formatDinarAsAlfWithUnit(o.totalAmount)} مع التوصيل
                            </p>
                          )}
                        </div>
                      </div>

                      {isYours && summary && (
                        <div className="mt-2 rounded-lg border border-sky-100 bg-white/50 p-2 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap dark:border-sky-300/30 dark:bg-slate-900/60 dark:text-slate-200">
                          <span className="font-bold text-sky-900 block mb-1 dark:text-sky-200">الملاحظات:</span>
                          {summary}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                        <span className="tabular-nums">
                          📅 {o.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                        {timeNote && (
                          <span className="font-medium text-slate-600">
                            🕒 وقت الطلب: {timeNote}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
