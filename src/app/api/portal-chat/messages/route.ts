import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePortalChatActor } from "@/lib/portal-chat-auth";
import { runPortalChatRetentionCleanup } from "@/lib/portal-chat-retention";
import { pushNotifyChatNewMessage } from "@/lib/web-push-server";
import { assertChatEnabled, handleResourceDisabledError } from "@/lib/portal-chat-settings";

function logChatGuard(event: string, meta: Record<string, unknown>) {
  console.warn("[portal-chat][guard][messages]", event, meta);
}

export async function POST(req: Request) {
  try {
    await assertChatEnabled();
    await runPortalChatRetentionCleanup();
    const body = (await req.json()) as { auth?: any; threadId?: string; text?: string };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) {
      logChatGuard("unauthorized_actor_post", { hasAuth: Boolean(body.auth), threadId: body.threadId ?? null });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const threadId = String(body.threadId || "").trim();
    const text = String(body.text || "").trim();
    if (!threadId || !text) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

    const member = await prisma.portalChatParticipant.findFirst({
      where: { threadId, role: actor.role, actorId: actor.actorId },
      select: { id: true },
    });
    if (!member) {
      logChatGuard("forbidden_post", { threadId, actorRole: actor.role, actorId: actor.actorId });
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const now = new Date();
    const [msg] = await prisma.$transaction([
      prisma.portalChatMessage.create({
        data: {
          threadId,
          senderRole: actor.role,
          senderId: actor.actorId,
          senderName: actor.actorName,
          body: text.slice(0, 2000),
        },
      }),
      prisma.portalChatThread.update({
        where: { id: threadId },
        data: { lastMessageAt: now },
      }),
      prisma.portalChatParticipant.updateMany({
        where: { threadId, role: actor.role, actorId: actor.actorId },
        data: { lastReadAt: now },
      }),
    ]);

    // Send push notification to other participants
    const others = await prisma.portalChatParticipant.findMany({
      where: { threadId, NOT: { role: actor.role, actorId: actor.actorId } },
      select: { role: true, actorId: true },
    });

    for (const other of others) {
      await pushNotifyChatNewMessage({
        targetRole: other.role as any,
        targetActorId: other.actorId,
        senderName: actor.actorName,
        text,
        threadId,
      }).catch((e) => console.error("[portal-chat] push notify failed:", e));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleResourceDisabledError(error);
  }
}

export async function PUT(req: Request) {
  try {
    await assertChatEnabled();
    await runPortalChatRetentionCleanup();
    const body = (await req.json()) as { auth?: any; threadId?: string };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) {
      logChatGuard("unauthorized_actor_put", { hasAuth: Boolean(body.auth), threadId: body.threadId ?? null });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const threadId = String(body.threadId || "").trim();
    if (!threadId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

    const member = await prisma.portalChatParticipant.findFirst({
      where: { threadId, role: actor.role, actorId: actor.actorId },
      select: { id: true },
    });
    if (!member) {
      logChatGuard("forbidden_put", { threadId, actorRole: actor.role, actorId: actor.actorId });
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const rows = await prisma.portalChatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: 150,
      select: {
        id: true,
        body: true,
        senderId: true,
        senderName: true,
        senderRole: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, messages: rows });
  } catch (error) {
    return handleResourceDisabledError(error);
  }
}
