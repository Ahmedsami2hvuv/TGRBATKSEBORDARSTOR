import Link from "next/link";
import type { EmployeeOrderPortalVerifyReason } from "@/lib/employee-order-portal-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { clientOrderFormPath, clientOrderHistoryPath } from "@/lib/client-order-portal-nav";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { getIraqTime } from "@/lib/baghdad-time";
import { getPartnerDetails } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "سجل الديون والإحصائيات — أبو الأكبر للتوصيل",
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
    default:
      return "الرابط غير صالح.";
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
      <div className="min-h-screen bg-[#FDF8EE] flex flex-col px-4 py-16 text-slate-800" dir="rtl">
        <div className="mx-auto max-w-md w-full">
          <div className="rounded-3xl border-2 border-rose-300 bg-white p-8 text-center shadow-md">
            <p className="text-lg font-black text-rose-700">تعذّر فتح سجل الديون</p>
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
      <div className="min-h-screen bg-[#FDF8EE] flex flex-col px-4 py-16 text-slate-800" dir="rtl">
        <div className="mx-auto max-w-md w-full text-center">
          <div className="rounded-3xl border-2 border-[#C9A86A]/40 bg-white p-8 shadow-md">
            <p className="text-lg font-black text-slate-800">الموظف غير موجود</p>
          </div>
        </div>
      </div>
    );
  }

  if (employee.orderPortalToken !== v.token) {
    return (
      <div className="min-h-screen bg-[#FDF8EE] flex flex-col px-4 py-16 text-slate-800" dir="rtl">
        <div className="mx-auto max-w-md w-full">
          <div className="rounded-3xl border-2 border-rose-300 bg-white p-8 text-center shadow-md">
            <p className="text-lg font-black text-rose-700">الرابط غير صالح</p>
            <p className="mt-2 text-sm text-slate-600">انتهت صلاحية الجلسة. اطلب رابطاً جديداً من الإدارة.</p>
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

  const shopId = employee.shop.id;

  // 1. حساب توقيتات بغداد (السنة، الشهر، اليوم)
  const now = new Date();
  const iraq = getIraqTime(now);

  const dayStartUtc = new Date(Date.UTC(iraq.year, iraq.month - 1, iraq.day, -3, 0, 0, 0));
  const dayEndUtc = new Date(Date.UTC(iraq.year, iraq.month - 1, iraq.day + 1, -3, 0, 0, 0));
  const monthStartUtc = new Date(Date.UTC(iraq.year, iraq.month - 1, 1, -3, 0, 0, 0));
  const yearStartUtc = new Date(Date.UTC(iraq.year, 0, 1, -3, 0, 0, 0));

  // 2. جلب أعداد الطلبيات بالترتيب: الكلي، السنة، الشهر، اليوم
  const [totalCount, yearCount, monthCount, todayCount] = await Promise.all([
    prisma.order.count({ where: { shopId } }),
    prisma.order.count({ where: { shopId, createdAt: { gte: yearStartUtc } } }),
    prisma.order.count({ where: { shopId, createdAt: { gte: monthStartUtc } } }),
    prisma.order.count({ where: { shopId, createdAt: { gte: dayStartUtc, lt: dayEndUtc } } }),
  ]);

  // 3. جلب بيانات وحسابات شريك دفتر الديون المرتبط بهذا المحل
  let partner = await prisma.creditBookPartner.findFirst({
    where: {
      externalId: shopId,
      type: { in: ["shop", "deleted_shop"] }
    }
  });

  if (!partner) {
    partner = await prisma.creditBookPartner.findFirst({
      where: { name: employee.shop.name }
    });
    if (!partner) {
      partner = await prisma.creditBookPartner.create({
        data: {
          name: employee.shop.name,
          phone: employee.shop.phone || null,
          type: "shop",
          externalId: shopId,
        }
      });
    }
  }

  const partnerDetails = partner ? await getPartnerDetails(partner.id) : null;
  const balance = partnerDetails?.balance ?? 0;
  const balanceAbs = Math.abs(balance);
  const isOwedToClient = balance < 0; // يطلبنا = متبقي لصالح العميل
  const isOwedByClient = balance > 0; // نطلبه = بذمة العميل
  const isZero = balance === 0;

  const transactions = partnerDetails?.transactions ?? [];

  return (
    <div className="min-h-screen bg-[#FDF8EE] px-3.5 sm:px-4 py-6 pb-24 text-slate-800" dir="rtl">
      <div className="mx-auto max-w-lg space-y-4">
        
        {/* زر العودة العلوي */}
        <div className="flex items-center justify-between">
          <Link
            href={formHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#FFFEFB] border-2 border-[#C9A86A]/40 text-xs font-black text-[#0A3D2E] shadow-xs hover:bg-[#FFF8F0] active:scale-95 transition"
          >
            <span>←</span> العودة لرفع الطلب
          </Link>

          <Link
            href={historyHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#FFFEFB] border-2 border-[#C9A86A]/40 text-xs font-black text-[#0A3D2E] shadow-xs hover:bg-[#FFF8F0] active:scale-95 transition"
          >
            <span>📜</span> سجل الطلبات
          </Link>
        </div>

        {/* 1. البلوكات الإحصائية الأربعة في الأعلى وبجانب بعضها بالترتيب المطلوب */}
        <section aria-label="إحصائيات الطلبيات">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            
            {/* 1. الكلي */}
            <div className="rounded-2xl border-2 border-[#C9A86A] bg-gradient-to-b from-[#FFF8F0] to-[#FFFEFB] p-2.5 sm:p-3 text-center shadow-xs">
              <p className="text-xl sm:text-2xl font-black tabular-nums text-[#0A3D2E]">
                {totalCount}
              </p>
              <p className="mt-1 text-[10px] sm:text-xs font-black text-slate-700">
                الكلي
              </p>
            </div>

            {/* 2. طلبيات السنة */}
            <div className="rounded-2xl border-2 border-[#C9A86A]/40 bg-[#FFFEFB] p-2.5 sm:p-3 text-center shadow-xs">
              <p className="text-xl sm:text-2xl font-black tabular-nums text-[#0A3D2E]">
                {yearCount}
              </p>
              <p className="mt-1 text-[10px] sm:text-xs font-black text-slate-700">
                طلبيات السنه
              </p>
            </div>

            {/* 3. طلبيات الشهر */}
            <div className="rounded-2xl border-2 border-[#C9A86A]/40 bg-[#FFFEFB] p-2.5 sm:p-3 text-center shadow-xs">
              <p className="text-xl sm:text-2xl font-black tabular-nums text-[#0A3D2E]">
                {monthCount}
              </p>
              <p className="mt-1 text-[10px] sm:text-xs font-black text-slate-700">
                طلبيات الشهر
              </p>
            </div>

            {/* 4. طلبيات اليوم */}
            <div className="rounded-2xl border-2 border-[#C9A86A]/40 bg-[#FFFEFB] p-2.5 sm:p-3 text-center shadow-xs">
              <p className="text-xl sm:text-2xl font-black tabular-nums text-emerald-700">
                {todayCount}
              </p>
              <p className="mt-1 text-[10px] sm:text-xs font-black text-emerald-900">
                طلبيات اليوم
              </p>
            </div>

          </div>
        </section>

        {/* 2. بلوك سجل الديون الفاخر الموضح للمبلغ المتبقي كما في دفتر الديون عند الإدارة */}
        <section aria-label="سجل الديون">
          <div className="rounded-3xl border-2 border-[#C9A86A] bg-[#FFFEFB] p-5 sm:p-6 text-center shadow-md space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#C9A86A]/20">
              <span className="text-xs font-black text-[#0A3D2E] flex items-center gap-1.5">
                <span>📒</span> دفتر الديون والحساب المالي
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-[#FFF8F0] px-2.5 py-1 rounded-full border border-[#C9A86A]/30">
                محدث تلقائياً ✓
              </span>
            </div>

            {/* بطاقة المبلغ المتبقي الضخمة */}
            <div
              className={`p-6 sm:p-7 rounded-2xl border-2 text-center transition-all shadow-xs ${
                isOwedToClient
                  ? "bg-gradient-to-b from-emerald-50 via-[#FFF8F0] to-[#FFFEFB] border-emerald-500 text-emerald-900 ring-2 ring-emerald-200/50"
                  : isOwedByClient
                    ? "bg-gradient-to-b from-rose-50 via-[#FFF8F0] to-[#FFFEFB] border-rose-400 text-rose-950 ring-2 ring-rose-200/50"
                    : "bg-[#FFF8F0] border-[#C9A86A]/40 text-[#0A3D2E]"
              }`}
            >
              <p className="text-xs sm:text-sm font-black mb-1 opacity-90">
                {isOwedToClient
                  ? "المبلغ المتبقي لك (بذمتنا) 💰"
                  : isOwedByClient
                    ? "المبلغ المتبقي عليك (مطلوب سداده) ⚠️"
                    : "حالة الحساب"}
              </p>

              <div className="my-2">
                <span className="text-4xl sm:text-5xl font-black font-mono tabular-nums tracking-tight">
                  {formatDinarAsAlfWithUnit(balanceAbs)}
                </span>
              </div>

              <p className="text-xs font-bold mt-2">
                {isOwedToClient
                  ? "مستحق لكم وجاهز للتحويل والتسليم"
                  : isOwedByClient
                    ? "يرجى تسديد المبلغ المتبقي للإدارة"
                    : "الحساب مصفّر بالكامل ولا توجد أي ديون متبقية"}
              </p>
            </div>

            {/* ملخص إجمالي أخذت وأعطيت */}
            {partnerDetails && (
              <div className="grid grid-cols-2 gap-2.5 text-xs font-black">
                <div className="bg-[#FFF8F0] border border-[#C9A86A]/30 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block mb-0.5">إجمالي قيمة الطلبات (أخذت)</span>
                  <span className="text-rose-700 font-mono text-sm">{formatDinarAsAlfWithUnit(partnerDetails.totalTook)}</span>
                </div>
                <div className="bg-[#FFF8F0] border border-[#C9A86A]/30 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 block mb-0.5">إجمالي المسدد والمستلم (أعطيت)</span>
                  <span className="text-emerald-700 font-mono text-sm">{formatDinarAsAlfWithUnit(partnerDetails.totalGave)}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. كشف المعاملات وتفاصيل الديون التاريخية */}
        <section aria-label="كشف المعاملات" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs sm:text-sm font-black text-[#0A3D2E] flex items-center gap-1.5">
              <span>📄</span> كشف حركات دفتر الديون ({transactions.length})
            </h2>
            <span className="text-[10px] font-bold text-slate-500">
              مطابق للإدارة 100%
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#C9A86A]/40 bg-[#FFFEFB] p-8 text-center text-xs font-bold text-slate-500">
              لا توجد أي حركات أو معاملات مسجلة في سجل الديون حتى الآن.
            </div>
          ) : (
            (() => {
              const pinnedTxs = transactions.filter((tx: any) => tx.kind === "expense" || tx.note?.includes("[مصروفات]"));
              const normalTxs = transactions.filter((tx: any) => !(tx.kind === "expense" || tx.note?.includes("[مصروفات]")));
              const displayTxs = [...pinnedTxs, ...normalTxs];

              return (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-0.5">
                  {displayTxs.map((tx: any) => {
                    const isExpense = tx.kind === "expense" || tx.note?.includes("[مصروفات]");
                    const isGave = tx.kind === "gave"; // أعطيت = تسديد
                    return (
                      <div
                        key={tx.id}
                        className={`rounded-2xl border p-3 sm:p-3.5 shadow-2xs transition-all bg-[#FFFEFB] ${
                          isExpense
                            ? "border-sky-400 ring-2 ring-sky-200 bg-sky-50/40"
                            : isGave
                              ? "border-emerald-300 ring-1 ring-emerald-100"
                              : "border-rose-300 ring-1 ring-rose-100"
                        }`}
                      >
                        {isExpense && (
                          <div className="text-[10px] font-black text-sky-800 bg-sky-100 px-2 py-0.5 rounded-lg mb-1.5 inline-flex items-center gap-1 border border-sky-200">
                            📌 <span>مصروفات مثبتة في بداية كشف الديون</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                isExpense
                                  ? "bg-sky-600 text-white border-sky-600"
                                  : isGave
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-rose-100 text-rose-800 border-rose-300"
                              }`}
                            >
                              {isExpense ? "📦 مصروفات" : isGave ? "🟢 تسديد / استلام" : "🔴 طلب / دين"}
                            </span>
                            {tx.isPaid && (
                              <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                                مسدد ✓
                              </span>
                            )}
                          </div>

                          <span
                            dir="ltr"
                            className={`text-sm sm:text-base font-black font-mono tabular-nums ${
                              isExpense ? "text-sky-700" : isGave ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {formatDinarAsAlfWithUnit(tx.amount)}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-800 leading-relaxed">
                          {tx.note || "بدون ملاحظات"}
                        </p>

                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                          <span>
                            {new Date(tx.createdAt).toLocaleDateString("ar-IQ-u-nu-latn", {
                              year: "numeric",
                              month: "numeric",
                              day: "numeric",
                            })}
                          </span>
                          <span>
                            {new Date(tx.createdAt).toLocaleTimeString("ar-IQ-u-nu-latn", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </section>

      </div>
    </div>
  );
}
