import { cookies } from "next/headers";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";
import CourierSettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إعدادات المندوب",
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

export default async function MandoubSettingsPage({ searchParams }: Props) {
  try {
    const sp = await searchParams;
    const cookieStore = await cookies();

    // محاولة القراءة من الرابط أو الكوكيز
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
        phone: true,
        blocked: true,
        showLocationBtn: true,
        showDoorBtn: true,
        showCallBtn: true,
        showWhatsAppBtn: true,
        showMoneyBoxes: true,
        showNotesBtn: true,
        showVoiceNotesBtn: true,
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

    const initialSettings = {
      showLocationBtn: courier.showLocationBtn,
      showDoorBtn: courier.showDoorBtn,
      showCallBtn: courier.showCallBtn,
      showWhatsAppBtn: courier.showWhatsAppBtn,
      showMoneyBoxes: courier.showMoneyBoxes,
      showNotesBtn: courier.showNotesBtn,
      showVoiceNotesBtn: courier.showVoiceNotesBtn,
    };

    const auth = {
      c: c!,
      exp: exp || "",
      s: s!,
    };

    return (
      <CourierSettingsClient
        courierName={courier.name}
        courierPhone={courier.phone}
        initialSettings={initialSettings}
        auth={auth}
      />
    );
  } catch (error) {
    console.error("[MandoubSettingsPage] Unexpected render error", error);
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800 min-h-screen flex items-center justify-center">
        <div className="kse-app-inner mx-auto max-w-md w-full">
          <div className="kse-glass-dark rounded-3xl border border-rose-300 p-8 text-center shadow-xl">
            <p className="text-xl font-black text-rose-700">تعذر فتح الإعدادات حالياً</p>
            <p className="mt-3 text-sm text-slate-600 font-medium">
              حدث خطأ فني غير متوقع. أعد تحميل الصفحة، وإذا استمرت تواصل مع الإدارة.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
