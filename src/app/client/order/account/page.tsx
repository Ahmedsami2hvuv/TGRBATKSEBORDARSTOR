import Link from "next/link";
import { baghdadDayRangeUtc, baghdadYmdToday } from "@/lib/baghdad-archived-day";
import {
  clientOrderAccountPath,
  clientOrderFormPath,
  clientOrderHistoryPath,
  clientOrderWalletPath,
} from "@/lib/client-order-portal-nav";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { resolvePublicImageSrc } from "@/lib/image-url";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { EmployeePushBanner } from "../employee-push-banner";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إحصائيات الطلبات — أبو الأكبر للتوصيل",
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
  searchParams: Promise<{ e?: string; exp?: string; s?: string }>;
};

export default async function ClientOrderAccountPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyEmployeeOrderPortalQuery(sp.e, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة الإحصائيات</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: v.employeeId },
    include: { shop: { include: { region: true } } },
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
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة الإحصائيات</p>
            <p className="mt-2 text-sm text-slate-600">الرابط غير صالح. اطلب رابطاً جديداً من الإدارة.</p>
          </div>
        </div>
      </div>
    );
  }

  const e = sp.e ?? "";
  const exp = sp.exp ?? "";
  const sig = sp.s ?? "";
  const formHref = clientOrderFormPath(e, exp, sig);
  const historyHref = clientOrderHistoryPath(e, exp, sig);
  const accountHref = clientOrderAccountPath(e, exp, sig);
  const walletHref = clientOrderWalletPath(e, exp, sig);

  const baseWhere = { submittedByEmployeeId: employee.id };
  const ymd = baghdadYmdToday();
  const dayBounds = baghdadDayRangeUtc(ymd);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [todayCount, weekCount, totalCount, deliveredCount, activeCount, recent] =
    await Promise.all([
      dayBounds
        ? prisma.order.count({
            where: {
              ...baseWhere,
              createdAt: { gte: dayBounds.gte, lt: dayBounds.lt },
            },
          })
        : Promise.resolve(0),
      prisma.order.count({
        where: { ...baseWhere, createdAt: { gte: weekAgo } },
      }),
      prisma.order.count({ where: baseWhere }),
      prisma.order.count({ where: { ...baseWhere, status: "delivered" } }),
      prisma.order.count({
        where: {
          ...baseWhere,
          status: { in: ["pending", "assigned", "delivering"] },
        },
      }),
      prisma.order.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          orderNumber: true,
          status: true,
          orderType: true,
          createdAt: true,
          totalAmount: true,
        },
      }),
    ]);

  const shopPhoto = resolvePublicImageSrc(employee.shop.photoUrl);

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-24 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-lg space-y-5">
        <header className="kse-glass-dark rounded-2xl border border-emerald-200/90 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            أبو الأكبر للتوصيل
          </p>
          <h1 className="mt-2 text-xl font-black text-slate-900">إحصائيات طلباتك</h1>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{employee.shop.name}</p>

          {shopPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shopPhoto}
              alt=""
              className="mx-auto mt-4 h-16 w-16 rounded-2xl object-cover ring-2 ring-emerald-200"
            />
          ) : null}

          <p className="mt-4 text-center text-lg font-bold text-slate-900">
            {employee.name.trim() || "موظف"}
          </p>
          <p className="text-center text-sm text-slate-500">{employee.shop.region.name}</p>

          <nav className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <Link
              href={formHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-600 px-4 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-sky-700"
            >
              رفع طلب جديد
            </Link>
            <Link
              href={walletHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-teal-600 bg-teal-600 px-4 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-teal-700"
            >
              المحفظة والتحويلات
            </Link>
            <Link
              href={historyHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-sky-300 bg-white px-4 py-3 text-center text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
            >
              سجل طلبات المحل
            </Link>
          </nav>
        </header>

        <EmployeePushBanner e={e} exp={exp} s={sig} />

        <section aria-label="إحصائيات الطلبات">
          <h2 className="mb-3 text-sm font-bold text-slate-700">أرقامك</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="kse-glass-dark rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-black tabular-nums text-slate-900">{todayCount}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">اليوم (بغداد)</p>
            </div>
            <div className="kse-glass-dark rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-black tabular-nums text-slate-900">{weekCount}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">آخر 7 أيام</p>
            </div>
            <div className="kse-glass-dark rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-black tabular-nums text-emerald-800">{totalCount}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">إجمالي ما رفعته</p>
            </div>
            <div className="kse-glass-dark rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 text-center shadow-sm">
              <p className="text-2xl font-black tabular-nums text-amber-900">{activeCount}</p>
              <p className="mt-1 text-xs font-semibold text-amber-800">قيد التنفيذ</p>
            </div>
            <div className="kse-glass-dark rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-center shadow-sm">
              <p className="text-2xl font-black tabular-nums text-emerald-900">{deliveredCount}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-800">تم التسليم</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700">آخر الطلبات التي رفعتها</h2>
          {recent.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
              لم تُسجَّل بعد أي طلب مرتبط بحسابك. ابدأ من «رفع طلب جديد».
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((o) => {
                const typeLine = o.orderType?.trim() || "—";
                const totalStr =
                  o.totalAmount != null
                    ? formatDinarAsAlfWithUnit(o.totalAmount)
                    : null;
                return (
                  <li
                    key={o.orderNumber}
                    className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-black tabular-nums text-slate-900">
                        #{o.orderNumber}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                        {statusAr(o.status)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-800">
                      {typeLine}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      {totalStr ? (
                        <span className="font-semibold text-slate-700">الإجمالي: {totalStr}</span>
                      ) : null}
                      <span className="tabular-nums">
                        {o.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-center text-xs text-slate-500">
          <Link href={accountHref} className="font-bold text-emerald-800 underline-offset-2 hover:underline">
            تحديث الصفحة
          </Link>
        </footer>
      </div>
    </div>
  );
}
