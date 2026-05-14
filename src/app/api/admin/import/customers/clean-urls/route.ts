import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export const runtime = "nodejs";

const R2_DOMAIN = process.env.R2_BUCKET_DOMAIN || "pub-2f347893a77443198f121df01053c847.r2.dev";

// دالة ذكية لاستخراج الصورة سواء كانت Base64 أو رابطاً يحتاج سحب من ريلوي
async function processAnyImage(url: string | null, folder: string): Promise<string | null> {
  if (!url || (!url.includes("base64") && !url.includes("railway.app"))) return null;

  try {
    // الحالة الأولى: نص Base64 (سواء هجين أو مباشر)
    const b64Match = url.match(/data:image\/[^;]+;base64,([^\s"']+)/);
    if (b64Match) {
      const buffer = Buffer.from(b64Match[1], 'base64');
      const key = `${folder}/${crypto.randomUUID()}.jpg`;
      const uploadedKey = await uploadToR2(buffer, key, "image/jpeg");
      return uploadedKey ? `https://${R2_DOMAIN}/${uploadedKey}` : null;
    }

    // الحالة الثانية: رابط ريلوي "قصير" يحتاج سحب قبل أن يتوقف السيرفر
    if (url.includes("railway.app") && !url.includes("base64")) {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const fileName = url.split("/").pop()?.split("?")[0] || `${crypto.randomUUID()}.jpg`;
        const key = `${folder}/${fileName}`;
        const uploadedKey = await uploadToR2(buffer, key, contentType);
        return uploadedKey ? `https://${R2_DOMAIN}/${uploadedKey}` : null;
      }
    }
  } catch (e) {
    console.error("Failed to migrate image:", url, e);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    let orderUpdates = 0;
    let shopUpdates = 0;
    let productUpdates = 0;
    let profileUpdates = 0;
    let branchUpdates = 0;

    // 1. تنظيف الطلبيات (200 طلبية في كل ضغطة لتجنب التوقف)
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { shopDoorPhotoUrl: { contains: "railway.app" } },
          { shopDoorPhotoUrl: { contains: "base64" } },
          { customerDoorPhotoUrl: { contains: "railway.app" } },
          { customerDoorPhotoUrl: { contains: "base64" } },
          { imageUrl: { contains: "railway.app" } },
          { imageUrl: { contains: "base64" } }
        ]
      },
      take: 200
    });

    for (const o of orders) {
      const updates: any = {};
      const fields: ("shopDoorPhotoUrl" | "customerDoorPhotoUrl" | "imageUrl")[] = ["shopDoorPhotoUrl", "customerDoorPhotoUrl", "imageUrl"];
      for (const f of fields) {
        const newUrl = await processAnyImage(o[f], "orders");
        if (newUrl) updates[f] = newUrl;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.order.update({ where: { id: o.id }, data: updates });
        orderUpdates++;
      }
    }

    // 2. تنظيف المحلات
    const shops = await prisma.shop.findMany({
      where: {
        OR: [
          { photoUrl: { contains: "railway.app" } },
          { photoUrl: { contains: "base64" } }
        ]
      }
    });
    for (const s of shops) {
      const newUrl = await processAnyImage(s.photoUrl, "shops");
      if (newUrl) {
        await prisma.shop.update({ where: { id: s.id }, data: { photoUrl: newUrl } });
        shopUpdates++;
      }
    }

    // 3. تنظيف المنتجات
    const products = await prisma.storeProduct.findMany({
      where: {
        photoUrls: { hasSome: ["railway.app", "base64"] }
      }
    }).catch(() => []); // تجنب خطأ prisma إذا لم تدعم الفلتر

    // فحص يدوي للمنتجات لضمان شمولية الروابط الهجينة
    const allProducts = await prisma.storeProduct.findMany();
    for (const p of allProducts) {
      if (!p.photoUrls) continue;
      let changed = false;
      const newUrls = [...p.photoUrls];
      for (let i = 0; i < newUrls.length; i++) {
        const nUrl = await processAnyImage(newUrls[i], "products");
        if (nUrl) {
          newUrls[i] = nUrl;
          changed = true;
        }
      }
      if (changed) {
        await prisma.storeProduct.update({ where: { id: p.id }, data: { photoUrls: newUrls } });
        productUpdates++;
      }
    }

    return NextResponse.json({
      success: true,
      orderUpdates,
      shopUpdates,
      productUpdates,
      profileUpdates,
      branchUpdates
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
