import { prisma } from "./prisma";

export type BackgroundItem = {
  id: string;
  name: string;
  lightUrl: string;
  lightType: "image";
  darkUrl: string;
  darkType: "image";
  isActive: boolean;
  opacity: number; // 0 to 100
  blur: number; // 0 to 20 px
};

export type BackgroundsConfig = {
  items: BackgroundItem[];
  defaultBackgroundId?: string;
};

const TARGET = "system";
const SECTION = "backgrounds";

export const DEFAULT_BACKGROUNDS_CONFIG: BackgroundsConfig = {
  items: [
    {
      id: "default-gradient",
      name: "تدرج لوني افتراضي (ثابت)",
      lightUrl: "",
      lightType: "image",
      darkUrl: "",
      darkType: "image",
      isActive: true,
      opacity: 30,
      blur: 0,
    }
  ],
  defaultBackgroundId: "default-gradient"
};

export async function getBackgroundsConfig(): Promise<BackgroundsConfig> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: TARGET, section: SECTION }
      }
    });

    if (!setting) {
      return DEFAULT_BACKGROUNDS_CONFIG;
    }

    const config = setting.config as any;
    // التأكد من تهيئة البيانات بشكل سليم
    return {
      items: Array.isArray(config?.items) ? config.items : DEFAULT_BACKGROUNDS_CONFIG.items,
      defaultBackgroundId: config?.defaultBackgroundId || DEFAULT_BACKGROUNDS_CONFIG.defaultBackgroundId
    };
  } catch (e) {
    console.error("فشل استرجاع إعدادات الخلفية:", e);
    return DEFAULT_BACKGROUNDS_CONFIG;
  }
}

export async function saveBackgroundsConfig(config: BackgroundsConfig) {
  try {
    return await prisma.uISystemSetting.upsert({
      where: {
        target_section: { target: TARGET, section: SECTION }
      },
      update: { config: config as any },
      create: { target: TARGET, section: SECTION, config: config as any }
    });
  } catch (e) {
    console.error("فشل حفظ إعدادات الخلفية في قاعدة البيانات:", e);
    throw new Error("حدث خطأ أثناء حفظ إعدادات الخلفيات.");
  }
}
