import { prisma } from "./prisma";

export type UIBlockConfig = {
  id: string;
  fullWidth?: boolean;
  hidden?: boolean;
  customClass?: string;
  fontSize?: string;
  backgroundColor?: string;
  textColor?: string;
};

export type UISectionConfig = {
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundImage?: string;
  backgroundImageOpacity?: number;
  textColor?: string;
  fontSize?: string;
  borderRadius?: string;
  layoutOrder?: string[]; // IDs in order
  blockConfigs?: Record<string, UIBlockConfig>; // Per-block settings
  statusStyles?: Record<string, {
    backgroundColor?: string;
    backgroundImage?: string;
    textColor?: string;
  }>;
  customCss?: string;
  padding?: string;
  margin?: string;
  shadow?: string;
  border?: string;
};

export async function getUISettings(target: string, section: string): Promise<UISectionConfig | null> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target, section }
      }
    });

    if (!setting) return null;
    return setting.config as UISectionConfig;
  } catch (e) {
    // في حال عدم وجود الجدول في قاعدة البيانات، لا نعطل الموقع، بل نرجع null ليستخدم التصميم الافتراضي
    console.error("UISystemSetting table might be missing:", e);
    return null;
  }
}

export async function saveUISettings(target: string, section: string, config: UISectionConfig) {
  try {
    return await prisma.uISystemSetting.upsert({
      where: {
        target_section: { target, section }
      },
      update: { config: config as any },
      create: { target, section, config: config as any }
    });
  } catch (e) {
    console.error("Failed to save UI settings:", e);
    throw new Error("لا يمكن الحفظ حالياً، يرجى التأكد من تحديث قاعدة البيانات (prisma db push)");
  }
}
