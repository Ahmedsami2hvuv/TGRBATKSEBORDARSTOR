import { prisma } from "@/lib/prisma";

export async function isChatEnabledGlobally(): Promise<boolean> {
  const setting = await prisma.uISystemSetting.findFirst({
    where: { target: "global", section: "chat" },
    select: { chatEnabled: true },
  });
  // Default to true if not found
  return setting?.chatEnabled ?? true;
}

export async function setChatEnabledGlobally(enabled: boolean): Promise<void> {
  await prisma.uISystemSetting.upsert({
    where: { target_section: { target: "global", section: "chat" } },
    create: { target: "global", section: "chat", config: {}, chatEnabled: enabled },
    update: { chatEnabled: enabled },
  });
}
