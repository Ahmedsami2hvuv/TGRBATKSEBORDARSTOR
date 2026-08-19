"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { saveStoreSlideImageUploaded, MAX_ORDER_IMAGE_BYTES } from "@/lib/order-image";

/**
 * إنشاء سلايد جديد مع دعم رفع الصور أو الروابط المباشرة
 */
export async function createSlide(formData: FormData) {
  try {
    const imageUrlField = formData.get("imageUrl");
    const imageFileField = formData.get("imageFile");
    const titleField = formData.get("title");
    const linkUrlField = formData.get("linkUrl");
    const sequenceField = formData.get("sequence");

    let imageUrl = typeof imageUrlField === "string" ? imageUrlField.trim() : "";
    const title = typeof titleField === "string" ? titleField.trim() : "";
    const linkUrl = typeof linkUrlField === "string" ? linkUrlField.trim() : "";

    let sequence = 0;
    if (typeof sequenceField === "string" && sequenceField) {
      const parsed = parseInt(sequenceField);
      if (!isNaN(parsed)) sequence = parsed;
    }

    console.log("Processing Slide Creation:", {
      hasFile: imageFileField instanceof File && imageFileField.size > 0,
      imageUrl,
      sequence
    });

    // 1. معالجة الملف المرفوع إذا وجد
    if (imageFileField instanceof File && imageFileField.size > 0) {
      try {
        const uploadedUrl = await saveStoreSlideImageUploaded(imageFileField, MAX_ORDER_IMAGE_BYTES);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      } catch (uploadError: any) {
        console.error("Upload Error:", uploadError);
        return { success: false, error: "فشل في رفع الصورة: " + (uploadError.message || "حجم الملف كبير جداً") };
      }
    }

    // 2. التحقق من وجود رابط الصورة النهائي
    if (!imageUrl || imageUrl === "" || imageUrl === "undefined") {
      return { success: false, error: "يرجى اختيار صورة للرفع أو وضع رابط مباشر للصورة" };
    }

    // 3. الحفظ في قاعدة البيانات
    let slide: any = null;
    try {
      slide = await prisma.storeSlide.create({
        data: {
          imageUrl,
          title,
          linkUrl,
          sequence,
          active: true,
        },
      });
    } catch (dbError: any) {
      console.error("Database Error:", dbError);
      // التحقق إذا كان الجدول غير موجود (P2021)
      if (dbError.code === 'P2021' || (dbError.message && dbError.message.includes('does not exist'))) {
        return { success: false, error: "جدول السلايدر غير موجود. يرجى تشغيل (npx prisma db push) لتحديث قاعدة البيانات." };
      }
      return { success: false, error: "خطأ في قاعدة البيانات: " + (dbError.message || "فشل الحفظ") };
    }

    // 4. تحديث الصفحات
    revalidatePath("/abo1stor3hlaa2kbr8-47/store/slides");
    revalidatePath("/store");
    revalidatePath("/abo1stor3hlaa2kbr8-47/store");

    return { success: true, slide: JSON.parse(JSON.stringify(slide)) };
  } catch (error: any) {
    console.error("Critical Action Error:", error);
    return { success: false, error: "حدث خطأ غير متوقع: " + (error.message || "فشل النظام") };
  }
}

export async function toggleSlideStatus(id: string, currentStatus: boolean) {
  try {
    await prisma.storeSlide.update({
      where: { id },
      data: { active: !currentStatus },
    });
    revalidatePath("/abo1stor3hlaa2kbr8-47/store/slides");
    revalidatePath("/store");
    revalidatePath("/abo1stor3hlaa2kbr8-47/store");
    return { success: true };
  } catch (error) {
    console.error("Toggle Status Error:", error);
    throw new Error("فشل في تغيير حالة السلايد");
  }
}

export async function deleteSlide(id: string) {
  try {
    await prisma.storeSlide.delete({
      where: { id },
    });
    revalidatePath("/abo1stor3hlaa2kbr8-47/store/slides");
    revalidatePath("/store");
    revalidatePath("/abo1stor3hlaa2kbr8-47/store");
    return { success: true };
  } catch (error) {
    console.error("Delete Error:", error);
    throw new Error("فشل في حذف السلايد");
  }
}

export async function bulkDeleteSlides(ids: string[]) {
  try {
    await prisma.storeSlide.deleteMany({
      where: { id: { in: ids } },
    });
    revalidatePath("/abo1stor3hlaa2kbr8-47/store/slides");
    revalidatePath("/store");
    revalidatePath("/abo1stor3hlaa2kbr8-47/store");
    return { success: true };
  } catch (error) {
    console.error("Bulk Delete Error:", error);
    throw new Error("فشل في حذف السلايدات المختارة");
  }
}

export async function updateSlidesOrder(orderedIds: string[]) {
  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.storeSlide.update({
          where: { id },
          data: { sequence: index },
        })
      )
    );
    revalidatePath("/abo1stor3hlaa2kbr8-47/store/slides");
    revalidatePath("/store");
    revalidatePath("/abo1stor3hlaa2kbr8-47/store");
    return { success: true };
  } catch (error) {
    console.error("Update Order Error:", error);
    throw new Error("فشل في تحديث ترتيب السلايدات");
  }
}

export async function updateSlide(id: string, formData: FormData) {
  try {
    const imageUrlField = formData.get("imageUrl");
    const imageFileField = formData.get("imageFile");
    const titleField = formData.get("title");
    const linkUrlField = formData.get("linkUrl");
    const sequenceField = formData.get("sequence");

    let imageUrl = typeof imageUrlField === "string" ? imageUrlField.trim() : undefined;
    const title = typeof titleField === "string" ? titleField.trim() : "";
    const linkUrl = typeof linkUrlField === "string" ? linkUrlField.trim() : "";

    let sequence = 0;
    if (typeof sequenceField === "string" && sequenceField) {
      const parsed = parseInt(sequenceField);
      if (!isNaN(parsed)) sequence = parsed;
    }

    // معالجة الملف المرفوع إذا وجد
    if (imageFileField instanceof File && imageFileField.size > 0) {
      try {
        const uploadedUrl = await saveStoreSlideImageUploaded(imageFileField, MAX_ORDER_IMAGE_BYTES);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      } catch (uploadError: any) {
        console.error("Upload Error:", uploadError);
        return { success: false, error: "فشل في رفع الصورة: " + (uploadError.message || "حجم الملف كبير جداً") };
      }
    }

    const updateData: any = {
      title,
      linkUrl,
      sequence,
    };

    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    const updatedSlide = await prisma.storeSlide.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/abo1stor3hlaa2kbr8-47/store/slides");
    revalidatePath("/store");
    revalidatePath("/abo1stor3hlaa2kbr8-47/store");
    return { success: true, slide: JSON.parse(JSON.stringify(updatedSlide)) };
  } catch (error: any) {
    console.error("Update Slide Error:", error);
    return { success: false, error: "فشل في تحديث السلايد: " + (error.message || "فشل النظام") };
  }
}
