import { Metadata } from "next";
import { prisma } from "./prisma";

const SITE_NAME = "خصيب ستور — أبو الأكبر للتوصيل";
const DEFAULT_STORE_URL = "https://aboakbr.com/store";
const DEFAULT_ICON_URL = "https://aboakbr.com/icon.png";

/**
 * تحويل أي رابط صورة (نسبي أو سحابي) إلى رابط مطلق كامل يبدأ بـ https://
 */
export function getAbsoluteImageUrl(photoUrl?: string | null): string {
  if (!photoUrl || typeof photoUrl !== "string") {
    return DEFAULT_ICON_URL;
  }
  const clean = photoUrl.trim();
  if (!clean) {
    return DEFAULT_ICON_URL;
  }
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }
  const path = clean.startsWith("/") ? clean : `/${clean}`;
  return `https://aboakbr.com${path}`;
}

/**
 * توليد الميتا داتا عند مشاركة رابط قسم أو فرع داخل القسم أو منتج داخل القسم
 */
export async function getStoreCategoryMetadata(
  categoryId: string,
  activeBranchId?: string | null,
  productId?: string | null
): Promise<Metadata> {
  try {
    // 1. إذا كان الرابط لمنتج محدد
    if (productId) {
      const prod = await prisma.storeProduct.findUnique({
        where: { id: productId },
        include: {
          branch: {
            include: { category: true }
          }
        }
      });

      if (prod) {
        const prodPhoto = prod.photoUrls && prod.photoUrls.length > 0 ? prod.photoUrls[0] : null;
        const imageUrl = getAbsoluteImageUrl(prodPhoto || prod.branch?.photoUrl || prod.branch?.category?.photoUrl);
        const title = `${prod.name} | ${prod.branch?.name ? prod.branch.name + " - " : ""}${SITE_NAME}`;
        const description = prod.description?.trim() 
          ? prod.description 
          : `تسوق ${prod.name} من متجر أبو الأكبر للتوصيل بأفضل سعر وجودة.`;
        const canonicalUrl = `https://aboakbr.com/store/c/${categoryId}?b=${prod.branchId}&product=${prod.id}`;

        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: SITE_NAME,
            images: [
              {
                url: imageUrl,
                width: 800,
                height: 800,
                alt: prod.name,
              },
            ],
            type: "website",
            locale: "ar_IQ",
          },
          twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
          },
        };
      }
    }

    // 2. إذا كان الرابط لفرع محدد داخل القسم
    if (activeBranchId) {
      const branch = await prisma.storeBranch.findUnique({
        where: { id: activeBranchId },
        include: { category: true }
      });

      if (branch) {
        const imageUrl = getAbsoluteImageUrl(branch.photoUrl || branch.category?.photoUrl);
        const title = `${branch.name} — ${branch.category?.name || "المتجر"} | ${SITE_NAME}`;
        const description = branch.notes?.trim()
          ? branch.notes
          : `تصفح جميع منتجات وأصناف ${branch.name} في ${branch.category?.name || "خصيب ستور"} — اطلب الآن مع أسرع توصيل.`;
        const canonicalUrl = `https://aboakbr.com/store/c/${categoryId}?b=${activeBranchId}`;

        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: SITE_NAME,
            images: [
              {
                url: imageUrl,
                width: 800,
                height: 800,
                alt: branch.name,
              },
            ],
            type: "website",
            locale: "ar_IQ",
          },
          twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
          },
        };
      }
    }

    // 3. إذا كان الرابط للقسم العام
    const category = await prisma.storeCategory.findUnique({
      where: { id: categoryId }
    });

    if (category) {
      const imageUrl = getAbsoluteImageUrl(category.photoUrl);
      const title = `قسم ${category.name} | ${SITE_NAME}`;
      const description = category.notes?.trim()
        ? category.notes
        : `تصفح جميع فروع ومنتجات قسم ${category.name} في خصيب ستور — متجر أبو الأكبر للتوصيل.`;
      const canonicalUrl = `https://aboakbr.com/store/c/${categoryId}`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          siteName: SITE_NAME,
          images: [
            {
              url: imageUrl,
              width: 800,
              height: 800,
              alt: category.name,
            },
          ],
          type: "website",
          locale: "ar_IQ",
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [imageUrl],
        },
      };
    }
  } catch (err) {
    console.error("Error generating category metadata:", err);
  }

  // الميتا الافتراضية إذا لم نجد البيانات
  return getDefaultStoreMetadata();
}

/**
 * توليد الميتا داتا لصفحة الفرع المستقلة /store/b/[id]
 */
