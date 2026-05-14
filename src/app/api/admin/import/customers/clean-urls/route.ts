import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export const runtime = "nodejs";

const R2_DOMAIN = process.env.R2_BUCKET_DOMAIN || "pub-2f347893a77443198f121df01053c847.r2.dev";

async function processAnyImage(url: string | null, folder: string): Promise<{newUrl: string | null, shouldClear: boolean}> {
  if (!url || (!url.includes("base64") && !url.includes("railway.app"))) {
    return { newUrl: null, shouldClear: false };
  }

  try {
    // 1. معالجة الـ Base64 (حتى لو كان هجين مع رابط ريلوي)
    const b64Match = url.match(/data:image\/[^;]+;base64,([^\s"']+)/);
    if (b64Match) {
      const buffer = Buffer.from(b64Match[1], 'base64');
      const key = `${folder}/${crypto.randomUUID()}.jpg`;
      const uploadedKey = await uploadToR2(buffer, key, "image/jpeg");
      return { newUrl: uploadedKey ? `https://${R2_DOMAIN}/${uploadedKey}` : null, shouldClear: !uploadedKey };
    }

    // 2. معالجة روابط ريلوي المباشرة (سحب ورفع)
    if (url.includes("railway.app")) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get("content-type") || "image/jpeg";
          const fileName = url.split("/").pop()?.split("?")[0] || `${crypto.randomUUID()}.jpg`;
          const key = `${folder}/${fileName}`;
          const uploadedKey = await uploadToR2(buffer, key, contentType);
          return { newUrl: uploadedKey ? `https://${R2_DOMAIN}/${uploadedKey}` : null, shouldClear: false };
        } else {
          // إذا الرابط يعطي 404 أو السيرفر طافي، نعتبره رابط تالف ويجب مسحه
          return { newUrl: "", shouldClear: true };
        }
      } catch (e) {
        // فشل الاتصال بريلوي، نمسح الرابط لأنه سيعطل الصفحة
        return { newUrl: "", shouldClear: true };
      }
    }
  } catch (e) {
    console.error("Migration error:", e);
  }
  return { newUrl: null, shouldClear: false };
}

export async function POST(req: Request) {
  try {
    let orderUpdates = 0;
    let shopUpdates = 0;
    let productUpdates = 0;
    let profileUpdates = 0;

    // 1. تنظيف الطلبيات (تركيز عالي)
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { shopDoorPhotoUrl: { contains: "railway" } },
          { shopDoorPhotoUrl: { contains: "base64" } },
          { customerDoorPhotoUrl: { contains: "railway" } },
          { customerDoorPhotoUrl: { contains: "base64" } },
          { secondCustomerDoorPhotoUrl: { contains: "railway" } },
          { imageUrl: { contains: "railway" } }
        ]
      },
      take: 500 // زيادة العدد
    });

    for (const o of orders) {
      const updates: any = {};
      const fields: ("shopDoorPhotoUrl" | "customerDoorPhotoUrl" | "secondCustomerDoorPhotoUrl" | "imageUrl")[] =
        ["shopDoorPhotoUrl", "customerDoorPhotoUrl", "secondCustomerDoorPhotoUrl", "imageUrl"];

      for (const f of fields) {
        const res = await processAnyImage(o[f], "orders");
        if (res.newUrl !== null) updates[f] = res.newUrl;
        else if (res.shouldClear) updates[f] = "";
      }
      if (Object.keys(updates).length > 0) {
        await prisma.order.update({ where: { id: o.id }, data: updates });
        orderUpdates++;
      }
    }

    // 2. تنظيف المحلات (التي اشتكيت منها)
    const shops = await prisma.shop.findMany({
      where: {
        OR: [
          { photoUrl: { contains: "railway" } },
          { photoUrl: { contains: "base64" } }
        ]
      }
    });
    for (const s of shops) {
      const res = await processAnyImage(s.photoUrl, "shops");
      if (res.newUrl !== null) {
        await prisma.shop.update({ where: { id: s.id }, data: { photoUrl: res.newUrl } });
        shopUpdates++;
      } else if (res.shouldClear) {
        await prisma.shop.update({ where: { id: s.id }, data: { photoUrl: "" } });
        shopUpdates++;
      }
    }

    // 3. تنظيف بروفايلات الزبائن
    const profiles = await prisma.customerPhoneProfile.findMany({
      where: { photoUrl: { contains: "railway" } }
    });
    for (const p of profiles) {
      const res = await processAnyImage(p.photoUrl, "customers");
      if (res.newUrl !== null) {
        await prisma.customerPhoneProfile.update({ where: { id: p.id }, data: { photoUrl: res.newUrl } });
        profileUpdates++;
      }
    }

    // 4. تنظيف المنتجات (فحص يدوي شامل)
    const products = await prisma.storeProduct.findMany();
    for (const p of products) {
      if (!p.photoUrls || p.photoUrls.length === 0) continue;
      let changed = false;
      const newUrls = [...p.photoUrls];
      for (let i = 0; i < newUrls.length; i++) {
        const res = await processAnyImage(newUrls[i], "products");
        if (res.newUrl !== null) {
          newUrls[i] = res.newUrl;
          changed = true;
        } else if (res.shouldClear) {
          newUrls[i] = ""; // سيتم تصفيتها لاحقاً أو تركها فارغة
          changed = true;
        }
      }
      if (changed) {
        await prisma.storeProduct.update({
          where: { id: p.id },
          data: { photoUrls: newUrls.filter(u => u !== "") }
        });
        productUpdates++;
      }
    }

    return NextResponse.json({
      success: true,
      orderUpdates,
      shopUpdates,
      productUpdates,
      profileUpdates,
      branchUpdates: 0
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
