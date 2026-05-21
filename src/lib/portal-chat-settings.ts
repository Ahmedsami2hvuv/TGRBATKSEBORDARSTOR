import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function isChatEnabledGlobally(): Promise<boolean> {
  const setting = await prisma.uISystemSetting.findFirst({
    where: { target: "global", section: "system" },
    select: { chatEnabled: true },
  });
  return setting?.chatEnabled ?? true;
}

export async function isTrackingEnabledGlobally(): Promise<boolean> {
  const setting = await prisma.uISystemSetting.findFirst({
    where: { target: "global", section: "system" },
    select: { trackingEnabled: true },
  });
  return setting?.trackingEnabled ?? true;
}

/**
 * حماية برمجية تمنع تنفيذ الـ Edge Functions إذا كان النظام معطلاً
 */
export async function assertTrackingEnabled() {
  const enabled = await isTrackingEnabledGlobally();
  if (!enabled) {
    throw new Error("GLOBAL_TRACKING_DISABLED");
  }
}

export async function assertChatEnabled() {
  const enabled = await isChatEnabledGlobally();
  if (!enabled) {
    throw new Error("GLOBAL_CHAT_DISABLED");
  }
}

export function handleResourceDisabledError(error: any) {
  if (error.message === "GLOBAL_TRACKING_DISABLED" || error.message === "GLOBAL_CHAT_DISABLED") {
    return new NextResponse(JSON.stringify({ error: "Feature disabled by admin", code: "RESOURCE_DISABLED" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  throw error;
}

export async function setChatEnabledGlobally(enabled: boolean): Promise<void> {
  await prisma.uISystemSetting.upsert({
    where: { target_section: { target: "global", section: "system" } },
    create: { target: "global", section: "system", config: {}, chatEnabled: enabled, trackingEnabled: true },
    update: { chatEnabled: enabled },
  });
}

export async function setTrackingEnabledGlobally(enabled: boolean): Promise<void> {
  await prisma.uISystemSetting.upsert({
    where: { target_section: { target: "global", section: "system" } },
    create: { target: "global", section: "system", config: {}, trackingEnabled: enabled, chatEnabled: true },
    update: { trackingEnabled: enabled },
  });
}
