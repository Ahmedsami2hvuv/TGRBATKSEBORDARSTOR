import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export const runtime = "nodejs";

const R2_DOMAIN = process.env.R2_BUCKET_DOMAIN || "pub-2f347893a77443198f121df01053c847.r2.dev";

async function processAnyImage(url: string | null, folder: string): Promise<{newUrl: string | null, forceClear: boolean}> {
  if (!url) return { newUrl: null, forceClear: false };

  const lowerUrl = url.toLowerCase();
  const isRailway = lowerUrl.includes("railway");
  const isBase64 = lowerUrl.includes("base64");

  if (!isRailway && !isBase64) return { newUrl: null, forceClear: false };

  try {
    // 1. معالجة الـ Base64 (الصور الثقيلة جداً)
    const b64Match = url.match(/data:image\/[^;]+;base64,([^\s"']+)/);
    if (b64Match) {
      const buffer = Buffer.from(b64Match[1], 'base64');
      const key = `${folder}/${crypto.randomUUID()}.jpg`;
      const uploadedKey = await uploadToR2(buffer, key, "image/jpeg");
      return { newUrl: uploadedKey ? `https://${R2_DOMAIN}/${uploadedKey}` : null, forceClear: !uploadedKey };
    }

    // 2. معالجة روابط ريلوي (سحب ورفع)
    if (isRailway) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get("content-type") || "image/jpeg";
          const fileName = url.split("/").pop()?.split("?")[0] || `${crypto.randomUUID()}.jpg`;
          const key = `${folder}/${fileName}`;
          const uploadedKey = await uploadToR2(buffer, key, contentType);
          return { newUrl: uploadedKey ? `https://${R2_DOMAIN}/${uploadedKey}` : null, forceClear: true };
        }
      } catch (e) {}
      return { newUrl: "", forceClear: true };
    }
  } catch (e) {
    console.error("Process error:", e);
  }
  return { newUrl: null, forceClear: false };
}

export async function POST(req: Request) {
  try {
    let orderUpdates = 0;
    let shopUpdates = 0;
    let productUpdates = 0;
    let profileUpdates = 0;

    // 1. تنظيف بروفايلات الزبائن (إضافة البحث عن base64 هنا)
    const profiles = await prisma.customerPhoneProfile.findMany({
      where: {
        OR: [
          { photoUrl: { contains: "base64", mode: "insensitive" } },
          { photoUrl: { contains: "railway", mode: "insensitive" } }
        ]
      }
    });
    for (const p of profiles) {
      const res = await processAnyImage(p.photoUrl, "customers");
      if (res.newUrl !== null || res.forceClear) {
        await prisma.customerPhoneProfile.update({
          where: { id: p.id },
          data: { photoUrl: res.newUrl || "" }
        });
        profileUpdates++;
      }
    }

    // 2. تنظيف المحلات
    const shops = await prisma.shop.findMany({
      where: { OR: [{ photoUrl: { contains: "railway", mode: "insensitive" } }, { photoUrl: { contains: "base64", mode: "insensitive" } }] }
    });
    for (const s of shops) {
      const res = await processAnyImage(s.photoUrl, "shops");
      if (res.newUrl !== null || res.forceClear) {
        await prisma.shop.update({ where: { id: s.id }, data: { photoUrl: res.newUrl || "" } });
        shopUpdates++;
      }
    }

    // 3. تنظيف الطلبيات
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { shopDoorPhotoUrl: { contains: "railway", mode: "insensitive" } },
          { shopDoorPhotoUrl: { contains: "base64", mode: "insensitive" } },
          { customerDoorPhotoUrl: { contains: "base64", mode: "insensitive" } },
          { customerDoorPhotoUrl: { contains: "railway", mode: "insensitive" } },
          { imageUrl: { contains: "railway", mode: "insensitive" } }
        ]
      },
      take: 500
    });
    for (const o of orders) {
      const updates: any = {};
      const fields: ("shopDoorPhotoUrl" | "customerDoorPhotoUrl" | "imageUrl")[] = ["shopDoorPhotoUrl", "customerDoorPhotoUrl", "imageUrl"];
      for (const f of fields) {
        const res = await processAnyImage(o[f], "orders");
        if (res.newUrl !== null || res.forceClear) updates[f] = res.newUrl || "";
      }
      if (Object.keys(updates).length > 0) {
        await prisma.order.update({ where: { id: o.id }, data: updates });
        orderUpdates++;
      }
    }

    // 4. تنظيف المنتجات
    const products = await prisma.storeProduct.findMany();
    for (const p of products) {
      if (!p.photoUrls || p.photoUrls.length === 0) continue;
      let changed = false;
      const newUrls = [...p.photoUrls];
      for (let i = 0; i < newUrls.length; i++) {
        const res = await processAnyImage(newUrls[i], "products");
        if (res.newUrl !== null || res.forceClear) {
          newUrls[i] = res.newUrl || "";
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

    return NextResponse.json({ success: true, orderUpdates, shopUpdates, productUpdates, profileUpdates, branchUpdates: 0 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
