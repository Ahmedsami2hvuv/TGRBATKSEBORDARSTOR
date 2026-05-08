import { NextResponse } from "next/server";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { audienceSettings, getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { withEphemeralCache } from "@/lib/ephemeral-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const p = searchParams.get("p") ?? "";
  const exp = searchParams.get("exp") ?? undefined;
  const s = searchParams.get("s") ?? "";
  const v = verifyCompanyPreparerPortalQuery(p, exp, s);
  if (!v.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [count, latest, settingsRow] = await withEphemeralCache(
    `notif:preparer:${v.preparerId}:notices`,
    4000,
    () =>
      Promise.all([
        prisma.companyPreparerPrepNotice.count({
          where: { preparerId: v.preparerId, dismissedAt: null },
        }),
        prisma.companyPreparerPrepNotice.findFirst({
          where: { preparerId: v.preparerId, dismissedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, body: true },
        }),
        getOrCreateNotificationSettings(),
      ]),
  );
  const settings = audienceSettings(settingsRow, "preparer");

  return NextResponse.json({
    noticesCount: count,
    latestTitle: latest?.title ?? "",
    latestBody: latest?.body ?? "",
    latestNoticeId: latest?.id ?? "",
    settings,
  });
}
