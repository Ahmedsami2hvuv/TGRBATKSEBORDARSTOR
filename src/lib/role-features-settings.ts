import { prisma } from "./prisma";

export type RoleFeaturesConfig = {
  aiEnabled: boolean;
  chatEnabled: boolean;
};

export const DEFAULT_ROLE_FEATURES: RoleFeaturesConfig = {
  aiEnabled: true,
  chatEnabled: true,
};

export async function getRoleFeatures(role: "mandoub" | "preparer"): Promise<RoleFeaturesConfig> {
  try {
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: role, section: "features" }
      }
    });

    if (!setting) return DEFAULT_ROLE_FEATURES;

    const config = setting.config as any;
    return {
      aiEnabled: config.aiEnabled ?? DEFAULT_ROLE_FEATURES.aiEnabled,
      chatEnabled: config.chatEnabled ?? DEFAULT_ROLE_FEATURES.chatEnabled,
    };
  } catch (e) {
    console.error(`Failed to get features for ${role}:`, e);
    return DEFAULT_ROLE_FEATURES;
  }
}

export async function saveRoleFeatures(role: "mandoub" | "preparer", config: RoleFeaturesConfig) {
  return await prisma.uISystemSetting.upsert({
    where: {
      target_section: { target: role, section: "features" }
    },
    update: { config: config as any },
    create: { target: role, section: "features", config: config as any }
  });
}
