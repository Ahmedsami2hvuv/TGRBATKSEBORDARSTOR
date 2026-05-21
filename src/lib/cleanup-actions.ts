"use server";

import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { r2ObjectExistsByUrl } from "@/lib/upload-storage";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

function decodeBase64Image(value: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const raw = value.trim();
  if (!raw) return null;

  if (raw.startsWith("data:image")) {
    const parts = raw.split(",", 2);
    if (parts.length < 2) return null;
    const meta = parts[0];
    const payload = parts[1];
    const contentType = (meta.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64$/)?.[1] || "image/jpeg").toLowerCase();
    const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
    return { buffer: Buffer.from(payload, "base64"), contentType, ext };
  }

  const looksRawBase64 = !raw.startsWith("http") && !raw.startsWith("/") && raw.length > 500;
  if (!looksRawBase64) return null;
  return { buffer: Buffer.from(raw, "base64"), contentType: "image/jpeg", ext: "jpg" };
}

async function fetchImageFromUrl(rawUrl: string): Promise<{ buffer: Buffer; contentType: string; ext: string } | null> {
  if (!rawUrl.startsWith("http")) return null;
  if (rawUrl.includes("/uploads/")) return null;
  if (rawUrl.includes("r2.dev")) return null;
  if (rawUrl.includes("cloudflarestorage.com")) return null;

  try {
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "image/jpeg").toLowerCase();
    const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType, ext };
  } catch {
    return null;
  }
}

export async function migrateBase64ImagesToR2() {
  let totalMigrated = 0;
  let totalFailed = 0;
  let totalScanned = 0;

  try {
    const profiles = await prisma.customerPhoneProfile.findMany({
      where: {
        OR: [
          { photoUrl: { startsWith: "data:image" } },
          { photoUrl: { contains: "base64" } },
          { photoUrl: { startsWith: "http" } },
        ],
      },
      select: { id: true, photoUrl: true },
      take: 300,
    });

    totalScanned = profiles.length;

    for (const row of profiles) {
      const raw = row.photoUrl || "";
      const parsed = decodeBase64Image(raw) || await fetchImageFromUrl(raw);
      if (!parsed) continue;

      const key = `profiles/${row.id}-${randomUUID()}.${parsed.ext}`;
      const uploadedKey = await uploadToR2(parsed.buffer, key, parsed.contentType);
      if (!uploadedKey) {
        totalFailed++;
        continue;
      }

      await prisma.customerPhoneProfile.update({
        where: { id: row.id },
        data: { photoUrl: `/uploads/${uploadedKey}` },
      });
      totalMigrated++;
    }

    revalidatePath(`${SECRET_ADMIN_PATH}/customers`);
    revalidatePath(`${SECRET_ADMIN_PATH}/customers/profiles`);

    return {
      success: true,
      scanned: totalScanned,
      migrated: totalMigrated,
      failed: totalFailed,
      message: `تم تحويل ${totalMigrated} صورة إلى R2 بنجاح.`,
    };
  } catch (error) {
    console.error("migrateBase64ImagesToR2 error:", error);
    return { success: false, scanned: totalScanned, migrated: totalMigrated, failed: totalFailed, message: "فشل تحويل الصور إلى R2." };
  }
}

/**
 * تنظيف شامل وقوي لقاعدة البيانات من الصور المخزنة بصيغة Base64
 * يشمل الأقسام، ملفات التعريف، والطلبات
 */
