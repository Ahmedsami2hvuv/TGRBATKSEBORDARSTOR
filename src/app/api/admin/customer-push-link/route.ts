import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { getPublicAppUrl } from "@/lib/app-url";
import { signCustomerPush } from "@/lib/customer-push-token";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** ينشئ رابط تفعيل إشعارات Web Push لزبون (جدول Customer) — للإدارة فقط */
export async function GET(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("customerId")?.trim();
  if (!id) {
    return NextResponse.json({ error: "missing_customerId" }, { status: 400 });
  }

  const c = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!c) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let sig: string;
  try {
    sig = signCustomerPush(id);
  } catch {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const base = getPublicAppUrl();
  const u = new URL("/client/push", `${base}/`);
  u.searchParams.set("cid", id);
  u.searchParams.set("sig", sig);

  return NextResponse.json({ url: u.toString() });
}
