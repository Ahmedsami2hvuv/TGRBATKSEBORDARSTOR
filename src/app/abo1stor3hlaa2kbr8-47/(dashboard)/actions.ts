"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { getCurrentSessionName } from "@/lib/admin-session";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function logout() {
  const jar = await cookies();
  jar.delete(adminCookieName);
  redirect(`${SECRET_ADMIN_PATH}/login`);
}

export async function testTelegramAction() {
  const text = [
    "✅ <b>اختبار تيليجرام</b>",
    "",
    "تم إرسال هذه الرسالة من لوحة الإدارة.",
    "",
    `البوت: @${process.env.TELEGRAM_BOT_USERNAME ?? "غير_مضبوط"}`,
  ].join("\n");
  const r = await sendTelegramMessage(text);
  if (!r.ok) {
    redirect(
      `${SECRET_ADMIN_PATH}?tg=err&reason=${encodeURIComponent(r.error ?? "فشل الإرسال")}`,
    );
  }
  redirect(`${SECRET_ADMIN_PATH}?tg=ok`);
}

export async function getSidebarUsageAction(): Promise<Record<string, number>> {
  try {
    const adminName = await getCurrentSessionName();
    const target = `admin:${adminName}`;
    const section = "sidebar-usage";

    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target, section }
      }
    });

    if (!setting) {
      return {};
    }

    return (setting.config as Record<string, number>) || {};
  } catch (e) {
    console.error("Error fetching sidebar usage from database:", e);
    return {};
  }
}

export async function saveSidebarUsageAction(usage: Record<string, number>): Promise<boolean> {
  try {
    const adminName = await getCurrentSessionName();
    const target = `admin:${adminName}`;
    const section = "sidebar-usage";

    await prisma.uISystemSetting.upsert({
      where: {
        target_section: { target, section }
      },
      update: { config: usage },
      create: { target, section, config: usage }
    });

    return true;
  } catch (e) {
    console.error("Error saving sidebar usage to database:", e);
    return false;
  }
}
