"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export type AIPortalKey = "admin" | "mandoub" | "preparer" | "store";
export type AIPortalTrainingItem = {
  id: string;
  title: string;
  instruction: string;
  isActive: boolean;
};
export type AIPortalTrainingConfig = {
  version: 1;
  byPortal: Record<AIPortalKey, AIPortalTrainingItem[]>;
};

const AI_PORTAL_TRAINING_TARGET = "global";
const AI_PORTAL_TRAINING_SECTION = "ai_portal_training";

function defaultTrainingConfig(): AIPortalTrainingConfig {
  return {
    version: 1,
    byPortal: {
      admin: [],
      mandoub: [],
      preparer: [],
      store: [],
    },
  };
}

function sanitizeTrainingConfig(raw: any): AIPortalTrainingConfig {
  const base = defaultTrainingConfig();
  const src = raw && typeof raw === "object" ? raw : {};
  const byPortal = src.byPortal && typeof src.byPortal === "object" ? src.byPortal : {};

  const sanitizeItems = (items: any): AIPortalTrainingItem[] => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item: any) => ({
        id: String(item?.id || "").trim(),
        title: String(item?.title || "").trim(),
        instruction: String(item?.instruction || "").trim(),
        isActive: item?.isActive !== false,
      }))
      .filter((item: AIPortalTrainingItem) => item.id && item.instruction);
  };

  return {
    version: 1,
    byPortal: {
      admin: sanitizeItems(byPortal.admin),
      mandoub: sanitizeItems(byPortal.mandoub),
      preparer: sanitizeItems(byPortal.preparer),
      store: sanitizeItems(byPortal.store),
    },
  };
}

export async function getAIPortalTrainingConfig(): Promise<AIPortalTrainingConfig> {
  try {
    const row = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: {
          target: AI_PORTAL_TRAINING_TARGET,
          section: AI_PORTAL_TRAINING_SECTION,
        },
      },
    });

    if (!row) return defaultTrainingConfig();
    return sanitizeTrainingConfig(row.config);
  } catch (error) {
    return defaultTrainingConfig();
  }
}

async function saveAIPortalTrainingConfig(config: AIPortalTrainingConfig) {
  await prisma.uISystemSetting.upsert({
    where: {
      target_section: {
        target: AI_PORTAL_TRAINING_TARGET,
        section: AI_PORTAL_TRAINING_SECTION,
      },
    },
    create: {
      target: AI_PORTAL_TRAINING_TARGET,
      section: AI_PORTAL_TRAINING_SECTION,
      config: config as any,
    },
    update: {
      config: config as any,
    },
  });
}

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function upsertAIPortalTraining(
  portal: AIPortalKey,
  item: AIPortalTrainingItem,
) {
  try {
    const config = await getAIPortalTrainingConfig();
    const current = config.byPortal[portal] || [];
    const existingIndex = current.findIndex((it) => it.id === item.id);

    const safeItem: AIPortalTrainingItem = {
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      instruction: String(item.instruction || "").trim(),
      isActive: item.isActive !== false,
    };

    if (!safeItem.id || !safeItem.instruction) {
      return { ok: false, error: "بيانات التدريب غير مكتملة." };
    }

    if (existingIndex >= 0) {
      current[existingIndex] = safeItem;
    } else {
      current.push(safeItem);
    }

    config.byPortal[portal] = current;
    await saveAIPortalTrainingConfig(config);
    revalidatePath(`${SECRET_ADMIN_PATH}/settings/ai`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "فشل حفظ التدريب." };
  }
}

export async function deleteAIPortalTraining(portal: AIPortalKey, id: string) {
  try {
    const config = await getAIPortalTrainingConfig();
    config.byPortal[portal] = (config.byPortal[portal] || []).filter((it) => it.id !== id);
    await saveAIPortalTrainingConfig(config);
    revalidatePath(`${SECRET_ADMIN_PATH}/settings/ai`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "فشل حذف التدريب." };
  }
}

export async function clearAllAIPortalTrainings() {
  try {
    await saveAIPortalTrainingConfig(defaultTrainingConfig());
    revalidatePath(`${SECRET_ADMIN_PATH}/settings/ai`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "فشل حذف كل التدريبات." };
  }
}

export async function addAIConfig(formData: FormData) {
  try {
    const provider = formData.get("provider") as string;
    const label = formData.get("label") as string;
    const apiKey = formData.get("apiKey") as string;

    await prisma.aIConfig.create({
      data: { provider, label, apiKey }
    });

    revalidatePath(`${SECRET_ADMIN_PATH}/settings/ai`);
    return { ok: true };
  } catch (error: any) {
    console.error("Add AI Config Error:", error);
    return { ok: false, error: "فشل إضافة المفتاح. تأكد من مزامنة قاعدة البيانات." };
  }
}

export async function deleteAIConfig(id: string) {
  try {
    await prisma.aIConfig.delete({ where: { id } });
    revalidatePath(`${SECRET_ADMIN_PATH}/settings/ai`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "فشل الحذف" };
  }
}

export async function toggleAIConfig(id: string, currentStatus: boolean) {
  try {
    await prisma.aIConfig.update({
      where: { id },
      data: { isActive: !currentStatus }
    });
    revalidatePath(`${SECRET_ADMIN_PATH}/settings/ai`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "فشل التحديث" };
  }
}

export async function updateAIConfig(id: string, formData: FormData) {
  try {
    const provider = formData.get("provider") as string;
    const label = formData.get("label") as string;
    const apiKey = formData.get("apiKey") as string;

    await prisma.aIConfig.update({
      where: { id },
      data: { provider, label, apiKey }
    });

    revalidatePath(`${SECRET_ADMIN_PATH}/settings/ai`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "فشل التحديث" };
  }
}

// أكشن طوارئ لمزامنة قاعدة البيانات برمجياً
export async function syncDatabaseSchema() {
  try {
    // هذا الأمر سيقوم بمزامنة الموديلات الجديدة مع قاعدة البيانات في ريلوي
    const { stdout, stderr } = await execPromise("npx prisma db push");
    console.log("Prisma Sync Stdout:", stdout);
    if (stderr) console.error("Prisma Sync Stderr:", stderr);

    revalidatePath(`${SECRET_ADMIN_PATH}/settings/ai`);
    return { ok: true, message: "تمت مزامنة قاعدة البيانات بنجاح!" };
  } catch (error: any) {
    console.error("Sync DB Error:", error);
    return { ok: false, error: error.message };
  }
}
