import Link from "next/link";
import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { prisma } from "@/lib/prisma";
import { PreparerClientOrderForm } from "../../preparer-client-order-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; exp?: string; s?: string }>;
};

function invalidMsg(reason: string) {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط. اطلب رابطاً جديداً من الإدارة.";
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. تأكد من نسخه كاملًا.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
    default:
      return "تعذّر التحقق.";
  }
}

export default async function PreparerOrderNewPage({ searchParams }: Props) {
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
          <p className="text-lg font-bold text-rose-700">لا يمكن فتح الصفحة</p>
          <p className="mt-2 text-sm text-slate-600">{invalidMsg(v.reason)}</p>
        </div>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: {
      shopLinks: {
        where: { canSubmitOrders: true },
        include: { shop: { include: { region: true } } },
      },
    },
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

  const auth = { p: p!, exp: exp!, s: s! };
  const homeHref = preparerPath("/preparer", auth);

  const shops = preparer.shopLinks.map((l) => ({
    id: l.shop.id,
    name: l.shop.name,
    photoUrl: l.shop.photoUrl,
    shopRegionName: l.shop.region.name,
    shopDeliveryAlf: Number(l.shop.region.deliveryPrice.toString()) / ALF_PER_DINAR,
  }));

  if (shops.length === 0) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-950">
          لا يوجد محل مفعّل لك «صلاحية رفع الطلب». اطلب من الإدارة تفعيلها من قسم المجهزين.
        </p>
      </div>
    );
  }

  return (
    <div className="kse-app-inner mx-auto max-w-lg px-3 py-4 pb-24 sm:px-4">
      <p className="mb-3 text-sm">
        <Link href={homeHref} className="font-bold text-sky-800 hover:underline">
          ← الطلبات
        </Link>
      </p>
      <header className="kse-glass-dark mb-4 rounded-2xl border border-sky-200/90 p-4 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">طلب جديد</h1>
        <p className="mt-1 text-sm text-slate-600">
          المحلات المعروضة فقط هي التي فُعّلت لك «صلاحية رفع الطلب» من الإدارة.
        </p>
      </header>
      <PreparerClientOrderForm auth={auth} preparerName={preparer.name} shops={shops} ordersHref={homeHref} />
    </div>
  );
}
