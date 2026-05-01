import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { applyPreparerShopLinks } from "@/lib/preparer-shop-links";

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "جسم الطلب غير صالح (JSON)." }, { status: 400 });
  }

  const preparerId =
    typeof body === "object" && body !== null && "preparerId" in body
      ? String((body as { preparerId: unknown }).preparerId ?? "")
      : "";
  const shopIdsRaw =
    typeof body === "object" && body !== null && "shopIds" in body
      ? (body as { shopIds: unknown }).shopIds
      : [];

  const shopIds = Array.isArray(shopIdsRaw)
    ? shopIdsRaw.map((x) => String(x)).filter(Boolean)
    : [];

  const result = await applyPreparerShopLinks(preparerId, shopIds);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
