import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePortalChatActor } from "@/lib/portal-chat-auth";
import { runPortalChatRetentionCleanup } from "@/lib/portal-chat-retention";

export async function POST(req: Request) {
  try {
    await runPortalChatRetentionCleanup();
    const body = (await req.json()) as { auth?: any; threadId?: string };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const threadId = String(body.threadId || "").trim();
    if (!threadId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

    await prisma.portalChatParticipant.updateMany({
      where: { threadId, role: actor.role, actorId: actor.actorId },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
