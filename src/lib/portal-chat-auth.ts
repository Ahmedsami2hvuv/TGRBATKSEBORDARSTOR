import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import type { PortalChatRole } from "@prisma/client";

export type PortalChatActor = {
  role: PortalChatRole;
  actorId: string;
  actorName: string;
};

type BodyAuth = {
  mandoub?: { c?: string; exp?: string; s?: string };
  preparer?: { p?: string; exp?: string; s?: string };
  supplier?: { p?: string; t?: string };
};

export async function resolvePortalChatActor(auth?: BodyAuth): Promise<PortalChatActor | null> {
  const hasExplicitPortalAuth = Boolean(
    auth?.mandoub?.c ||
      auth?.mandoub?.s ||
      auth?.preparer?.p ||
      auth?.preparer?.s ||
      auth?.supplier?.p ||
      auth?.supplier?.t,
  );

  // Important: always prefer explicit portal auth first.
  // Otherwise, if admin cookie exists in same browser, all portal users
  // may be resolved as admin and see wrong chats.
  const m = auth?.mandoub;
  if (m?.c && m?.s) {
    const v = verifyDelegatePortalQuery(m.c, m.exp, m.s);
    if (v.ok) {
      const courier = await prisma.courier.findUnique({
        where: { id: v.courierId },
        select: { id: true, name: true, blocked: true },
      });
      if (courier && !courier.blocked) {
        return { role: "mandoub", actorId: courier.id, actorName: courier.name };
      }
    }
  }

  const p = auth?.preparer;
  if (p?.p && p?.exp && p?.s) {
    const v = verifyCompanyPreparerPortalQuery(p.p, p.exp, p.s);
    if (v.ok) {
      const preparer = await prisma.companyPreparer.findUnique({
        where: { id: v.preparerId },
        select: { id: true, name: true, active: true, portalToken: true },
      });
      if (preparer && preparer.active && preparer.portalToken === v.token) {
        return { role: "preparer", actorId: preparer.id, actorName: preparer.name };
      }
    }
  }

  const s = auth?.supplier;
  if (s?.p && s?.t) {
    const supplier = await prisma.storeSupplier.findFirst({
      where: { id: s.p, portalToken: s.t, active: true },
      select: { id: true, name: true },
    });
    if (supplier) {
      return { role: "supplier", actorId: supplier.id, actorName: supplier.name };
    }
  }

  // If explicit portal auth was provided but invalid, do NOT fallback to admin.
  // This prevents cross-portal leakage when admin cookie exists on same browser.
  if (hasExplicitPortalAuth) {
    return null;
  }

  // Fallback to admin only when no portal auth was provided at all.
  if (await isAdminSession()) {
    return { role: "admin", actorId: "admin", actorName: "الإدارة" };
  }

  return null;
}

export function actorKey(role: PortalChatRole, actorId: string): string {
  return `${role}:${actorId}`;
}
