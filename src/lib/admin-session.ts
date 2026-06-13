import { cookies } from "next/headers";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";
import { jwtVerify } from "jose";

export async function isAdminSession(): Promise<boolean> {
  const c = await cookies();
  const t = c.get(adminCookieName)?.value;
  if (!t) return false;
  return verifyAdminToken(t);
}

export async function assertAdminSession(): Promise<void> {
  if (!(await isAdminSession())) {
    throw new Error("ADMIN_UNAUTHORIZED");
  }
}

export async function getCurrentSessionName(): Promise<string> {
  try {
    const c = await cookies();
    const t = c.get(adminCookieName)?.value;
    if (!t) return "النظام";
    const s = process.env.ADMIN_SESSION_SECRET;
    if (!s) return "الإدارة";
    const secret = new TextEncoder().encode(s);
    const { payload } = await jwtVerify(t, secret);
    return (payload.name as string) || "الإدارة";
  } catch {
    return "الإدارة";
  }
}

export async function getCurrentSessionIsAccountant(): Promise<boolean> {
  try {
    const c = await cookies();
    const t = c.get(adminCookieName)?.value;
    if (!t) return false;
    const s = process.env.ADMIN_SESSION_SECRET;
    if (!s) return false;
    const secret = new TextEncoder().encode(s);
    const { payload } = await jwtVerify(t, secret);
    return !!payload.isAccountant;
  } catch {
    return false;
  }
}
