"use server";

import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/upload-storage";
import { saveCustomerProfilePhotoUploaded } from "@/lib/order-image";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function getBackgroundsAction() {
  try {
    const backgrounds = await prisma.systemBackground.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { ok: true, backgrounds };
  } catch (error: any) {
    console.error("Failed to fetch backgrounds:", error);
    return { ok: false, error: error.message || "فشل جلب الخلفيات" };
  }
}

export async function addBackgroundAction(formData: FormData) {
  if (!(await isAdminSession())) {
    return { error: "غير مصرح لك بالقيام بهذا الإجراء" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("file") as File;

  if (!name) {
    return { error: "الرجاء إدخال اسم الخلفية" };
  }

  if (!file || file.size === 0) {
    return { error: "الرجاء اختيار ملف الصورة" };
  }

  try {
    // رفع الصورة إلى R2 بحد أقصى 10 ميجا
    const photoUrl = await saveCustomerProfilePhotoUploaded(file, 10);
    if (!photoUrl) {
      return { error: "فشل رفع الصورة إلى الخادم" };
    }

    // حفظ الخلفية في قاعدة البيانات
    const bg = await prisma.systemBackground.create({
      data: {
        name,
        imageUrl: photoUrl,
      },
    });

    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
    return { ok: true, background: bg };
  } catch (error: any) {
    console.error("Failed to add background:", error);
    return { error: error.message || "حدث خطأ أثناء حفظ الخلفية" };
  }
}

export async function deleteBackgroundAction(id: string) {
  if (!(await isAdminSession())) {
    return { error: "غير مصرح لك بالقيام بهذا الإجراء" };
  }

  try {
    const bg = await prisma.systemBackground.findUnique({
      where: { id },
    });

    if (!bg) {
      return { error: "الخلفية غير موجودة" };
    }

    // حذف الصورة من R2
    if (bg.imageUrl) {
      await deleteFromR2(bg.imageUrl);
    }

    // حذف السجل من قاعدة البيانات
    await prisma.systemBackground.delete({
      where: { id },
    });

    revalidatePath(`${SECRET_ADMIN_PATH}/settings`);
    return { ok: true };
  } catch (error: any) {
    console.error("Failed to delete background:", error);
    return { error: error.message || "حدث خطأ أثناء حذف الخلفية" };
  }
}
