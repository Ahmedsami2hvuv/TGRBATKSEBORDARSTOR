import { cookies } from "next/headers";
import { verifyCompanyPreparerPortalQuery, buildCompanyPreparerPortalUrl } from "@/lib/company-preparer-portal-link";
import { prisma } from "@/lib/prisma";
import PreparerSettingsClient from "./preparer-settings-client";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { getPublicAppUrl } from "@/lib/app-url";
import { randomBytes } from "crypto";

type Props = {
  searchParams: Promise<{
    p?: string;
    exp?: string;
    s?: string;
  }>;
};

export default async function PreparerSettingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  let p = sp.p;
  let s = sp.s;
  let exp = sp.exp;

  if (!p || !s || !exp) {
    p = p || cookieStore.get("preparer_p")?.value;
    s = s || cookieStore.get("preparer_s")?.value;
    exp = exp || cookieStore.get("preparer_exp")?.value;
  }

  const v = verifyCompanyPreparerPortalQuery(p, exp, s);

  if (!v.ok) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center bg-white dark:bg-[#09090b]">
          <p className="text-lg font-bold text-rose-700">لا يمكن فتح الإعدادات</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">انتهت صلاحية الرابط أو تم تسجيل الدخول من جهاز آخر.</p>
        </div>
      </div>
    );
  }

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
  });

  if (!preparer || preparer.portalToken !== v.token) {
    return (
      <div className="kse-app-inner mx-auto max-w-md px-4 py-16">
        <div className="kse-glass-dark rounded-2xl p-8 text-center bg-white dark:bg-[#09090b]">
          <p className="text-lg font-bold text-slate-800 dark:text-white">الحساب غير متاح</p>
        </div>
      </div>
    );
  }

  const botToken = await getBotTokenByPurpose("preparer");
  const botInfo = botToken ? await fetch(`https://api.telegram.org/bot${botToken}/getMe`).then(r => r.json()).catch(() => null) : null;
  const botUsername = botInfo?.result?.username;

  let telegramLink = null;
  if (botUsername && preparer) {
    const preparerPortalUrl = buildCompanyPreparerPortalUrl(preparer.id, preparer.portalToken, getPublicAppUrl());
    const botStartParam = `pl_${randomBytes(8).toString("hex")}`;
    try {
      await prisma.schemaPlaceholder.create({
        data: {
          id: botStartParam,
          note: preparerPortalUrl,
        },
      });
    } catch (err) {
      console.error("[PreparerSettingsPage] Failed to create telegram placeholder", err);
    }
    telegramLink = `https://t.me/${botUsername}?start=${botStartParam}`;
  }

  const baseAuth = { p: p!, exp: exp || "", s: s! };

  return (
    <PreparerSettingsClient
      preparerName={preparer.name}
      auth={baseAuth}
      availableForAssignment={preparer.availableForAssignment}
      hasPinCode={!!preparer.salaryPinCode}
      pinDisabled={preparer.salaryPinDisabled}
      telegramLink={telegramLink}
    />
  );
}
