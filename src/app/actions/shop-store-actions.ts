"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateShopStoreProfile(shopId: string, formData: FormData) {
  try {
    const storeLogoUrl = String(formData.get("storeLogoUrl") || formData.get("photoUrl") || "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const bio = String(formData.get("bio") ?? "").trim();
    const storeBannerUrl = String(formData.get("storeBannerUrl") ?? "").trim();

    await prisma.shop.update({
      where: { id: shopId },
      data: {
        ...(storeLogoUrl ? { storeLogoUrl } : {}),
        ...(storeBannerUrl ? { storeBannerUrl } : {}),
        phone: phone || undefined,
        storeBio: bio,
      },
    });

    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل تحديث بيانات المتجر" };
  }
}

export async function addShopStoreCategory(shopId: string, formData: FormData) {
  try {
    const name = String(formData.get("name") ?? "").trim();
    const photoUrl = String(formData.get("photoUrl") ?? "").trim();

    if (!name) return { ok: false, error: "اسم القسم مطلوب" };

    await prisma.shopStoreCategory.create({
      data: {
        shopId,
        name,
        photoUrl,
      },
    });

    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل إضافة القسم" };
  }
}

export async function deleteShopStoreCategory(categoryId: string, shopId: string) {
  try {
    await prisma.shopStoreCategory.delete({
      where: { id: categoryId },
    });
    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل حذف القسم" };
  }
}

export async function addShopStoreBranch(shopId: string, formData: FormData) {
  try {
    let categoryId = String(formData.get("categoryId") ?? "").trim();
    if (!categoryId) {
      const firstCat = await prisma.shopStoreCategory.findFirst({
        where: { shopId },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (firstCat) categoryId = firstCat.id;
    }

    const name = String(formData.get("name") ?? "").trim();
    const photoUrl = String(formData.get("photoUrl") ?? "").trim();

    if (!categoryId) return { ok: false, error: "يرجى إضافة قسم أولاً لتتمكن من إنشاء فروع داخله" };
    if (!name) return { ok: false, error: "اسم الفرع مطلوب" };

    await prisma.shopStoreBranch.create({
      data: {
        shopId,
        categoryId,
        name,
        photoUrl,
      },
    });

    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل إضافة الفرع" };
  }
}

export async function deleteShopStoreBranch(branchId: string, shopId: string) {
  try {
    await prisma.shopStoreBranch.delete({
      where: { id: branchId },
    });
    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل حذف الفرع" };
  }
}

export async function addShopStoreProduct(shopId: string, formData: FormData) {
  try {
    let categoryId = String(formData.get("categoryId") ?? "").trim();
    if (!categoryId) {
      const firstCat = await prisma.shopStoreCategory.findFirst({
        where: { shopId },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (firstCat) categoryId = firstCat.id;
    }

    const branchId = String(formData.get("branchId") ?? "").trim() || null;
    const name = String(formData.get("name") ?? "").trim();
    const priceRaw = String(formData.get("price") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const photoUrl = String(formData.get("photoUrl") ?? "").trim();

    if (!categoryId) return { ok: false, error: "يرجى إضافة قسم أولاً من تبويب الأقسام" };
    if (!name) return { ok: false, error: "اسم المنتج مطلوب" };
    const price = parseFloat(priceRaw);
    if (isNaN(price) || price < 0) return { ok: false, error: "أدخل سعراً صحيحاً" };

    await prisma.shopStoreProduct.create({
      data: {
        shopId,
        categoryId,
        branchId,
        name,
        price,
        description,
        photoUrl,
        photoUrls: photoUrl ? [photoUrl] : [],
      },
    });

    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل إضافة المنتج" };
  }
}

export async function deleteShopStoreProduct(productId: string, shopId: string) {
  try {
    await prisma.shopStoreProduct.delete({
      where: { id: productId },
    });
    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل حذف المنتج" };
  }
}

export async function addShopStoreSlide(shopId: string, formData: FormData) {
  try {
    const imageUrl = String(formData.get("imageUrl") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const linkUrl = String(formData.get("linkUrl") ?? "").trim();

    if (!imageUrl) return { ok: false, error: "صورة الإعلان مطلوبة" };

    await prisma.shopStoreSlide.create({
      data: {
        shopId,
        imageUrl,
        title,
        linkUrl,
      },
    });

    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل إضافة الإعلان" };
  }
}

export async function deleteShopStoreSlide(slideId: string, shopId: string) {
  try {
    await prisma.shopStoreSlide.delete({
      where: { id: slideId },
    });
    revalidatePath(`/shop-manage/${shopId}`);
    revalidatePath(`/store/shop/${shopId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "فشل حذف الإعلان" };
  }
}
