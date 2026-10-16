import { Metadata } from "next";
import { prisma } from "./prisma";
import { getPublicAppUrl } from "./app-url";

const SITE_NAME = "متجر وصلي";
const DEFAULT_STORE_URL = "https://aboakbr.com/store";
const DEFAULT_ICON_URL = "https://aboakbr.com/images/wasly-logo.png";

/**
 * تحويل أي رابط صورة (نسبي أو سحابي) إلى رابط مطلق كامل يبدأ بـ https://
 */
export function getAbsoluteImageUrl(photoUrl?: string | null): string {
  const base = getPublicAppUrl();
  const defaultIcon = `${base}/images/wasly-logo.png`;

  if (!photoUrl || typeof photoUrl !== "string") {
    return defaultIcon;
  }
  const clean = photoUrl.trim();
  if (!clean) {
    return defaultIcon;
  }
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }
  const path = clean.startsWith("/") ? clean : `/${clean}`;
  return `${base}${path}`;
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
          : `تسوق ${prod.name} من متجر وصلي بأفضل سعر وجودة.`;
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
          : `تصفح جميع منتجات وأصناف ${branch.name} في ${branch.category?.name || "وصلي ستور"} — اطلب الآن مع أسرع توصيل.`;
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
        : `تصفح جميع فروع ومنتجات قسم ${category.name} في متجر وصلي.`;
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
          : `تسوق ${prod.name} من متجر وصلي.`;
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
        : `تصفح منتجات ${branch.name} في متجر وصلي.`;
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
        : `تسوق ${prod.name} من متجر وصلي بأفضل جودة وسعر.`;
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
  const title = customTitle || `متجر وصلي`;
  const description = customDesc || `تسوق أفضل المنتجات والمأكولات والمشروبات بأسرع توصيل لباب بيتك مع وصلي — توصيل أسرع .. لكل مكان.`;
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

/**
 * توليد الميتا داتا الكاملة والمعتمدة لمتجر المحل
 * تضمن ظهور صورة وشعار المتجر الذي يحدده صاحب المحل عند مشاركة الرابط بالواتساب أو بأي تطبيق
 */
export async function getShopStoreMetadata(shopIdentifier: string): Promise<Metadata> {
  const base = getPublicAppUrl();
  try {
    const cleanId = (shopIdentifier || "").trim();
    if (!cleanId) return getDefaultStoreMetadata();

    const shop = await prisma.shop.findFirst({
      where: {
        OR: [{ storeToken: cleanId }, { id: cleanId }],
      },
      select: {
        id: true,
        name: true,
        storeBio: true,
        storeLogoUrl: true,
        storeBannerUrl: true,
        photoUrl: true,
        storeToken: true,
      },
    });

    if (!shop) {
      return getDefaultStoreMetadata();
    }

    // الأولوية لصورة المتجر التي وضعها صاحب المحل: شعار المتجر ثم غلاف المتجر ثم صورة المحل
    const rawImage =
      (shop.storeLogoUrl && shop.storeLogoUrl.trim()) ||
      (shop.storeBannerUrl && shop.storeBannerUrl.trim()) ||
      (shop.photoUrl && shop.photoUrl.trim()) ||
      null;

    const fullImageUrl = getAbsoluteImageUrl(rawImage);
    const targetToken = shop.storeToken || shop.id;
    const pageUrl = `${base}/shop/${targetToken}`;
    const pageTitle = `متجر ${shop.name} | وصلي`;
    const shareTitle = `متجر ${shop.name}`;
    const shareDesc = shop.storeBio?.trim()
      ? shop.storeBio.trim()
      : `تسوق أونلاين من متجر ${shop.name} مع أسرع توصيل لباب بيتك عبر وصلي.`;

    return {
      metadataBase: new URL(base),
      title: pageTitle,
      description: shareDesc,
      openGraph: {
        title: shareTitle,
        description: shareDesc,
        url: pageUrl,
        siteName: `متجر ${shop.name}`,
        locale: "ar_IQ",
        type: "website",
        images: [
          {
            url: fullImageUrl,
            secureUrl: fullImageUrl,
            width: 1200,
            height: 630,
            alt: `متجر ${shop.name}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: shareTitle,
        description: shareDesc,
        images: [fullImageUrl],
      },
      other: {
        "og:image:secure_url": fullImageUrl,
      },
    };
  } catch (err) {
    console.error("Error generating shop store metadata:", err);
    return getDefaultStoreMetadata();
  }
}
