import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { sendTestPushBroadcast, type TestPushAudience } from "@/lib/web-push-server";

export const runtime = "nodejs";

const ALL: TestPushAudience[] = ["admin", "mandoub", "employee", "customer"];

function normalizeAudiences(raw: unknown): TestPushAudience[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<TestPushAudience>();
  for (const x of raw) {
    if (x === "admin" || x === "mandoub" || x === "employee" || x === "customer") {
      set.add(x);
    }
  }
  return ALL.filter((a) => set.has(a));
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { title?: string; body?: string; audiences?: unknown };
  try {
    body = (await req.json()) as { title?: string; body?: string; audiences?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim() || "اختبار إشعار";
  const text = String(body.body ?? "").trim() || "هذا إشعار تجريبي من لوحة الإدارة.";
  const audiences = normalizeAudiences(body.audiences);

  if (audiences.length === 0) {
    return NextResponse.json({ error: "no_audiences" }, { status: 400 });
  }

  const result = await sendTestPushBroadcast({ title, body: text, audiences });
  return NextResponse.json(result);
}
