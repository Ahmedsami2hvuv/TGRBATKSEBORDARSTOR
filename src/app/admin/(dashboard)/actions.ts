"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";

export async function logout() {
  const jar = await cookies();
  jar.delete(adminCookieName);
  redirect("/admin/login");
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
      `/admin?tg=err&reason=${encodeURIComponent(r.error ?? "فشل الإرسال")}`,
    );
  }
  redirect("/admin?tg=ok");
}
