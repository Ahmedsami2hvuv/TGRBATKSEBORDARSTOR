"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function addAIConfig(formData: FormData) {
  try {
    const provider = formData.get("provider") as string;
    const label = formData.get("label") as string;
    const apiKey = formData.get("apiKey") as string;

    await prisma.aIConfig.create({
      data: { provider, label, apiKey }
    });

    revalidatePath("/admin/settings/ai");
    return { ok: true };
  } catch (error: any) {
    console.error("Add AI Config Error:", error);
    return { ok: false, error: "فشل إضافة المفتاح. تأكد من مزامنة قاعدة البيانات." };
  }
}

export async function deleteAIConfig(id: string) {
  try {
    await prisma.aIConfig.delete({ where: { id } });
    revalidatePath("/admin/settings/ai");
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
    revalidatePath("/admin/settings/ai");
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

    revalidatePath("/admin/settings/ai");
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

    revalidatePath("/admin/settings/ai");
    return { ok: true, message: "تمت مزامنة قاعدة البيانات بنجاح!" };
  } catch (error: any) {
    console.error("Sync DB Error:", error);
    return { ok: false, error: error.message };
  }
}