export async function getStoreBranchMetadata(
  branchId: string,
  productId?: string | null
): Promise<Metadata> {
  try {
    if (productId) {
      const prod = await prisma.storeProduct.findUnique({
        where: { id: productId },
        include: {
          branch: {
            include: { category: true }
          }
        }
      });

      if (prod) {
        const prodPhoto = prod.photoUrls && prod.photoUrls.length > 0 ? prod.photoUrls[0] : null;
        const imageUrl = getAbsoluteImageUrl(prodPhoto || prod.branch?.photoUrl || prod.branch?.category?.photoUrl);
        const title = `${prod.name} | ${prod.branch?.name ? prod.branch.name + " - " : ""}${SITE_NAME}`;
        const description = prod.description?.trim()
          ? prod.description
          : `تسوق ${prod.name} من متجر أبو الأكبر للتوصيل.`;
        const canonicalUrl = `https://aboakbr.com/store/b/${branchId}?product=${prod.id}`;

        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: SITE_NAME,
            images: [
              {
                url: imageUrl,
                width: 800,
                height: 800,
                alt: prod.name,
              },
            ],
            type: "website",
            locale: "ar_IQ",
          },
          twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
          },
        };
      }
    }

    const branch = await prisma.storeBranch.findUnique({
      where: { id: branchId },
      include: { category: true }
    });

    if (branch) {
      const imageUrl = getAbsoluteImageUrl(branch.photoUrl || branch.category?.photoUrl);
      const title = `${branch.name} — ${branch.category?.name || "المتجر"} | ${SITE_NAME}`;
      const description = branch.notes?.trim()
        ? branch.notes
        : `تصفح منتجات ${branch.name} في متجر أبو الأكبر للتوصيل.`;
      const canonicalUrl = `https://aboakbr.com/store/b/${branchId}`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          siteName: SITE_NAME,
          images: [
            {
              url: imageUrl,
              width: 800,
              height: 800,
              alt: branch.name,
            },
          ],
          type: "website",
          locale: "ar_IQ",
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [imageUrl],
        },
      };
    }
  } catch (err) {
    console.error("Error generating branch metadata:", err);
  }

  return getDefaultStoreMetadata();
}

/**
 * توليد الميتا داتا لمنتج محدد بمسار مباشر /store/product/[id] أو /store/p/[id]
 */
export async function getStoreProductMetadata(productId: string): Promise<Metadata> {
  try {
    const prod = await prisma.storeProduct.findUnique({
      where: { id: productId },
      include: {
        branch: {
          include: { category: true }
        }
      }
    });

    if (prod) {
      const prodPhoto = prod.photoUrls && prod.photoUrls.length > 0 ? prod.photoUrls[0] : null;
      const imageUrl = getAbsoluteImageUrl(prodPhoto || prod.branch?.photoUrl || prod.branch?.category?.photoUrl);
      const title = `${prod.name} | ${prod.branch?.name ? prod.branch.name + " - " : ""}${SITE_NAME}`;
      const description = prod.description?.trim() 
        ? prod.description 
        : `تسوق ${prod.name} من خصيب ستور — متجر أبو الأكبر للتوصيل بأفضل جودة وسعر.`;
      const canonicalUrl = prod.branch?.categoryId
        ? `https://aboakbr.com/store/c/${prod.branch.categoryId}?b=${prod.branchId}&product=${prod.id}`
        : `https://aboakbr.com/store/product/${prod.id}`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          siteName: SITE_NAME,
          images: [
            {
              url: imageUrl,
              width: 800,
              height: 800,
              alt: prod.name,
            },
          ],
          type: "website",
          locale: "ar_IQ",
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [imageUrl],
        },
      };
    }
  } catch (err) {
    console.error("Error generating product metadata:", err);
  }

  return getDefaultStoreMetadata();
}

/**
 * الميتا داتا العامة الافتراضية للمتجر
 */
export function getDefaultStoreMetadata(customTitle?: string, customDesc?: string, customImage?: string): Metadata {
  const title = customTitle || `خصيب ستور — أبو الأكبر للتوصيل`;
  const description = customDesc || `تسوق أفضل المنتجات والمأكولات والمشروبات بأسرع توصيل لباب بيتك مع متجر أبو الأكبر.`;
  const imageUrl = getAbsoluteImageUrl(customImage || DEFAULT_ICON_URL);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: DEFAULT_STORE_URL,
      siteName: SITE_NAME,
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: title,
        },
      ],
      type: "website",
      locale: "ar_IQ",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
