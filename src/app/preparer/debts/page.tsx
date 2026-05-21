import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery, type CompanyPreparerPortalVerifyReason } from "@/lib/company-preparer-portal-link";
import { prisma } from "@/lib/prisma";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { hideOrderFromPreparerDebtsAction } from "../actions";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

function invalidMessage(reason: CompanyPreparerPortalVerifyReason): string {
  switch (reason) {
    case "expired": return "انتهت صلاحية الرابط أو تم تسجيل الدخول من جهاز آخر.";
    case "bad_signature":
    case "missing": return "الرابط غير صالح. يرجى فتح الرابط الأصلي المرسل إليك.";
    case "no_secret": return "إعداد الخادم غير مكتمل.";
    default: return "تعذّر التحقق.";
  }
}

export default async function PreparerDebtsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  const p = sp.p || cookieStore.get("preparer_p")?.value;
  const s = sp.s || cookieStore.get("preparer_s")?.value;
  const exp = sp.exp || cookieStore.get("preparer_exp")?.value;

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return (
      <div className="kse-app-bg min-h-screen px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر التحقق</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: true },
  });

  if (!preparer) {
    return (
      <div className="kse-app-bg min-h-screen px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md text-center">
          <p className="text-lg font-bold">الحساب غير موجود أو غير نشط.</p>
        </div>
      </div>
    );
  }

  const shopIds = preparer.shopLinks.map(l => l.shopId);

  // جلب الطلبات التي لم يكتمل دفعها للمحل (سعر الطلب > مجموع Sader)
  // والغير مخفية يدوياً
  const orders = await prisma.order.findMany({
    where: {
      shopId: { in: shopIds },
      preparerDebtHidden: false,
      status: { notIn: ["cancelled"] }, // الطلبات الملغاة لا تعتبر ديوناً عادة
      orderSubtotal: { gt: 0 },
    },
    include: {
      moneyEvents: {
        where: { kind: MONEY_KIND_PICKUP, deletedAt: null },
      },
      customerRegion: { select: { name: true } },
      shop: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const debtOrders = orders.filter(o => {
    const totalPaid = o.moneyEvents.reduce((sum, e) => sum + Number(e.amountDinar), 0);
    const subtotal = Number(o.orderSubtotal || 0);
    return totalPaid < subtotal;
  }).map(o => {
    const totalPaid = o.moneyEvents.reduce((sum, e) => sum + Number(e.amountDinar), 0);
    const subtotal = Number(o.orderSubtotal || 0);
    return {
      ...o,
      totalPaid,
      debtAmount: subtotal - totalPaid,
    };
  });

  const totalDebtsSum = debtOrders.reduce((sum, o) => sum + o.debtAmount, 0);

  const baseAuth = { p: p!, exp: exp || "", s: s! };

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-24 text-slate-800" dir="rtl">
      <div className="kse-app-inner mx-auto max-w-lg space-y-5">
        <header className="kse-glass-dark rounded-2xl border border-rose-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-slate-900">ديون المحلات</h1>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-500">إجمالي الديون</p>
              <p className="text-lg font-black text-rose-600">{formatDinarAsAlfWithUnit(totalDebtsSum)}</p>
            </div>
          </div>
        </header>

        {debtOrders.length === 0 ? (
          <div className="kse-glass-dark rounded-2xl p-12 text-center text-slate-500 border border-dashed border-slate-300">
            <p className="text-lg font-bold">لا توجد ديون مسجلة حالياً</p>
          </div>
        ) : (
          <div className="space-y-3">
            {debtOrders.map(order => (
              <div key={order.id} className="kse-glass-dark rounded-2xl border border-slate-200 p-4 shadow-sm bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-black text-indigo-600">#{order.orderNumber}</span>
                    <h3 className="font-black text-slate-900">{order.shop.name}</h3>
                    <p className="text-xs text-slate-500">{order.customerRegion?.name || "منطقة غير محددة"}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-400">المتبقي للمحل</p>
                    <p className="text-base font-black text-rose-600">{formatDinarAsAlfWithUnit(order.debtAmount)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 border-t border-slate-50 pt-3">
                   <div className="text-xs font-bold text-slate-400">
                     الحساب: {formatDinarAsAlfWithUnit(order.orderSubtotal)} | المدفوع: {formatDinarAsAlfWithUnit(order.totalPaid)}
                   </div>

                   <form action={async (formData) => {
                     "use server";
                     await hideOrderFromPreparerDebtsAction(null, formData);
                   }}>
                     <input type="hidden" name="p" value={baseAuth.p} />
                     <input type="hidden" name="exp" value={baseAuth.exp} />
                     <input type="hidden" name="s" value={baseAuth.s} />
                     <input type="hidden" name="orderId" value={order.id} />
                     <button
                        type="submit"
                        className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-200 transition-colors"
                     >
                       إخفاء
                     </button>
                   </form>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="fixed bottom-6 left-0 right-0 px-4 pointer-events-none">
          <div className="mx-auto max-w-lg pointer-events-auto">
            <a
              href={`/preparer/wallet?${new URLSearchParams(baseAuth).toString()}`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-xl shadow-slate-200 transition hover:bg-slate-800"
            >
              العودة للمحفظة
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
