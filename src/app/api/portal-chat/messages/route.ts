import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePortalChatActor } from "@/lib/portal-chat-auth";
import { runPortalChatRetentionCleanup } from "@/lib/portal-chat-retention";

export async function POST(req: Request) {
  try {
    await runPortalChatRetentionCleanup();
    const body = (await req.json()) as { auth?: any; threadId?: string; text?: string };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const threadId = String(body.threadId || "").trim();
    const text = String(body.text || "").trim();
    if (!threadId || !text) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

    const member = await prisma.portalChatParticipant.findFirst({
      where: { threadId, role: actor.role, actorId: actor.actorId },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const now = new Date();
    await prisma.$transaction([
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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await runPortalChatRetentionCleanup();
    const body = (await req.json()) as { auth?: any; threadId?: string };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const threadId = String(body.threadId || "").trim();
    if (!threadId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

    const member = await prisma.portalChatParticipant.findFirst({
      where: { threadId, role: actor.role, actorId: actor.actorId },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

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
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
