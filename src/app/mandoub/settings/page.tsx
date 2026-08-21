import { cookies } from "next/headers";
import { verifyDelegatePortalQuery, buildDelegatePortalUrl } from "@/lib/delegate-link";
import { prisma } from "@/lib/prisma";
import CourierSettingsClient from "./settings-client";
import { getPublicAppUrl } from "@/lib/app-url";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        availableForAssignment: true,
        useFloatingMap: true,
        showLocationBtn: true,
        showDoorBtn: true,
        showCallBtn: true,
        showWhatsAppBtn: true,
        showMoneyBoxes: true,
        showNotesBtn: true,
        showVoiceNotesBtn: true,
        rotate180Photos: true,
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
      useFloatingMap: courier.useFloatingMap,
      showDoorBtn: courier.showDoorBtn,
      showCallBtn: courier.showCallBtn,
      showWhatsAppBtn: courier.showWhatsAppBtn,
      showMoneyBoxes: courier.showMoneyBoxes,
      showNotesBtn: courier.showNotesBtn,
      showVoiceNotesBtn: courier.showVoiceNotesBtn,
      rotate180Photos: courier.rotate180Photos,
    };

    const auth = {
      c: c!,
      exp: exp || "",
      s: s!,
    };

    // جلب وحساب رابط بوت التليجرام
    const botToken = await getBotTokenByPurpose("courier");
    const botInfo = botToken ? await fetch(`https://api.telegram.org/bot${botToken}/getMe`).then(r => r.json()).catch(() => null) : null;
    const botUsername = botInfo?.result?.username;
    const portalUrl = buildDelegatePortalUrl(courier.id, getPublicAppUrl());

    let telegramLink = null;
    if (botUsername) {
      const botStartParam = `pl_${randomBytes(8).toString("hex")}`;
      try {
        await prisma.schemaPlaceholder.create({
          data: {
            id: botStartParam,
            note: portalUrl,
          },
        });
      } catch (err) {
        console.error("[MandoubSettingsPage] Failed to create telegram placeholder", err);
      }
      telegramLink = `https://t.me/${botUsername}?start=${botStartParam}`;
    }
    const userKey = `courier_${courier.id}`;
    const dbBg = await prisma.userBackgroundSelection.findUnique({
      where: { userKey }
    });
    const userBgUrl = dbBg?.imageUrl || null;

    return (
      <CourierSettingsClient
        courierName={courier.name}
        courierPhone={courier.phone}
        initialSettings={initialSettings}
        auth={auth}
        availableForAssignment={courier.availableForAssignment}
        telegramLink={telegramLink}
        userKey={userKey}
        userBgUrl={userBgUrl}
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
