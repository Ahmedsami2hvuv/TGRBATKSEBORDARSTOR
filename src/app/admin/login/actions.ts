"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, signAdminToken } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  /** trim يقلّل أخطاء النسخ والمسافات الزائدة (ويب فيو / موبايل / Railway) */
  const password = String(formData.get("password") ?? "").trim();
  const expectedRaw = process.env.ADMIN_PASSWORD;
  const expected = expectedRaw?.trim();
  if (!expected) {
    return { error: "ADMIN_PASSWORD غير مضبوط في الخادم" };
  }
  if (password !== expected) {
    return { error: "كلمة المرور غير صحيحة" };
  }
  let token: string;
  try {
    token = await signAdminToken();
  } catch {
    return { error: "ADMIN_SESSION_SECRET غير مضبوط أو قصير جداً" };
  }
  const jar = await cookies();
  jar.set(adminCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin");
}
