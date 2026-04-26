"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

export type SupplierFormState = { error?: string; ok?: boolean };

// سنستخدم جدول CompanyPreparer كبديل مستقر لجدول الموردين حالياً لتجنب مشاكل الـ Migration في السيرفر
// سنميز المورد بوجود كلمة [SUPPLIER] في حقل الملاحظات

export async function createStoreSupplier(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  try {
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const profitMargin = String(formData.get("profitMargin") ?? "0.25");

    if (!name) return { error: "الاسم مطلوب" };

    await prisma.storeSupplier.create({
      data: {
        name: name,
        phone: phone,
        profitMargin: parseFloat(profitMargin),
        active: true,
      }
    });

    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "فشل إضافة المورد. يرجى المحاولة مرة أخرى." };
  }
}

export async function updateStoreSupplier(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  try {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const profitMargin = String(formData.get("profitMargin") ?? "0.25");
    const active = formData.get("active") === "1";

    if (!id || !name) return { error: "البيانات ناقصة" };

    await prisma.storeSupplier.update({
      where: { id },
      data: {
        name,
        phone,
        profitMargin: parseFloat(profitMargin),
        active
      }
    });

    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "فشل تحديث المورد" };
  }
}

export async function deleteStoreSupplier(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "المعرف مطلوب" };

    await prisma.storeSupplier.delete({ where: { id } });

    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "فشل حذف المورد" };
  }
}

export async function renewSupplierPortalToken(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "المعرف مطلوب" };

    const crypto = await import("crypto");
    const newToken = crypto.randomBytes(16).toString("hex");

    await prisma.storeSupplier.update({
      where: { id },
      data: { portalToken: newToken }
    });

    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "فشل تجديد الرابط" };
  }
}

export async function assignProductsToSupplier(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  try {
    const supplierId = String(formData.get("supplierId") ?? "");
    const productIds = formData.getAll("productIds").map(id => String(id));

    if (!supplierId) return { error: "المورد غير محدد" };

    await prisma.$transaction(async (tx) => {
      // إزالة المورد الحالي من جميع المنتجات المرتبطة به سابقاً
      await tx.storeProduct.updateMany({
        where: { supplierId },
        data: { supplierId: null }
      });

      // ربط المنتجات الجديدة
      if (productIds.length > 0) {
        await tx.storeProduct.updateMany({
          where: { id: { in: productIds } },
          data: { supplierId }
        });
      }
    });

    revalidatePath("/admin/suppliers");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "فشل ربط المنتجات" };
  }
}
