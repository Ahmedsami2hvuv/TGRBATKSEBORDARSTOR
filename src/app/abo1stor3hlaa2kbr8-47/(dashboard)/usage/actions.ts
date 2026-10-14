"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import {
  getVercelUsageConfig,
  saveVercelUsageConfig,
  fetchVercelUsageReport,
  type VercelUsageReport,
  type VercelUsageConfig,
} from "@/lib/vercel-usage";

const USAGE_PAGE_PATH = "/abo1stor3hlaa2kbr8-47/usage";

export async function getUsageReportAction(): Promise<{ report: VercelUsageReport; config: VercelUsageConfig }> {
  if (!(await isAdminSession())) {
    throw new Error("غير مصرح لك بالوصول");
  }

  const [report, config] = await Promise.all([
    fetchVercelUsageReport(),
    getVercelUsageConfig(),
  ]);

  return { report, config };
}

export async function updateVercelConfigAction(data: {
  vercelToken: string;
  projectId?: string;
  teamId?: string;
  plan: "hobby" | "pro";
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdminSession())) {
    return { ok: false, error: "غير مصرح لك بالوصول" };
  }

  try {
    await saveVercelUsageConfig({
      vercelToken: data.vercelToken.trim(),
      projectId: data.projectId?.trim(),
      teamId: data.teamId?.trim(),
      plan: data.plan,
      lastSyncedAt: new Date().toISOString(),
    });

    revalidatePath(USAGE_PAGE_PATH);
    return { ok: true };
  } catch (err: any) {
    console.error("Error saving vercel config:", err);
    return { ok: false, error: err?.message || "حدث خطأ أثناء حفظ الإعدادات" };
  }
}

export async function refreshUsageAction(): Promise<{ ok: boolean; report?: VercelUsageReport; error?: string }> {
  if (!(await isAdminSession())) {
    return { ok: false, error: "غير مصرح لك بالوصول" };
  }

  try {
    const report = await fetchVercelUsageReport();
    revalidatePath(USAGE_PAGE_PATH);
    return { ok: true, report };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل تحديث البيانات" };
  }
}
