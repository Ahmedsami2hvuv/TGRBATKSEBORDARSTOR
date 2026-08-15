"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

const TARGET = "global";
const SECTION = "social_links";

export type SocialLinksConfig = {
  whatsapp: string;
  telegram: string;
  instagram: string;
  facebook?: string;
  tiktok?: string;
  website: string;
  whatsappGroup: string;
  telegramGroup: string;
  youtubeTutorial?: string;
  animationUrl?: string;
};

const defaultSocialLinks: SocialLinksConfig = {
  whatsapp: "https://wa.me/9647733921468",
  telegram: "https://t.me/ko_kseb",
  instagram: "https://instagram.com/k.o_kseb",
  facebook: "",
  tiktok: "",
  website: "https://aboakbr.com",
  whatsappGroup: "https://chat.whatsapp.com/JSqEm7M1CgqBglStuRyItH",
  telegramGroup: "https://t.me/+IIH_puHB8Mg2MDIy",
  youtubeTutorial: "",
  animationUrl: "",
};

export async function getSocialLinksAction(): Promise<SocialLinksConfig> {
  try {
    const record = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: TARGET, section: SECTION } },
    });
    if (!record) return defaultSocialLinks;
    return { ...defaultSocialLinks, ...(record.config as any) };
  } catch (e) {
    console.error("Error getting social links:", e);
    return defaultSocialLinks;
  }
}

export async function saveSocialLinksAction(config: SocialLinksConfig) {
  if (!(await isAdminSession())) return { error: "Unauthenticated" };

  try {
    await prisma.uISystemSetting.upsert({
      where: { target_section: { target: TARGET, section: SECTION } },
      create: {
        target: TARGET,
        section: SECTION,
        config: config as any,
      },
      update: {
        config: config as any,
      },
    });

    revalidatePath("/");
    revalidatePath("/welcome");
    revalidatePath("/abo1stor3hlaa2kbr8-47/settings");

    return { ok: true };
  } catch (e) {
    console.error("Error saving social links:", e);
    return { error: "Failed to save" };
  }
}