export async function cleanupBase64Images() {
  console.log("Starting Deep Database Cleanup...");

  try {
    // 1. الأقسام (StoreCategory)
    // نبحث عن أي رابط يبدأ بـ data:image أو يحتوي على base64
    await prisma.storeCategory.updateMany({
      where: {
        OR: [
          { photoUrl: { contains: "base64" } },
          { photoUrl: { startsWith: "data:image" } }
        ]
      },
      data: { photoUrl: "" }
    });

    // 2. ملفات تعريف هاتف الزبون (CustomerPhoneProfile) - هذي اللي فيها صور الأبواب غالباً
    await prisma.customerPhoneProfile.updateMany({
      where: {
        OR: [
          { photoUrl: { contains: "base64" } },
          { photoUrl: { startsWith: "data:image" } }
        ]
      },
      data: { photoUrl: "" }
    });

    // 3. الطلبات (Order) - صور الأبواب في الطلبات الفردية
    const orderFields = ["imageUrl", "shopDoorPhotoUrl", "customerDoorPhotoUrl", "secondCustomerDoorPhotoUrl"];
    for (const field of orderFields) {
      await (prisma.order as any).updateMany({
        where: {
          OR: [
            { [field]: { contains: "base64" } },
            { [field]: { startsWith: "data:image" } }
          ]
        },
        data: { [field]: null }
      });
    }

    // 4. المنتجات (StoreProduct) - مصفوفة نصوص
    const products = await prisma.storeProduct.findMany({
      where: {
        photoUrls: { hasSome: ["base64"] } // هذا فلتر تقريبي لأن Prisma لا تدعم contains داخل المصفوفة بسهولة
      },
      select: { id: true, photoUrls: true }
    });

    // حل بديل للمنتجات: جلب الكل وفلترتهم برمجياً لضمان الدقة
    const allProductsWithImages = await prisma.storeProduct.findMany({
      where: { photoUrls: { isEmpty: false } },
      select: { id: true, photoUrls: true }
    });

    for (const p of allProductsWithImages) {
      const filtered = p.photoUrls.filter(url =>
        !url.includes("base64") && !url.startsWith("data:image")
      );
      if (filtered.length !== p.photoUrls.length) {
        await prisma.storeProduct.update({
          where: { id: p.id },
          data: { photoUrls: filtered }
        });
      }
    }

    // 5. الزبائن (Customer)
    await prisma.customer.updateMany({
      where: {
        OR: [
          { customerDoorPhotoUrl: { contains: "base64" } },
          { customerDoorPhotoUrl: { startsWith: "data:image" } }
        ]
      },
      data: { customerDoorPhotoUrl: null }
    });

    // 6. المحلات (Shop) والفروع (StoreBranch)
    await prisma.shop.updateMany({
      where: { OR: [{ photoUrl: { contains: "base64" } }, { photoUrl: { startsWith: "data:image" } }] },
      data: { photoUrl: "" }
    });

    await prisma.storeBranch.updateMany({
      where: { OR: [{ photoUrl: { contains: "base64" } }, { photoUrl: { startsWith: "data:image" } }] },
      data: { photoUrl: "" }
    });

    console.log("Deep Cleanup completed successfully!");
    return { success: true, message: "تم تنظيف كافة الجداول بنجاح بما في ذلك الأقسام وصور الأبواب." };
  } catch (error) {
    console.error("Cleanup Error:", error);
    return { success: false, message: "حدث خطأ أثناء التنظيف." };
  }
}

function normalizeUploadsUrl(raw: string | null | undefined): string | null {
  const v = String(raw || "").trim().replace(/^['"]+|['"]+$/g, "");
  if (!v || v.startsWith("data:")) return null;

  if (v.startsWith("/uploads/")) return v;
  if (v.startsWith("uploads/")) return `/${v}`;

  const normalized = v.replace(/\\/g, "/");
  const inPath = normalized.toLowerCase().indexOf("/uploads/");
  if (inPath >= 0) return normalized.slice(inPath);

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const parsed = new URL(normalized);
      const p = decodeURIComponent(parsed.pathname || "").replace(/\\/g, "/");
      if (p.startsWith("/uploads/")) return p;
      if (p.startsWith("/")) return `/uploads${p}`;
      return `/uploads/${p}`;
    } catch {
      return null;
    }
  }

  if (normalized.startsWith("/")) return `/uploads${normalized}`;
  return `/uploads/${normalized}`;
}

function extensionVariants(path: string): string[] {
  const extMap: Record<string, string[]> = {
    ".jpeg": [".jpg", ".png", ".webp"],
    ".jpg": [".jpeg", ".png", ".webp"],
    ".png": [".jpg", ".jpeg", ".webp"],
    ".webp": [".jpg", ".jpeg", ".png"],
  };
  const lower = path.toLowerCase();
  const ext = Object.keys(extMap).find((e) => lower.endsWith(e));
  if (!ext) return [path];
  const base = path.slice(0, path.length - ext.length);
  return [path, ...extMap[ext].map((e) => `${base}${e}`)];
}

function folderVariants(path: string, folders: string[]): string[] {
  const current = path.replace(/^\/+/, "");
  const firstSlash = current.indexOf("/");
  if (firstSlash <= 0) return [`/${current}`];
  const tail = current.slice(firstSlash + 1);
  const out = new Set<string>([`/${current}`]);
  for (const f of folders) out.add(`/uploads/${f}/${tail}`);
  return [...out];
}

async function resolveExistingUploadsUrl(
  raw: string | null | undefined,
  preferredFolders: string[],
): Promise<string | null> {
  const normalized = normalizeUploadsUrl(raw);
  if (!normalized) return null;

  const candidates = new Set<string>();
  for (const folderCandidate of folderVariants(normalized, preferredFolders)) {
    for (const extCandidate of extensionVariants(folderCandidate)) {
      candidates.add(extCandidate);
    }
  }

  for (const c of candidates) {
    if (await r2ObjectExistsByUrl(c)) return c;
  }
  return null;
}

type FixBatchResult = {
  success: boolean;
  scanned: number;
  fixed: number;
  unresolved: number;
  message: string;
};

