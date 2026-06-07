import { cookies } from "next/headers";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";
import FontSizeCustomizer from "../font-size-customizer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تعديل حجم الخط والأزرار - المندوب",
};

function invalidLinkMessage(reason: string): string {
  switch (reason) {
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح. يرجى فتح الرابط الأصلي المرسل إليك.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل. تواصل مع الإدارة.";
    default:
      return "الرابط غير صالح أو انتهت صلاحيته.";
  }
}

type Props = {
  searchParams: Promise<{
    c?: string;
    exp?: string;
    s?: string;
  }>;
};

export default async function MandoubFontSizePage({ searchParams }: Props) {
  try {
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
              <p className="text-xl font-black text-rose-700">لا يمكن فتح الإعدادات</p>
              <p className="mt-3 text-sm text-slate-600 font-medium">{invalidLinkMessage(v.reason)}</p>
            </div>
          </div>
        </div>
      );
    }

    const courier = await prisma.courier.findUnique({
      where: { id: v.courierId },
      select: {
        id: true,
        name: true,
        blocked: true,
      },
    });

    if (!courier || courier.blocked) {
      return (
        <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800 min-h-screen flex items-center justify-center">
          <div className="kse-app-inner mx-auto max-w-md w-full">
            <div className="kse-glass-dark rounded-3xl border border-rose-300 p-8 text-center shadow-xl">
              <p className="text-xl font-black text-rose-800">الحساب معطل أو غير موجود</p>
              <p className="mt-2 text-sm text-slate-600 font-medium">يرجى مراجعة إدارة النظام لتفعيل الحساب.</p>
            </div>
          </div>
        </div>
      );
    }

    const auth = {
      c: c!,
      exp: exp || "",
      s: s!,
    };

    const baseQuery = new URLSearchParams();
    baseQuery.set("c", auth.c);
    if (auth.exp) baseQuery.set("exp", auth.exp);
    baseQuery.set("s", auth.s);

    return (
      <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-slate-800 dark:text-slate-100">
        <div className="kse-app-inner mx-auto max-w-2xl px-4 py-6 pb-24">
          {/* Header */}
          <header className="kse-glass-dark mb-6 flex items-center gap-3 border border-sky-200/90 dark:border-[#00f3ff]/20 px-4 py-3.5 shadow-md rounded-2xl">
            <Link
              href={`/mandoub/settings?${baseQuery.toString()}`}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title="رجوع للإعدادات"
            >
              <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black text-slate-900 dark:text-[#00f3ff]">حجم الخط والأزرار</h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">تخصيص خط وحجم حساب: {courier.name}</p>
            </div>
          </header>

          <section className="kse-glass-dark border border-slate-200 dark:border-[#00f3ff]/20 rounded-2xl p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">تخصيص حجم الخط والأزرار للمندوب</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">قم بتعديل أحجام العناصر عبر المؤشرات أدناه لتلائم استخدامك الشخصي للهاتف</p>
            </div>
            <FontSizeCustomizer onClose={null as any} isPageMode={true} authQuery={`?${baseQuery.toString()}`} />
          </section>
        </div>
      </div>
    );
  } catch (error) {
    console.error("[MandoubFontSizePage] Unexpected render error", error);
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800 min-h-screen flex items-center justify-center">
        <div className="kse-app-inner mx-auto max-w-md w-full">
          <div className="kse-glass-dark rounded-3xl border border-rose-300 p-8 text-center shadow-xl">
            <p className="text-xl font-black text-rose-700">تعذر فتح الإعدادات حالياً</p>
            <p className="mt-3 text-sm text-slate-600 font-medium">حدث خطأ فني غير متوقع.</p>
          </div>
        </div>
      </div>
    );
  }
}
