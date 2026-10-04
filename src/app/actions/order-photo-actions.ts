"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { saveOrderImageUploaded, MAX_ORDER_IMAGE_BYTES } from "@/lib/order-image";
import { deleteFromR2 } from "@/lib/upload-storage";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { isCourierPortalBlocked } from "@/lib/courier-delegate-access";
import { ORDER_UPLOADER_ADMIN_LABEL } from "@/lib/order-uploader-label";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export type UploadOrderImageResult = {
  ok: boolean;
  imageUrl?: string;
  error?: string;
};

/**
 * إجراء سيرفر موحّد لرفع صورة الطلب سواء من لوحة الإدارة أو من لوحة المندوب
 */
export async function uploadOrderImageUniversal(formData: FormData): Promise<UploadOrderImageResult> {
  try {
    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) {
      return { ok: false, error: "معرّف الطلب غير محدد" };
    }

    const file =
      formData.get("orderImage") ||
      formData.get("orderPhoto") ||
      formData.get("orderImageCamera") ||
      formData.get("orderImageGallery");

    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "يرجى اختيار أو التقاط صورة أولاً" };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        imageUrl: true,
        assignedCourierId: true,
        courierEarningForCourierId: true,
      },
    });

    if (!order) {
      return { ok: false, error: "الطلب غير موجود" };
    }

    const isMandoubPortal = formData.get("isMandoubPortal") === "true";
    let uploaderLabel = ORDER_UPLOADER_ADMIN_LABEL;
    let rotate180 = false;

    if (isMandoubPortal) {
      // محاولة استخراج بيانات المندوب من المعاملات أو الكوكيز
      const cookieStore = await cookies();
      const c = String(formData.get("c") || cookieStore.get("mandoub_c")?.value || "").trim();
      const exp = String(formData.get("exp") || cookieStore.get("mandoub_exp")?.value || "").trim();
      const s = String(formData.get("s") || cookieStore.get("mandoub_s")?.value || "").trim();

      const v = verifyDelegatePortalQuery(c, exp, s);
      let targetCourierId: string | null = null;

      if (v.ok && !(await isCourierPortalBlocked(v.courierId))) {
        targetCourierId = v.courierId;
      } else if (order.assignedCourierId) {
        targetCourierId = order.assignedCourierId;
      } else if (order.courierEarningForCourierId) {
        targetCourierId = order.courierEarningForCourierId;
      }

      if (targetCourierId) {
        const courier = await prisma.courier.findUnique({
          where: { id: targetCourierId },
          select: { name: true, rotate180Photos: true },
        });
        if (courier) {
          uploaderLabel = courier.name?.trim() ? `المندوب ${courier.name.trim()}` : "المندوب";
          rotate180 = !!courier.rotate180Photos;
        } else {
          uploaderLabel = "المندوب";
        }
      } else {
        uploaderLabel = "المندوب";
      }
    } else {
      uploaderLabel = ORDER_UPLOADER_ADMIN_LABEL;
    }

    // حذف الصورة القديمة من R2 إن وُجدت
    if (order.imageUrl) {
      try {
        await deleteFromR2(order.imageUrl);
      } catch (delErr) {
        console.warn("[uploadOrderImageUniversal] Failed to remove previous image from R2:", delErr);
      }
    }

    // رفع الصورة الجديدة وتخزينها
    let newImageUrl: string;
    try {
      newImageUrl = await saveOrderImageUploaded(file, MAX_ORDER_IMAGE_BYTES, { rotate180 });
    } catch (saveErr) {
      const code = saveErr instanceof Error ? saveErr.message : "";
      if (code === "IMAGE_TOO_LARGE") {
        return { ok: false, error: "حجم الصورة كبير جداً (الحد الأقصى 20 ميجابايت)" };
      }
      if (code === "IMAGE_BAD_TYPE") {
        return { ok: false, error: "نوع الصورة غير مدعوم، يرجى اختيار JPG أو PNG أو WebP" };
      }
      return { ok: false, error: "تعذّر حفظ الصورة على الخادم، يرجى إعادة المحاولة" };
    }

    // تحديث السجل في قاعدة البيانات
    await prisma.order.update({
      where: { id: order.id },
      data: {
        imageUrl: newImageUrl,
        orderImageUploadedByName: uploaderLabel,
      },
    });

    // إعادة التحقق من مسارات الكاش في لوحة الإدارة والمندوب
    try {
      revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);
      revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
      revalidatePath(`${SECRET_ADMIN_PATH}/orders/${order.id}`);
      revalidatePath(`${SECRET_ADMIN_PATH}/orders/${order.id}/edit`);
      revalidatePath("/mandoub");
      revalidatePath(`/mandoub/order/${order.id}`);
    } catch (revErr) {
      console.warn("[uploadOrderImageUniversal] revalidatePath warning:", revErr);
    }

    return { ok: true, imageUrl: newImageUrl };
  } catch (err: any) {
    console.error("[uploadOrderImageUniversal] Unexpected error:", err);
    return { ok: false, error: err?.message || "حدث خطأ أثناء رفع صورة الطلب" };
  }
}
