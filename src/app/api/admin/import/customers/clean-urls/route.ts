import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export const runtime = "nodejs";

const R2_DOMAIN = process.env.R2_BUCKET_DOMAIN || "pub-2f347893a77443198f121df01053c847.r2.dev";

function extractBase64(str: string | null): string | null {
  if (!str) return null;
  const match = str.match(/data:image\/[^;]+;base64,([^\s"']+)/);
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  try {
    let profileUpdates = 0;
    let orderUpdates = 0;
    let shopUpdates = 0;
    let branchUpdates = 0;
    let productUpdates = 0;

    // 1. تنظيف الطلبيات (العمود الذي اكتشفته shopDoorPhotoUrl وغيرها)
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { shopDoorPhotoUrl: { contains: "base64" } },
          { imageUrl: { contains: "base64" } },
          { customerDoorPhotoUrl: { contains: "base64" } }
        ]
      }
    });

    for (const o of orders) {
      const updates: any = {};
      const fields: ("shopDoorPhotoUrl" | "imageUrl" | "customerDoorPhotoUrl")[] = ["shopDoorPhotoUrl", "imageUrl", "customerDoorPhotoUrl"];

      for (const field of fields) {
        const b64 = extractBase64(o[field]);
        if (b64) {
          try {
            const buffer = Buffer.from(b64, 'base64');
            const key = `orders/${field}/${o.id}.jpg`;
            const uploadedKey = await uploadToR2(buffer, key, "image/jpeg");
            if (uploadedKey) updates[field] = `https://${R2_DOMAIN}/${uploadedKey}`;
          } catch (e) {}
        }
      }
      if (Object.keys(updates).length > 0) {
        await prisma.order.update({ where: { id: o.id }, data: updates });
        orderUpdates++;
      }
    }

    // 2. تنظيف المحلات
    const shops = await prisma.shop.findMany({ where: { OR: [{ photoUrl: { contains: "base64" } }] } });
    for (const s of shops) {
      const b64 = extractBase64(s.photoUrl);
      if (b64) {
        try {
          const buffer = Buffer.from(b64, 'base64');
          const uploadedKey = await uploadToR2(buffer, `shops/${s.id}.jpg`, "image/jpeg");
          if (uploadedKey) {
            await prisma.shop.update({ where: { id: s.id }, data: { photoUrl: `https://${R2_DOMAIN}/${uploadedKey}` } });
            shopUpdates++;
          }
        } catch (e) {}
      }
    }

    // 3. تنظيف الأفرع
    const branches = await prisma.storeBranch.findMany({ where: { photoUrl: { contains: "base64" } } });
    for (const b of branches) {
      const b64 = extractBase64(b.photoUrl);
      if (b64) {
        try {
          const buffer = Buffer.from(b64, 'base64');
          const uploadedKey = await uploadToR2(buffer, `branches/${b.id}.jpg`, "image/jpeg");
          if (uploadedKey) {
            await prisma.storeBranch.update({ where: { id: b.id }, data: { photoUrl: `https://${R2_DOMAIN}/${uploadedKey}` } });
            branchUpdates++;
          }
        } catch (e) {}
      }
    }

    // 4. تنظيف المنتجات
    const allProducts = await prisma.storeProduct.findMany();
    for (const p of allProducts) {
      if (!p.photoUrls || p.photoUrls.length === 0) continue;
      let changed = false;
      const newUrls = [...p.photoUrls];
      for (let i = 0; i < newUrls.length; i++) {
        const b64 = extractBase64(newUrls[i]);
        if (b64) {
          try {
            const buffer = Buffer.from(b64, 'base64');
            const uploadedKey = await uploadToR2(buffer, `products/${p.id}-${i}.jpg`, "image/jpeg");
            if (uploadedKey) {
              newUrls[i] = `https://${R2_DOMAIN}/${uploadedKey}`;
              changed = true;
            }
          } catch (e) {}
        }
      }
      if (changed) {
        await prisma.storeProduct.update({ where: { id: p.id }, data: { photoUrls: newUrls } });
        productUpdates++;
      }
    }

    return NextResponse.json({
      success: true,
      profileUpdates,
      orderUpdates,
      shopUpdates,
      branchUpdates,
      productUpdates
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
