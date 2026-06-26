import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { serializePrisma } from "@/lib/serialize-prisma";
import { CompletedDraftsClient } from "./completed-drafts-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; exp?: string; s?: string; q?: string }>;
};

export default async function PreparerCompletedPreparationPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  // جلب بيانات التوثيق من الرابط أو الكوكيز
  const p = sp.p || (await cookieStore).get("preparer_p")?.value;
  const exp = sp.exp || (await cookieStore).get("preparer_exp")?.value;
  const s = sp.s || (await cookieStore).get("preparer_s")?.value;

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح أو انتهت صلاحيته.</div>;
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
  });

  if (!preparer) {
    return <div className="p-8 text-center font-bold text-rose-600">الحساب غير متاح أو تم تعطيله.</div>;
  }

  const preparerId = preparer.id;
  const auth = { p: p!, exp: exp!, s: s! };
  const backHref = preparerPath("/preparer/preparation", auth);

  // جلب المسودات المكتملة (الحالة sent أو archived)
  const draftsRaw = await prisma.companyPreparerShoppingDraft.findMany({
    where: {
      preparerId,
      status: { in: ["sent", "archived"] },
    },
    include: {
      customerRegion: {
        select: { name: true }
      }
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // تعقيم البيانات لمنع أخطاء السيريالايز والخصوصية
  const isLikelyPhone = (text: string) => /^[0-9+ \-()]{7,15}$/.test(text.trim());
  
  const serializedDrafts = draftsRaw.map((d) => {
    return {
      id: d.id,
      draftNumber: d.draftNumber,
      titleLine: d.titleLine && isLikelyPhone(d.titleLine) ? "طلب مسعر" : d.titleLine,
      status: d.status,
      customerName: d.customerName && isLikelyPhone(d.customerName) ? "" : d.customerName,
      customerRegionName: d.customerRegion?.name || "منطقة غير حددتها",
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      data: d.data, // يحتوي على المنتجات والأسعار
      sentOrderId: d.sentOrderId
    };
  });

  const safeDrafts = serializePrisma(serializedDrafts);

  return (
    <div className="kse-app-inner mx-auto max-w-4xl px-3 py-4 pb-24 sm:px-4">
      <CompletedDraftsClient
        initialDrafts={safeDrafts}
        auth={auth}
        backHref={backHref}
        preparerName={preparer.name}
      />
    </div>
  );
}
