import { cookies } from "next/headers";
import { adminCookieName, verifyAdminToken } from "@/lib/auth";

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
