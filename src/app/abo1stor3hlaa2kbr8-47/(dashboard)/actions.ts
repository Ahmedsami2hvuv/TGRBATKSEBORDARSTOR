"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";

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
