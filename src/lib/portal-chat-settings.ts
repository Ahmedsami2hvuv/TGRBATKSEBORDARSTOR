import { prisma } from "@/lib/prisma";

export async function isChatEnabledGlobally(): Promise<boolean> {
  const setting = await prisma.uISystemSetting.findFirst({
    where: { target: "global", section: "system" },
    select: { chatEnabled: true },
  });
  // Default to true if not found
  return setting?.chatEnabled ?? true;
}

export async function isTrackingEnabledGlobally(): Promise<boolean> {
  const setting = await prisma.uISystemSetting.findFirst({
    where: { target: "global", section: "system" },
    select: { trackingEnabled: true },
  });
  // Default to true if not found
  return setting?.trackingEnabled ?? true;
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
