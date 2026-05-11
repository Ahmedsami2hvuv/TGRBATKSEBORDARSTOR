"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { deleteFromR2 } from "@/lib/upload-storage";
import {
  saveStoreCategoryImageUploaded,
  saveStoreBranchImageUploaded,
  saveStoreProductImageUploaded,
  MAX_ORDER_IMAGE_BYTES
} from "@/lib/order-image";

export type FormState = { error?: string; ok?: boolean; id?: string };

// --- Categories ---
export async function upsertCategory(_prev: any, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const sequence = parseInt(formData.get("sequence") as string || "0");
  const photoFile = formData.get("photo") as File;
  let photoUrl = formData.get("currentPhotoUrl") as string || "";

  if (!name) return { error: "الاسم مطلوب" };

  if (photoFile && photoFile.size > 0) {
    try {
      // مسح الصورة القديمة إذا وجد تعديل
      if (id && photoUrl) {
        await deleteFromR2(photoUrl);
      }
      photoUrl = await saveStoreCategoryImageUploaded(photoFile, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      return { error: "خطأ في رفع الصورة" };
    }
  }

  if (id) {
    await prisma.storeCategory.update({
      where: { id },
      data: { name, sequence, photoUrl }
    });
  } else {
    await prisma.storeCategory.create({
      data: { name, sequence, photoUrl }
    });
  }

  revalidatePath("/admin/store/categories");
  revalidatePath("/staff/portal/store/categories");
  return { ok: true };
}

export async function deleteCategory(id: string) {
  const existing = await prisma.storeCategory.findUnique({ where: { id }, select: { photoUrl: true } });
  if (existing?.photoUrl) {
    await deleteFromR2(existing.photoUrl);
  }
  await prisma.storeCategory.delete({ where: { id } });
  revalidatePath("/admin/store/categories");
}

// --- Branches ---
export async function upsertBranch(_prev: any, formData: FormData): Promise<FormState> {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const categoryId = formData.get("categoryId") as string;
  const parentBranchId = (formData.get("parentBranchId") as string) || null;
  const sequence = parseInt(formData.get("sequence") as string || "0");
  const authorizedPreparerId = (formData.get("authorizedPreparerId") as string) || null;
  const profitMargin = parseFloat(formData.get("profitMargin") as string || "0.25");
  const photoFile = formData.get("photo") as File;
  const remoteImageUrl = formData.get("remoteImageUrl") as string;
  const removeBg = formData.get("removeBg") === "true";
  const skipRevalidate = formData.get("skipRevalidate") === "true";
  let photoUrl = formData.get("currentPhotoUrl") as string || "";

  if (!name || !categoryId) return { error: "الاسم والقسم مطلوبان" };

  if (photoFile && photoFile.size > 0) {
    try {
      if (id && photoUrl) {
        await deleteFromR2(photoUrl);
      }
      photoUrl = await saveStoreBranchImageUploaded(photoFile, MAX_ORDER_IMAGE_BYTES, { removeBg });
    } catch (e) {
      return { error: "خطأ في رفع الصورة" };
    }
  } else if (remoteImageUrl && remoteImageUrl.startsWith("http") && !photoUrl) {
    try {
        const response = await fetch(remoteImageUrl, {
          signal: AbortSignal.timeout(20000),
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Referer": new URL(remoteImageUrl).origin + "/",
          },
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const contentType = response.headers.get("content-type") || "image/jpeg";
          if (!contentType.toLowerCase().startsWith("image/")) {
            throw new Error("REMOTE_BRANCH_IMAGE_NOT_IMAGE");
          }
          const file = new File([arrayBuffer], "branch-remote.jpg", { type: contentType });
          if (id && photoUrl) {
            await deleteFromR2(photoUrl);
          }
          photoUrl = await saveStoreBranchImageUploaded(file, MAX_ORDER_IMAGE_BYTES, { removeBg });
        }
    } catch (e) {
        console.error("Failed to fetch remote branch image:", e);
    }
  }

  const data = {
    name,
    categoryId,
    parentBranchId: parentBranchId === "" ? null : parentBranchId,
    authorizedPreparerId: authorizedPreparerId === "" ? null : authorizedPreparerId,
    profitMargin,
    sequence,
    photoUrl
  };

  if (id) {
    const br = await prisma.storeBranch.update({
      where: { id },
      data
    });
    if (!skipRevalidate) {
        revalidatePath("/admin/store/branches");
        revalidatePath("/staff/portal/store/branches");
    }
    return { ok: true, id: br.id };
  } else {
    const br = await prisma.storeBranch.create({
      data
    });
    if (!skipRevalidate) {
        revalidatePath("/admin/store/branches");
        revalidatePath("/staff/portal/store/branches");
    }
    return { ok: true, id: br.id };
  }
}

export async function deleteBranch(id: string) {
  const existing = await prisma.storeBranch.findUnique({ where: { id }, select: { photoUrl: true } });
  if (existing?.photoUrl) {
    await deleteFromR2(existing.photoUrl);
  }
  await prisma.storeBranch.delete({ where: { id } });
  revalidatePath("/admin/store/branches");
}

// --- Products ---
export async function upsertProduct(_prev: any, formData: FormData): Promise<FormState> {
  try {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string || "";
    const branchId = formData.get("branchId") as string;
    const sequence = parseInt(formData.get("sequence") as string || "0");
    const purchasePrice = parseFloat(formData.get("purchasePrice") as string || "0");
    const salePrice = parseFloat(formData.get("salePrice") as string || "0");
    const supplierId = (formData.get("supplierId") as string) || null;

    const hasVariants = formData.get("hasVariants") === "true";
    const variantType = formData.get("variantType") as string || null;
    const variantsJson = formData.get("variants") as string || "[]";
    const variants = JSON.parse(variantsJson);

    const photoFiles = formData.getAll("photos") as File[];
    let photoUrls: string[] = JSON.parse(formData.get("currentPhotoUrls") as string || "[]");

    if (id) {
      const existing = await prisma.storeProduct.findUnique({ where: { id }, select: { photoUrls: true } });
      if (existing) {
        // مسح الصور التي تم حذفها من القائمة من R2
        const removedPhotos = existing.photoUrls.filter(oldUrl => !photoUrls.includes(oldUrl));
        for (const url of removedPhotos) {
          await deleteFromR2(url);
        }
      }
    }

    if (!name || !branchId) return { error: "الاسم والفرع مطلوبان" };

    for (const file of photoFiles) {
      if (file && file.size > 0) {
        try {
          const removeBg = formData.get("removeBg") === "true";
          const url = await saveStoreProductImageUploaded(file, MAX_ORDER_IMAGE_BYTES, { removeBg });
          photoUrls.push(url);
        } catch (e) {
          console.error("Product image upload failed", e);
        }
      }
    }

    // دعم سحب الصورة من رابط خارجي (لتجنب مشاكل CORS في المتصفح)
    const remoteImageUrl = formData.get("remoteImageUrl") as string;
    if (remoteImageUrl && remoteImageUrl.startsWith("http")) {
      try {
        const removeBg = formData.get("removeBg") === "true";
        const response = await fetch(remoteImageUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const contentType = response.headers.get("content-type") || "image/jpeg";
          const file = new File([arrayBuffer], "remote-image.jpg", { type: contentType });
          const url = await saveStoreProductImageUploaded(file, MAX_ORDER_IMAGE_BYTES, { removeBg });
          photoUrls.push(url);
        }
      } catch (e) {
        console.error("Failed to download remote image:", e);
      }
    }

    const data: any = {
      name,
      description,
      branchId,
      sequence,
      purchasePrice,
      salePrice,
      photoUrls,
      hasVariants,
      variantType: hasVariants ? variantType : null,
      supplierId: supplierId === "" ? null : supplierId
    };

    if (id) {
      await prisma.$transaction(async (tx) => {
        await tx.storeProduct.update({ where: { id }, data });
        if (hasVariants) {
          await tx.storeProductVariant.deleteMany({ where: { productId: id } });
          await tx.storeProductVariant.createMany({
            data: variants.map((v: any, idx: number) => ({
              productId: id,
              name: v.name,
              purchasePrice: parseFloat(v.purchasePrice || 0),
              salePrice: parseFloat(v.salePrice || 0),
              sequence: idx,
            }))
          });
        }
      });
    } else {
      const product = await prisma.storeProduct.create({ data });
      if (hasVariants && variants.length > 0) {
        await prisma.storeProductVariant.createMany({
          data: variants.map((v: any, idx: number) => ({
            productId: product.id,
            name: v.name,
            purchasePrice: parseFloat(v.purchasePrice || 0),
            salePrice: parseFloat(v.salePrice || 0),
            sequence: idx,
          }))
        });
      }
    }

    revalidatePath("/admin/store/products");
    revalidatePath("/staff/portal/store/products");
    return { ok: true };
  } catch (err: any) {
    console.error("UPSERT PRODUCT ERROR:", err);
    return { error: err.message || "حدث خطأ غير متوقع أثناء حفظ المنتج" };
  }
}

export async function deleteProduct(id: string) {
  const existing = await prisma.storeProduct.findUnique({ where: { id }, select: { photoUrls: true } });
  if (existing?.photoUrls) {
    for (const url of existing.photoUrls) {
      await deleteFromR2(url);
    }
  }
  await prisma.storeProduct.delete({ where: { id } });
  revalidatePath("/admin/store/products");
}

// --- Smart Importer (Scraper) ---
export async function scrapeProductFromUrl(url: string) {
  try {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const html = await response.text();

    // 1. استخراج الاسم - البحث الدقيق عن h2.title-detail
    const nameMatch = html.match(/<h2[^>]*class=["'][^"']*title-detail[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
    let name = nameMatch ? nameMatch[1].replace(/<[^>]*>?/gm, '').trim() : "";

    if (!name) {
        const hMatch = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
        name = hMatch ? hMatch[1].replace(/<[^>]*>?/gm, '').trim() : "";
    }

    // 2. استخراج السعر - البحث الدقيق عن span.current-price
    const priceMatch = html.match(/<span[^>]*class=["'][^"']*current-price[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    let price = 0;
    if (priceMatch) {
        const rawPrice = priceMatch[1].replace(/[^\d]/g, '');
        price = parseFloat(rawPrice);
    } else {
        const altPrice = html.match(/(\d{1,3}(?:[.,]\d{3})*)\s*د\.ع/i);
        if (altPrice) {
            const rawPrice = altPrice[1].replace(/[^\d]/g, '');
            price = parseFloat(rawPrice);
        }
    }

    // 3. استخراج الوصف - البحث الدقيق عن p.font-lg داخل short-desc
    // سنقوم بمسح الـ HTML للبحث عن الحاوية ثم الفقرة
    const shortDescBlock = html.match(/<div[^>]*class=["'][^"']*short-desc[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    let description = "";
    if (shortDescBlock) {
        const pMatch = shortDescBlock[1].match(/<p[^>]*class=["'][^"']*font-lg[^\"']*["'][^>]*>([\s\S]*?)<\/p>/i) ||
                       shortDescBlock[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        description = pMatch ? pMatch[1].replace(/<[^>]*>?/gm, '').trim() : "";
    }

    // إذا فشل، نحاول البحث عن أي p.font-lg في الصفحة كلها
    if (!description) {
        const fallbackP = html.match(/<p[^>]*class=["'][^"']*font-lg[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
        description = fallbackP ? fallbackP[1].replace(/<[^>]*>?/gm, '').trim() : "";
    }

    // استخراج الصورة
    const imgMatches = Array.from(html.matchAll(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi));
    let imageUrl = "";
    for (const match of imgMatches) {
        const src = match[1];
        if (src.includes('logo') || src.includes('icon') || src.includes('assets/img')) continue;
        if (src.includes('/items/') || src.includes('/products/') || src.match(/\.(jpg|jpeg|png|webp)/i)) {
            imageUrl = src;
            break;
        }
    }

    if (!imageUrl) {
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["']/i);
        imageUrl = ogMatch ? ogMatch[1] : "";
    }

    if (imageUrl && !imageUrl.startsWith('http')) {
        const domain = new URL(url).origin;
        imageUrl = domain + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
    }

    return { ok: true, data: { name, description, price, imageUrl } };
  } catch (error: any) {
    return { error: "فشل في سحب البيانات: " + error.message };
  }
}

export async function scrapeCategoryFromUrl(url: string) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();

        // 1. استخراج اسم الفرع - البحث عن الرابط النشط المطابق لعنوان URL الحالي
        let branchName = "";

        // محاولة استخراج المعرفات من الرابط (مثلاً 3/6)
        const urlMatch = url.match(/\/sub\/(\d+)\/(\d+)/);
        if (urlMatch) {
            const subId = urlMatch[2];
            // البحث عن الرابط الذي يحتوي على هذا المعرف ويجلب النص الخاص به
            const activeLinkRegex = new RegExp(`href=["'][^"']*\\/sub\\/\\d+\\/${subId}["'][^>]*>([\\s\\S]*?)<`, 'i');
            const activeMatch = html.match(activeLinkRegex);
            if (activeMatch) {
                branchName = activeMatch[1].replace(/<[^>]*>?/gm, '').trim();
            }
        }

        // إذا فشل، نعود لطريقة شريط المسار ولكن بفلترة أقوى
        if (!branchName) {
            const breadcrumbMatch = html.match(/<ul[^>]*class=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
            if (breadcrumbMatch) {
                const crumbs = Array.from(breadcrumbMatch[1].matchAll(/<li[^>]*>(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?<\/li>/gi));
                for (let i = crumbs.length - 1; i >= 0; i--) {
                    const text = crumbs[i][1].replace(/<[^>]*>?/gm, '').trim();
                    if (text && !["المتجر", "الرئيسية", "الرئيسي"].some(w => text.includes(w)) && text.length < 30) {
                        branchName = text;
                        break;
                    }
                }
            }
        }

        const normalizePathname = (value: string) => {
            try {
                const parsed = new URL(value, new URL(url).origin);
                return parsed.pathname.replace(/\/+$/, "");
            } catch {
                return String(value || "").split("?")[0].split("#")[0].replace(/\/+$/, "");
            }
        };
        const resolveImageUrl = (value: string) => {
            try {
                return new URL(value, new URL(url).origin).toString();
            } catch {
                return value;
            }
        };
        const pickBestImageFromChunk = (chunk: string): string => {
            const imgTagRegex = /<img[^>]*>/gi;
            const srcRegex = /(?:src|data-src|data-original)=["']([^"']+)["']/i;
            const classRegex = /class=["']([^"']+)["']/i;
            const badUrlRegex = /(facebook|logo|icon|social|avatar|favicon|sprite)/i;

            let best = "";
            let bestScore = -9999;
            const tags = Array.from(chunk.matchAll(imgTagRegex));

            for (const t of tags) {
                const tag = t[0] || "";
                const srcMatch = tag.match(srcRegex);
                if (!srcMatch?.[1]) continue;

                const raw = srcMatch[1].trim();
                const abs = resolveImageUrl(raw);
                const cls = (tag.match(classRegex)?.[1] || "").toLowerCase();
                const lower = abs.toLowerCase();

                let score = 0;
                if (/(default-img|product-img|img-responsive|category)/i.test(cls)) score += 120;
                if (lower.includes("/category/")) score += 90;
                if (lower.includes("/products/") || lower.includes("/item/")) score += 40;
                if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) score += 20;
                if (/\.svg(\?|$)/i.test(lower)) score -= 40;
                if (badUrlRegex.test(lower)) score -= 260;

                if (score > bestScore) {
                    bestScore = score;
                    best = abs;
                }
            }

            return bestScore > -100 ? best : "";
        };

        // 2. استخراج صورة الفرع - أولاً من نفس بطاقة الفرع المطابق للرابط
        let branchImageUrl = "";
        const targetPath = normalizePathname(url);
        const anchorMatches = Array.from(
            html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi)
        );

        for (const anchor of anchorMatches) {
            const href = anchor[1] || "";
            if (normalizePathname(href) !== targetPath) continue;
            const anchorHtml = anchor[0] || "";
            const inAnchor = pickBestImageFromChunk(anchorHtml);
            if (inAnchor) {
                branchImageUrl = inAnchor;
                break;
            }

            // fallback: ابحث ضمن نافذة أكبر حول نفس الرابط
            const linkIndex = html.indexOf(anchorHtml);
            if (linkIndex !== -1) {
                const start = Math.max(0, linkIndex - 1200);
                const end = Math.min(html.length, linkIndex + 1200);
                const searchWindow = html.substring(start, end);
                const nearAnchor = pickBestImageFromChunk(searchWindow);
                if (nearAnchor) {
                    branchImageUrl = nearAnchor;
                    break;
                }
            }
        }

        // إذا لم يجد من بطاقة الرابط المطابق، يبحث عن أي صورة category (بديل)
        if (!branchImageUrl) {
            const fallbackImg = html.match(/(?:src|data-src|data-original)=["']([^"']*\/category\/[^"']*)["']/i);
            branchImageUrl = fallbackImg ? fallbackImg[1] : "";
        }

        // إذا لم يجد في القائمة، يبحث عن صورة الـ Open Graph (تكون غالباً صورة القسم الرئيسية)
        if (!branchImageUrl) {
            const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
            branchImageUrl = ogImage ? ogImage[1] : "";
        }

        // إذا فشل تماماً، يأخذ أول صورة منتج كحل أخير
        if (!branchImageUrl) {
            const firstProductImg = html.match(/<img[^>]*(?:src|data-src|data-original)=["']([^"']*)["'][^>]*>/i);
            branchImageUrl = firstProductImg ? firstProductImg[1] : "";
        }

        if (branchImageUrl && !branchImageUrl.startsWith('http')) {
            const domain = new URL(url).origin;
            branchImageUrl = domain + (branchImageUrl.startsWith('/') ? '' : '/') + branchImageUrl;
        }

        if (branchImageUrl && !branchImageUrl.startsWith('http')) {
            const domain = new URL(url).origin;
            branchImageUrl = domain + (branchImageUrl.startsWith('/') ? '' : '/') + branchImageUrl;
        }

        // استخراج روابط المنتجات
        const productUrlMatches = Array.from(html.matchAll(/href=["']([^"']*\/item\/[^"']*)["']/gi));
        const productUrls = Array.from(new Set(productUrlMatches.map(m => m[1])));
        const domain = new URL(url).origin;
        const fullUrls = productUrls.map(u => u.startsWith('http') ? u : domain + u);

        return {
            ok: true,
            branchData: { name: branchName, imageUrl: branchImageUrl },
            productUrls: fullUrls
        };
    } catch (error: any) {
        return { error: "فشل في تحليل الرابط: " + error.message };
    }
}

/**
 * وظيفة متطورة لسحب روابط الأفرع واسم القسم
 */
export async function scrapeMainCategoryLinks(mainUrl: string) {
    try {
        let finalUrl = mainUrl.trim();
        if (!finalUrl.startsWith('http')) finalUrl = `https://ksebstor.site${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;

        const response = await fetch(finalUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const html = await response.text();

        const catIdMatch = finalUrl.match(/\/shop\/cat\/(\d+)/);
        if (!catIdMatch) return { error: "يرجى إدخال رابط قسم صحيح بصيغة /shop/cat/ID" };
        const catId = catIdMatch[1];

        let categoryName = "";
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        categoryName = h1Match ? h1Match[1].replace(/<[^>]*>?/gm, '').trim() : "قسم جديد";

        const branchLinks = [];
        const branchRegex = new RegExp(`href=["']([^"']*/shop/cat/${catId}/(\\d+)[^"']*)["'][^>]*>([\\s\\S]*?)<`, 'gi');

        let m;
        while ((m = branchRegex.exec(html)) !== null) {
            const rawUrl = m[1];
            const branchUrl = rawUrl.startsWith('http') ? rawUrl : `https://ksebstor.site${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
            const branchName = m[3].replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();

            if (branchName && branchName.length > 1 && branchName !== "المتجر") {
                if (branchLinks.some(b => b.url === branchUrl)) continue;

                // هنا لا نسحب المنتجات الآن، فقط نجهز القائمة
                branchLinks.push({
                    url: branchUrl,
                    name: branchName,
                    suggestedImage: "" // سنحاول جلب صورة مبدئية إذا لزم الأمر لاحقاً
                });
            }
        }

        return { ok: true, categoryName, branches: branchLinks };
    } catch (e: any) {
        return { error: e.message };
    }
}

/**
 * وظيفة جديدة لسحب منتجات فرع معين فقط عند الطلب
 */
export async function scrapeProductsFromBranch(branchUrl: string) {
    try {
        const branchRes = await fetch(branchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const branchHtml = await branchRes.text();
        const products = [];

        const prodMatches = Array.from(branchHtml.matchAll(/class=["'][^"']*product-card[^"']*["']>([\s\S]*?)<\/div>\s*<\/div>/gi));

        for (const pm of prodMatches) {
            if (products.length >= 20) break;
            const content = pm[1];

            const pNameMatch = content.match(/<h[2-6][^>]*>([\s\S]*?)<\/h/i) || content.match(/class=["'][^"']*(?:name|title)[^"']*["']>([\s\S]*?)<\//i);
            const pName = pNameMatch ? pNameMatch[1].replace(/<[^>]*>?/gm, '').trim() : "";

            const pPriceMatch = content.match(/(\d+(?:[.,]\d+)?)\s*(?:د\.ع|IQD)/i);
            const pPrice = pPriceMatch ? parseFloat(pPriceMatch[1].replace(/,/g, '')) : 0;

            const imgMatches = Array.from(content.matchAll(/src=["']([^"']*(?:\.jpg|\.png|\.webp|\.jpeg)[^"']*)["']/gi));
            let pImg = "";
            for(const img of imgMatches) {
                const src = img[1];
                if (src.includes('logo') || src.includes('icon') || src.includes('loading')) continue;
                pImg = src;
                break;
            }

            if (pImg && !pImg.startsWith('http')) pImg = `https://ksebstor.site${pImg.startsWith('/') ? '' : '/'}${pImg}`;

            if (pName) {
                products.push({ name: pName, price: pPrice, imageUrl: pImg });
            }
        }
        return { ok: true, products };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function createCategorySimple(name: string) {
    try {
        const cat = await prisma.storeCategory.create({
            data: { name, active: true, sequence: 0 }
        });
        return { ok: true, id: cat.id };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function createProductFromScrapedData(branchId: string, p: any, removeBg: boolean = true) {
    try {
        let photoUrls: string[] = [];

        // إنشاء المنتج فوراً مع رابط الصورة الخارجي كبداية (اختياري) أو مصفوفة فارغة
        const product = await prisma.storeProduct.create({
            data: {
                name: p.name,
                description: p.description || "",
                purchasePrice: (p.price || 0),
                salePrice: (p.price || 0),
                branchId: branchId,
                photoUrls: [],
                active: true,
                sequence: 0,
            }
        });

        // ثم محاولة جلب الصورة وحفظها محلياً في الخلفية (أو هنا وننتظرها)
        if (p.imageUrl) {
            try {
                const imgRes = await fetch(p.imageUrl, { signal: AbortSignal.timeout(15000) });
                if (imgRes.ok) {
                    const buffer = await imgRes.arrayBuffer();
                    const file = new File([buffer], "product.jpg", { type: imgRes.headers.get("content-type") || "image/jpeg" });
                    const savedUrl = await saveStoreProductImageUploaded(file, MAX_ORDER_IMAGE_BYTES, { removeBg });

                    await prisma.storeProduct.update({
                        where: { id: product.id },
                        data: { photoUrls: [savedUrl] }
                    });
                }
            } catch (e) {
                console.error("Product Image Import Failed", e);
            }
        }

        return { ok: true, id: product.id };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function bulkImportProducts(branchId: string, products: any[]) {
    try {
        for (const p of products) {
            let photoUrls: string[] = [];

            // تحميل صورة المنتج وتحويلها لـ Base64 داخلياً لضمان الاستقرار
            if (p.imageUrl) {
                try {
                    const imgRes = await fetch(p.imageUrl);
                    if (imgRes.ok) {
                        const buffer = await imgRes.arrayBuffer();
                        const file = new File([buffer], "product.jpg", { type: imgRes.headers.get("content-type") || "image/jpeg" });
                        const b64 = await saveStoreProductImageUploaded(file, MAX_ORDER_IMAGE_BYTES);
                        photoUrls.push(b64);
                    }
                } catch (e) { console.error("Img Import Failed", e); }
            }

            await prisma.storeProduct.create({
                data: {
                    name: p.name,
                    description: p.description || "",
                    purchasePrice: (p.price || 0),
                    salePrice: (p.price || 0),
                    branchId: branchId,
                    photoUrls: photoUrls,
                    active: true
                }
            });
        }
        revalidatePath("/admin/store/products");
        return { ok: true };
    } catch (e: any) {
        return { error: e.message };
    }
}
