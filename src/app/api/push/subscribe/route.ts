import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { verifyCustomerPushSignature } from "@/lib/customer-push-token";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Body = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  audience?: "admin" | "mandoub" | "employee" | "customer";
  mandoub?: { c?: string; exp?: string; s?: string };
  /** رابط موظف المحل (رفع الطلب) — ليس فريق المجهزين */
  portal?: { e?: string; exp?: string; s?: string };
  customer?: { customerId?: string; sig?: string };
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sub = body.subscription;
  const endpoint = sub?.endpoint?.trim();
  const p256dh = sub?.keys?.p256dh?.trim();
  const auth = sub?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "missing_subscription" }, { status: 400 });
  }

  const audience = body.audience;
  if (
    audience !== "admin" &&
    audience !== "mandoub" &&
    audience !== "employee" &&
    audience !== "customer"
  ) {
    return NextResponse.json({ error: "bad_audience" }, { status: 400 });
  }

  let courierId: string | null = null;
  let employeeId: string | null = null;
  let customerId: string | null = null;

  if (audience === "admin") {
    if (!(await isAdminSession())) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (audience === "mandoub") {
    const m = body.mandoub;
    const v = verifyDelegatePortalQuery(m?.c, m?.exp, m?.s);
    if (!v.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    courierId = v.courierId;
  } else if (audience === "employee") {
    const p = body.portal;
    const v = verifyEmployeeOrderPortalQuery(p?.e, p?.exp, p?.s);
    if (!v.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    employeeId = v.employeeId;
  } else {
    const cid = body.customer?.customerId?.trim();
    const sig = body.customer?.sig?.trim();
    if (!cid || !sig) {
      return NextResponse.json({ error: "missing_customer_proof" }, { status: 400 });
    }
    if (!verifyCustomerPushSignature(cid, sig)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const cust = await prisma.customer.findUnique({ where: { id: cid }, select: { id: true } });
    if (!cust) {
      return NextResponse.json({ error: "customer_not_found" }, { status: 404 });
    }
    customerId = cid;
  }

  await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh,
      auth,
      audience,
      courierId: audience === "mandoub" ? courierId : null,
      employeeId: audience === "employee" ? employeeId : null,
      customerId: audience === "customer" ? customerId : null,
    },
    update: {
      p256dh,
      auth,
      audience,
      courierId: audience === "mandoub" ? courierId : null,
      employeeId: audience === "employee" ? employeeId : null,
      customerId: audience === "customer" ? customerId : null,
    },
  });

  return NextResponse.json({ ok: true });
}
