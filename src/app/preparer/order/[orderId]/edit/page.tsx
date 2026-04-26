import Link from "next/link";
import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { dinarDecimalToAlfInputString } from "@/lib/money-alf";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { PreparerOrderEditForm } from "@/app/preparer/preparer-order-edit-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

function invalidMsg(reason: string) {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من الإدارة.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. تأكد من نسخه كاملاً.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
    default:
      return "تعذّر التحقق.";
  }
}

export default async function PreparerOrderEditPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;
  const cookieStore = await cookies();

  // جلب بيانات التوثيق من الرابط أو الكوكيز
  const p = sp.p || (await cookieStore).get("preparer_p")?.value;
  const exp = sp.exp || (await cookieStore).get("preparer_exp")?.value;
  const s = sp.s || (await cookieStore).get("preparer_s")?.value;

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
          <p className="text-lg font-bold text-rose-700">لا يمكن فتح صفحة التعديل</p>
          <p className="mt-2 text-sm text-slate-600">{invalidMsg(v.reason)}</p>
        </div>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { select: { shopId: true } } },
  });
  if (!preparer) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-800">الحساب غير متاح</p>
        </div>
      </div>
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      shopId: true,
      orderType: true,
      customerPhone: true,
      orderSubtotal: true,
      status: true,
    },
  });
  if (!order) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-800">الطلب غير موجود</p>
        </div>
      </div>
    );
  }

  const allowed = preparer.shopLinks.some((l) => l.shopId === order.shopId);
  if (!allowed) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-amber-300 p-8 text-center">
          <p className="text-lg font-bold text-amber-900">لا صلاحية لهذا الطلب</p>
          <p className="mt-2 text-sm text-slate-600">هذا الطلب لمحل غير مرتبط بحسابك.</p>
        </div>
      </div>
    );
  }

  const auth = { p: p!, exp: exp!, s: s! };
  const detailHref = preparerPath(`/preparer/order/${order.id}`, auth);

  return (
    <div className="kse-app-inner mx-auto max-w-lg px-3 py-4 pb-24 sm:px-4">
      <nav className="mb-3 flex items-center gap-2 text-sm text-sky-800">
        <Link href={detailHref} className="font-bold underline decoration-sky-400 hover:text-sky-950">
          ← تفاصيل الطلب
        </Link>
        <span className="text-slate-400">|</span>
        <span className="tabular-nums text-slate-700">#{order.orderNumber}</span>
      </nav>

      <section className="kse-glass-dark rounded-2xl border border-emerald-200/80 p-4 shadow-sm sm:p-5">
        <h1 className="mb-1 text-lg font-black text-slate-900 sm:text-xl">تعديل الطلب</h1>
        <p className="mb-4 text-xs text-slate-500 sm:text-sm">
          يمكنك تعديل نوع الطلب، هاتف الزبون، سعر الطلب، وصور الطلبية/باب المحل.
        </p>
        <PreparerOrderEditForm
          auth={auth}
          orderId={order.id}
          defaults={{
            orderType: order.orderType,
            customerPhone: "",
            orderSubtotalAlf: order.orderSubtotal != null ? dinarDecimalToAlfInputString(order.orderSubtotal) : "",
          }}
        />
      </section>
    </div>
  );
}
