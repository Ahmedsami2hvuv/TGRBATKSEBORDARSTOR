import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export const runtime = "nodejs";

const R2_DOMAIN = process.env.R2_BUCKET_DOMAIN || "pub-2f347893a77443198f121df01053c847.r2.dev";

export async function POST(req: Request) {
  try {
    // 1. تنظيف بروفايلات الزبائن (CustomerPhoneProfile)
    const profilesWithBase64 = await prisma.customerPhoneProfile.findMany({
      where: { photoUrl: { startsWith: "data:image" } }
    });

    let profileUpdates = 0;
    for (const p of profilesWithBase64) {
      try {
        const parts = p.photoUrl.split(",");
        const base64Data = parts[1];
        const info = parts[0].split(";")[0];
        const contentType = info.split(":")[1] || "image/jpeg";
        const ext = contentType.split("/")[1] || "jpg";

        const buffer = Buffer.from(base64Data, 'base64');
        const key = `customers/${p.phone}-${p.regionId}.${ext}`;
        const uploadedKey = await uploadToR2(buffer, key, contentType);

        if (uploadedKey) {
          await prisma.customerPhoneProfile.update({
            where: { id: p.id },
            data: { photoUrl: `https://${R2_DOMAIN}/${uploadedKey}` }
          });
          profileUpdates++;
        }
      } catch (err) {}
    }

    // 2. تنظيف المحلات (Shop)
    const shopsWithBase64 = await prisma.shop.findMany({
      where: { photoUrl: { startsWith: "data:image" } }
    });
    let shopUpdates = 0;
    for (const s of shopsWithBase64) {
      try {
        const buffer = Buffer.from(s.photoUrl.split(",")[1], 'base64');
        const uploadedKey = await uploadToR2(buffer, `shops/${s.id}.jpg`, "image/jpeg");
        if (uploadedKey) {
          await prisma.shop.update({
            where: { id: s.id },
            data: { photoUrl: `https://${R2_DOMAIN}/${uploadedKey}` }
          });
          shopUpdates++;
        }
      } catch (err) {}
    }

    // 3. تنظيف الأفرع (StoreBranch)
    const branchesWithBase64 = await prisma.storeBranch.findMany({
      where: { photoUrl: { startsWith: "data:image" } }
    });
    let branchUpdates = 0;
    for (const b of branchesWithBase64) {
      try {
        const buffer = Buffer.from(b.photoUrl.split(",")[1], 'base64');
        const uploadedKey = await uploadToR2(buffer, `branches/${b.id}.jpg`, "image/jpeg");
        if (uploadedKey) {
          await prisma.storeBranch.update({
            where: { id: b.id },
            data: { photoUrl: `https://${R2_DOMAIN}/${uploadedKey}` }
          });
          branchUpdates++;
        }
      } catch (err) {}
    }

    // 4. تنظيف المنتجات (StoreProduct) - ملاحظة: الصور هنا مخزنة كـ Array
    const products = await prisma.storeProduct.findMany({
      where: { photoUrls: { hasSome: ["data:image/jpeg", "data:image/png", "data:image/webp"] } }
    });
    // ملاحظة: فلتر hasSome مع startsWith صعب في Prisma، سنقوم بفلترة يدوية بسيطة
    const productsWithBase64 = await prisma.storeProduct.findMany();
    let productUpdates = 0;
    for (const p of productsWithBase64) {
      if (!p.photoUrls || p.photoUrls.length === 0) continue;

      let changed = false;
      const newUrls = [...p.photoUrls];

      for (let i = 0; i < newUrls.length; i++) {
        if (newUrls[i].startsWith("data:image")) {
          try {
            const buffer = Buffer.from(newUrls[i].split(",")[1], 'base64');
            const uploadedKey = await uploadToR2(buffer, `products/${p.id}-${i}.jpg`, "image/jpeg");
            if (uploadedKey) {
              newUrls[i] = `https://${R2_DOMAIN}/${uploadedKey}`;
              changed = true;
            }
          } catch (err) {}
        }
      }

      if (changed) {
        await prisma.storeProduct.update({
          where: { id: p.id },
          data: { photoUrls: newUrls }
        });
        productUpdates++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `اكتمل التنظيف: ${profileUpdates} زبون، ${shopUpdates} محلات، ${branchUpdates} أفرع، ${productUpdates} منتجات.`,
      profileUpdates,
      shopUpdates,
      branchUpdates,
      productUpdates
    });

  } catch (error: any) {
    console.error("Clean error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
