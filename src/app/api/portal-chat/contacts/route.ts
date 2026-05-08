import { NextResponse } from "next/server";
import type { PortalChatRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePortalChatActor } from "@/lib/portal-chat-auth";

type Contact = { role: PortalChatRole; actorId: string; actorName: string };

function allowedTargets(role: PortalChatRole): PortalChatRole[] {
  if (role === "admin") return ["mandoub", "preparer", "supplier", "admin"];
  if (role === "mandoub") return ["admin", "mandoub", "preparer", "supplier"];
  if (role === "preparer") return ["admin", "mandoub", "preparer", "supplier"];
  return ["admin", "mandoub", "preparer", "supplier"];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { auth?: any };
    const actor = await resolvePortalChatActor(body.auth);
    if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const targets = allowedTargets(actor.role);
    const out: Contact[] = [];

    if (targets.includes("admin")) {
      out.push({ role: "admin", actorId: "admin", actorName: "الإدارة" });
    }
    if (targets.includes("mandoub")) {
      const rows = await prisma.courier.findMany({
        where: { blocked: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 50,
      });
      for (const r of rows) out.push({ role: "mandoub", actorId: r.id, actorName: r.name });
    }
    if (targets.includes("preparer")) {
      const rows = await prisma.companyPreparer.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 50,
      });
      for (const r of rows) out.push({ role: "preparer", actorId: r.id, actorName: r.name });
    }
    if (targets.includes("supplier")) {
      const rows = await prisma.storeSupplier.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 50,
      });
      for (const r of rows) out.push({ role: "supplier", actorId: r.id, actorName: r.name });
    }

    const filtered = out.filter((c) => !(c.role === actor.role && c.actorId === actor.actorId));
    return NextResponse.json({ ok: true, contacts: filtered });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
