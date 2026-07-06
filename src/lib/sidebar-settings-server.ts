"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSessionName } from "@/lib/admin-session";
import { SidebarConfig, DEFAULT_SIDEBAR_CONFIG } from "@/lib/sidebar-settings";

const SECTION = "sidebar-config";

export async function getSidebarConfig(): Promise<SidebarConfig> {
  try {
    const adminName = await getCurrentSessionName();
    const target = `admin:${adminName}`;

    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target, section: SECTION }
      }
    });

    if (!setting) {
      return DEFAULT_SIDEBAR_CONFIG;
    }

    const config = setting.config as any;

    return {
      orderedSlugs: Array.isArray(config?.orderedSlugs) ? config.orderedSlugs : DEFAULT_SIDEBAR_CONFIG.orderedSlugs,
      layoutColumns: [1, 2, 3].includes(config?.layoutColumns) ? config.layoutColumns : DEFAULT_SIDEBAR_CONFIG.layoutColumns,
      buttonShape: ["square", "rectangle"].includes(config?.buttonShape) ? config.buttonShape : DEFAULT_SIDEBAR_CONFIG.buttonShape,
      customTiles: Array.isArray(config?.customTiles) ? config.customTiles : DEFAULT_SIDEBAR_CONFIG.customTiles,
    };
  } catch (e) {
    console.error("Failed to load sidebar configuration:", e);
    return DEFAULT_SIDEBAR_CONFIG;
  }
}

export async function saveSidebarConfig(config: SidebarConfig) {
  try {
    const adminName = await getCurrentSessionName();
    const target = `admin:${adminName}`;

    return await prisma.uISystemSetting.upsert({
      where: {
        target_section: { target, section: SECTION }
      },
      update: { config: config as any },
      create: { target, section: SECTION, config: config as any }
    });
  } catch (e) {
    console.error("Failed to save sidebar configuration:", e);
    throw new Error("حدث خطأ أثناء حفظ إعدادات القائمة الجانبية.");
  }
}
