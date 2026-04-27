import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

// دالة مساعدة لتحميل صورة من رابط ورفعها إلى R2
async function migrateImage(oldUrl: string | null | undefined, prefix: string): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return oldUrl || "";

  // إذا كانت الصورة مسحوبة بالفعل لـ R2 لا داعي لإعادة سحبها
  if (oldUrl.includes("r2.dev") || (R2_PUBLIC_URL && oldUrl.includes(R2_PUBLIC_URL))) {
    return oldUrl;
  }

  try {
    const response = await fetch(oldUrl);
    if (!response.ok) return oldUrl; // إذا فشل التحميل نحتفظ بالرابط القديم مؤقتاً

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1] || "jpg";
    const key = `imported/${prefix}_${nanoid()}.${extension}`;

    const uploadedKey = await uploadToR2(buffer, key, contentType);
    if (uploadedKey) {
      return `${R2_PUBLIC_URL}/${uploadedKey}`;
    }
  } catch (e) {
    console.error("Failed to migrate image:", oldUrl, e);
  }
  return oldUrl;
}

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });

  try {
    await client.connect();

    // جلب البيانات المرجعية
    const [allShops, allRegions, existingCustomers] = await Promise.all([
      prisma.shop.findMany({ select: { id: true, name: true } }),
      prisma.region.findMany({ select: { id: true, name: true } }),
      prisma.customer.findMany({ select: { phone: true, shopId: true } })
    ]);

    const shopMap = new Map(allShops.map(s => [s.name, s.id]));
    const regionMap = new Map(allRegions.map(r => [r.name, r.id]));
    const customerSet = new Set(existingCustomers.map(c => `${c.phone}-${c.shopId}`));

    const resCust = await client.query(`
      SELECT c.name, c.phone, c."customerLocationUrl", c."customerLandmark", c."customerDoorPhotoUrl",
             r.name as "regionName", s.name as "shopName"
      FROM "Customer" c
      LEFT JOIN "Region" r ON c."customerRegionId" = r.id
      LEFT JOIN "Shop" s ON c."shopId" = s.id
    `);

    let importedCust = 0;
    // سنقوم بمعالجة أول 50 زبون فقط في كل ضغطة إذا كان هناك صور، لضمان عدم توقف السيرفر
    // أو سنقوم بسحب البيانات أولاً ثم عمل "مزامنة صور" لاحقاً.

    const customersToCreate = [];

    for (const oldCust of resCust.rows) {
      const shopId = shopMap.get(oldCust.shopName);
      if (!shopId) continue;

      if (!customerSet.has(`${oldCust.phone}-${shopId}`)) {
        // ملاحظة: لسرعة الاستيراد الأولي، سنسحب الروابط كما هي،
        // ثم نستخدم أكشن "مزامنة الصور" لنقلها لـ R2 في الخلفية.
        customersToCreate.push({
          name: oldCust.name || "",
          phone: oldCust.phone,
          shopId: shopId,
          customerRegionId: regionMap.get(oldCust.regionName) || null,
          customerLocationUrl: oldCust.customerLocationUrl || "",
          customerLandmark: oldCust.customerLandmark || "",
          customerDoorPhotoUrl: oldCust.customerDoorPhotoUrl || "", // ستبقى مؤقتاً كرابط قديم
        });
        importedCust++;
      }
    }

    if (customersToCreate.length > 0) {
      await prisma.customer.createMany({ data: customersToCreate, skipDuplicates: true });
    }

    return NextResponse.json({
      success: true,
      customers: importedCust,
      message: "تم سحب البيانات بنجاح. يرجى تشغيل 'مزامنة الصور' لنقل الصور لـ R2."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
