import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery, type CompanyPreparerPortalVerifyReason } from "@/lib/company-preparer-portal-link";
import { prisma } from "@/lib/prisma";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { MONEY_KIND_PICKUP } from "@/lib/mandoub-money-events";
import { DebtItemClient } from "./debt-item-client";

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

  const orders = await prisma.order.findMany({
    where: {
      shopId: { in: shopIds },
      preparerDebtHidden: false,
      status: { notIn: ["cancelled"] },
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
    <div
      className="min-h-screen px-4 py-8 pb-24 text-slate-800 relative bg-slate-50"
      dir="rtl"
      style={{
        backgroundImage: `radial-gradient(#e2e8f0 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }}
    >
      <div className="kse-app-inner mx-auto max-w-lg space-y-6 relative z-10">
        <header className="bg-indigo-600 rounded-[2rem] p-6 shadow-xl shadow-indigo-100 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black">تفاصيل الديون</h1>
              <p className="text-indigo-100 text-xs font-bold mt-1 opacity-80">إدارة مستحقات المحلات</p>
            </div>
            <div className="text-left bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
              <p className="text-[10px] font-black text-indigo-100 uppercase tracking-wider mb-1">إجمالي الديون</p>
              <p className="text-2xl font-black tabular-nums">{formatDinarAsAlfWithUnit(totalDebtsSum)}</p>
            </div>
          </div>
        </header>

        {debtOrders.length === 0 ? (
          <div className="bg-white/50 backdrop-blur-sm rounded-[2rem] p-16 text-center text-slate-400 border-2 border-dashed border-slate-200">
            <div className="text-4xl mb-4">✨</div>
            <p className="text-lg font-black">لا توجد ديون حالياً</p>
            <p className="text-sm mt-1">جميع الحسابات مكتملة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {debtOrders.map(order => (
              <DebtItemClient key={order.id} order={order} auth={baseAuth} />
            ))}
          </div>
        )}

        <div className="fixed bottom-6 left-0 right-0 px-4 z-50">
          <div className="mx-auto max-w-lg">
            <a
              href={`/preparer/wallet?${new URLSearchParams(baseAuth).toString()}`}
              className="flex items-center justify-center gap-2 rounded-[2rem] bg-slate-900 py-4 text-sm font-black text-white shadow-2xl shadow-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="text-lg">←</span>
              العودة للمحفظة
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
