import { cookies } from "next/headers";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";
import { MandoubNotificationsDiagnosticsFullPage } from "./notifications-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إعدادات الإشعارات - المندوب",
};

type Props = {
  searchParams: Promise<{
    c?: string;
    exp?: string;
    s?: string;
  }>;
};

export default async function MandoubNotificationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  const c = sp.c || cookieStore.get("mandoub_c")?.value;
  const s = sp.s || cookieStore.get("mandoub_s")?.value;
  const exp = sp.exp || cookieStore.get("mandoub_exp")?.value;

  const v = verifyDelegatePortalQuery(c, exp, s);

  if (!v.ok) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800 min-h-screen flex items-center justify-center">
        <div className="kse-app-inner mx-auto max-w-md w-full">
          <div className="kse-glass-dark rounded-3xl border border-rose-300 p-8 text-center shadow-xl">
            <p className="text-xl font-black text-rose-700">لا يمكن فتح الصفحة</p>
            <p className="mt-3 text-sm text-slate-600 font-medium">الرابط غير صالح أو انتهت صلاحيته.</p>
          </div>
        </div>
      </div>
    );
  }

  const courier = await prisma.courier.findUnique({
    where: { id: v.courierId },
    select: { id: true, name: true, phone: true, blocked: true },
  });

  if (!courier || courier.blocked) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800 min-h-screen flex items-center justify-center">
        <div className="kse-app-inner mx-auto max-w-md w-full">
          <div className="kse-glass-dark rounded-3xl border border-rose-300 p-8 text-center shadow-xl">
            <p className="text-xl font-black text-rose-800">الحساب معطل أو غير موجود</p>
          </div>
        </div>
      </div>
    );
  }

  const auth = { c: c!, exp: exp || "", s: s! };

  return (
    <MandoubNotificationsDiagnosticsFullPage auth={auth} courierName={courier.name} />
  );
}
