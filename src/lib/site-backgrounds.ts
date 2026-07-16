import { prisma } from "./prisma";

export type StaticBackgroundItem = {
  id: string;
  name: string;
  lightUrl: string; // صورة للوضع المضيء
  darkUrl: string;  // صورة للوضع المظلم
  isActive: boolean;
};

export type StaticBackgroundsConfig = {
  items: StaticBackgroundItem[];
  defaultBackgroundId: string;
};

const DEFAULT_CONFIG: StaticBackgroundsConfig = {
  items: [
    {
      id: "default-gradient",
      name: "خلفية النظام الافتراضية",
      lightUrl: "",
      darkUrl: "",
      isActive: true,
    },
  ],
  defaultBackgroundId: "default-gradient",
};

/**
 * جلب إعدادات الخلفيات الثابتة
 */
export async function getStaticBackgroundsConfig(): Promise<StaticBackgroundsConfig> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: {
          target: "system",
          section: "static_backgrounds",
        },
      },
    });

    if (!setting || !setting.config) {
      return DEFAULT_CONFIG;
    }

    return setting.config as unknown as StaticBackgroundsConfig;
  } catch (error) {
    console.error("فشل جلب إعدادات الخلفيات الثابتة:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * حفظ إعدادات الخلفيات الثابتة
 */
export async function saveStaticBackgroundsConfig(config: StaticBackgroundsConfig) {
  try {
    const result = await prisma.uISystemSetting.upsert({
      where: {
        target_section: {
          target: "system",
          section: "static_backgrounds",
        },
      },
      update: {
        config: config as any,
      },
      create: {
        target: "system",
        section: "static_backgrounds",
        config: config as any,
      },
    });
    return result;
  } catch (error) {
    console.error("فشل حفظ إعدادات الخلفيات الثابتة:", error);
    throw error;
  }
}