export async function repairBrokenUploadsUrlsBatch(limit = 700): Promise<FixBatchResult> {
  const hardLimit = Math.min(Math.max(Number(limit) || 700, 100), 2500);
  let scanned = 0;
  let fixed = 0;
  let unresolved = 0;
  let budget = hardLimit;

  try {
    const customers = await prisma.customer.findMany({
      where: { customerDoorPhotoUrl: { not: null } },
      select: { id: true, customerDoorPhotoUrl: true },
      take: budget,
      orderBy: { id: "desc" },
    });
    for (const row of customers) {
      if (budget <= 0) break;
      budget--;
      scanned++;
      const fixedUrl = await resolveExistingUploadsUrl(row.customerDoorPhotoUrl, ["customers", "profiles"]);
      if (!fixedUrl) {
        unresolved++;
        continue;
      }
      if (fixedUrl !== row.customerDoorPhotoUrl) {
        await prisma.customer.update({ where: { id: row.id }, data: { customerDoorPhotoUrl: fixedUrl } });
        fixed++;
      }
    }

    if (budget > 0) {
      const profiles = await prisma.customerPhoneProfile.findMany({
        where: { photoUrl: { not: "" } },
        select: { id: true, photoUrl: true },
        take: budget,
        orderBy: { id: "desc" },
      });
      for (const row of profiles) {
        if (budget <= 0) break;
        budget--;
        scanned++;
        const fixedUrl = await resolveExistingUploadsUrl(row.photoUrl, ["profiles", "customers"]);
        if (!fixedUrl) {
          unresolved++;
          continue;
        }
        if (fixedUrl !== row.photoUrl) {
          await prisma.customerPhoneProfile.update({ where: { id: row.id }, data: { photoUrl: fixedUrl } });
          fixed++;
        }
      }
    }

    if (budget > 0) {
      const orders = await prisma.order.findMany({
        where: {
          OR: [
            { imageUrl: { not: null } },
            { shopDoorPhotoUrl: { not: null } },
            { customerDoorPhotoUrl: { not: null } },
            { secondCustomerDoorPhotoUrl: { not: null } },
          ],
        },
        select: {
          id: true,
          imageUrl: true,
          shopDoorPhotoUrl: true,
          customerDoorPhotoUrl: true,
          secondCustomerDoorPhotoUrl: true,
        },
        take: budget,
        orderBy: { id: "desc" },
      });

      for (const row of orders) {
        if (budget <= 0) break;
        budget--;
        scanned++;

        const imageUrl = await resolveExistingUploadsUrl(row.imageUrl, ["orders"]);
        const shopDoorPhotoUrl = await resolveExistingUploadsUrl(row.shopDoorPhotoUrl, ["shops"]);
        const customerDoorPhotoUrl = await resolveExistingUploadsUrl(row.customerDoorPhotoUrl, ["customers", "profiles"]);
        const secondCustomerDoorPhotoUrl = await resolveExistingUploadsUrl(row.secondCustomerDoorPhotoUrl, ["customers", "profiles"]);

        const data: {
          imageUrl?: string | null;
          shopDoorPhotoUrl?: string | null;
          customerDoorPhotoUrl?: string | null;
          secondCustomerDoorPhotoUrl?: string | null;
        } = {};

        let rowChanged = false;
        let rowResolvedAny = false;

        if (imageUrl) {
          rowResolvedAny = true;
          if (imageUrl !== row.imageUrl) {
            data.imageUrl = imageUrl;
            rowChanged = true;
          }
        }
        if (shopDoorPhotoUrl) {
          rowResolvedAny = true;
          if (shopDoorPhotoUrl !== row.shopDoorPhotoUrl) {
            data.shopDoorPhotoUrl = shopDoorPhotoUrl;
            rowChanged = true;
          }
        }
        if (customerDoorPhotoUrl) {
          rowResolvedAny = true;
          if (customerDoorPhotoUrl !== row.customerDoorPhotoUrl) {
            data.customerDoorPhotoUrl = customerDoorPhotoUrl;
            rowChanged = true;
          }
        }
        if (secondCustomerDoorPhotoUrl) {
          rowResolvedAny = true;
          if (secondCustomerDoorPhotoUrl !== row.secondCustomerDoorPhotoUrl) {
            data.secondCustomerDoorPhotoUrl = secondCustomerDoorPhotoUrl;
            rowChanged = true;
          }
        }

        if (!rowResolvedAny) {
          unresolved++;
          continue;
        }
        if (rowChanged) {
          await prisma.order.update({ where: { id: row.id }, data });
          fixed++;
        }
      }
    }

    revalidatePath(`${SECRET_ADMIN_PATH}/customers`);
    revalidatePath(`${SECRET_ADMIN_PATH}/customers/profiles`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/pending`);
    revalidatePath(`${SECRET_ADMIN_PATH}/orders/tracking`);

    return {
      success: true,
      scanned,
      fixed,
      unresolved,
      message: `تم فحص ${scanned} سجل، إصلاح ${fixed} رابط، وبقي ${unresolved} يحتاج تدخل يدوي.`,
    };
  } catch (error) {
    console.error("repairBrokenUploadsUrlsBatch error:", error);
    return {
      success: false,
      scanned,
      fixed,
      unresolved,
      message: "فشل أثناء إصلاح روابط الصور.",
    };
  }
}
