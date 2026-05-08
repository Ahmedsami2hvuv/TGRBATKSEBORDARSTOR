import { NextResponse } from "next/server";
import type { PortalChatRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { actorKey, resolvePortalChatActor } from "@/lib/portal-chat-auth";
import { runPortalChatRetentionCleanup } from "@/lib/portal-chat-retention";

import { isChatEnabledGlobally } from "@/lib/portal-chat-settings";

type ThreadCreatePayload = { role?: PortalChatRole; actorId?: string; actorName?: string };

function logChatGuard(event: string, meta: Record<string, unknown>) {
  console.warn("[portal-chat][guard][threads]", event, meta);
}

function toUniqueKey(a: { role: PortalChatRole; actorId: string }, b: { role: PortalChatRole; actorId: string }): string {
  return [actorKey(a.role, a.actorId), actorKey(b.role, b.actorId)].sort().join("|");
}

async function resolveTarget(payload: ThreadCreatePayload | undefined, actorRole: PortalChatRole) {
  const role = payload?.role;
  const actorId = String(payload?.actorId || "").trim();
  if (!role || !actorId) return null;

  // التحقق من صلاحية العلاقة
  const allowed = {
    admin: ["mandoub", "preparer"],
    mandoub: ["admin", "preparer"],
    preparer: ["admin", "mandoub"],
    supplier: []
  };

  if (!allowed[actorRole as keyof typeof allowed]?.includes(role)) {
    return null;
  }

  if (role === "admin" && actorId === "admin") return { role, actorId, actorName: "الإدارة" };
  if (role === "mandoub") {
    const row = await prisma.courier.findUnique({ where: { id: actorId }, select: { id: true, name: true, blocked: true } });
    if (!row || row.blocked) return null;
    return { role, actorId: row.id, actorName: row.name };
  }
  if (role === "preparer") {
    const row = await prisma.companyPreparer.findUnique({ where: { id: actorId }, select: { id: true, name: true, active: true } });
    if (!row || !row.active) return null;
    return { role, actorId: row.id, actorName: row.name };
  }
  return null;
}

export async function POST(req: Request) {
  try {
    if (!(await isChatEnabledGlobally())) {
      return NextResponse.json({ ok: false, error: "chat_disabled" }, { status: 403 });
    }
    await runPortalChatRetentionCleanup();
    const body = (await req.json()) as { auth?: any; target?: ThreadCreatePayload };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) {
      logChatGuard("unauthorized_actor_post", { hasAuth: Boolean(body.auth), target: body.target ?? null });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const target = await resolveTarget(body.target, actor.role);
    if (!target) {
      logChatGuard("target_not_found", { actorRole: actor.role, target: body.target ?? null });
      return NextResponse.json({ ok: false, error: "target_not_found" }, { status: 404 });
    }
    if (target.role === actor.role && target.actorId === actor.actorId) {
      return NextResponse.json({ ok: false, error: "self_chat_not_allowed" }, { status: 400 });
    }

    const uniqueKey = toUniqueKey(actor, target);
    const thread = await prisma.portalChatThread.upsert({
      where: { uniqueKey },
      create: {
        uniqueKey,
        participants: {
          create: [
            { role: actor.role, actorId: actor.actorId, actorName: actor.actorName, lastReadAt: new Date() },
            { role: target.role, actorId: target.actorId, actorName: target.actorName },
          ],
        },
      },
      update: {},
      select: { id: true },
    });

    return NextResponse.json({ ok: true, threadId: thread.id });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!(await isChatEnabledGlobally())) {
      return NextResponse.json({ ok: false, error: "chat_disabled", threads: [] });
    }
    await runPortalChatRetentionCleanup();
    const body = (await req.json()) as { auth?: any };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) {
      logChatGuard("unauthorized_actor_put", { hasAuth: Boolean(body.auth) });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const myParts = await prisma.portalChatParticipant.findMany({
      where: { role: actor.role, actorId: actor.actorId },
      select: { threadId: true, lastReadAt: true },
    });
    const threadIds = myParts.map((p) => p.threadId);
    if (threadIds.length === 0) return NextResponse.json({ ok: true, threads: [] });

    const lastReadMap = new Map(myParts.map((p) => [p.threadId, p.lastReadAt]));
    const threads = await prisma.portalChatThread.findMany({
      where: { id: { in: threadIds } },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 80,
    });

    const data = await Promise.all(
      threads.map(async (t) => {
        const other = t.participants.find((p) => !(p.role === actor.role && p.actorId === actor.actorId));
        const lastReadAt = lastReadMap.get(t.id) ?? null;
        const unreadCount = await prisma.portalChatMessage.count({
          where: {
            threadId: t.id,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
            NOT: { senderRole: actor.role, senderId: actor.actorId },
          },
        });
        return {
          id: t.id,
          lastMessageAt: t.lastMessageAt,
          lastMessage: t.messages[0]
            ? {
                body: t.messages[0].body,
                senderName: t.messages[0].senderName,
                createdAt: t.messages[0].createdAt,
              }
            : null,
          peer: other
            ? {
                role: other.role,
                actorId: other.actorId,
                actorName: other.actorName,
              }
            : null,
          unreadCount,
        };
      }),
    );

    return NextResponse.json({ ok: true, threads: data });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
