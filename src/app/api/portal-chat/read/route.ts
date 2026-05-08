import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePortalChatActor } from "@/lib/portal-chat-auth";
import { runPortalChatRetentionCleanup } from "@/lib/portal-chat-retention";

function logChatGuard(event: string, meta: Record<string, unknown>) {
  console.warn("[portal-chat][guard][read]", event, meta);
}

export async function POST(req: Request) {
  try {
    await runPortalChatRetentionCleanup();
    const body = (await req.json()) as { auth?: any; threadId?: string };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) {
      logChatGuard("unauthorized_actor", { hasAuth: Boolean(body.auth), threadId: body.threadId ?? null });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const threadId = String(body.threadId || "").trim();
    if (!threadId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

    const updated = await prisma.portalChatParticipant.updateMany({
      where: { threadId, role: actor.role, actorId: actor.actorId },
      data: { lastReadAt: new Date() },
    });
    if (updated.count === 0) {
      logChatGuard("forbidden_read_mark", { threadId, actorRole: actor.role, actorId: actor.actorId });
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
