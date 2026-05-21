import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadRemoteImageToR2 } from "@/lib/order-image";

const OLD_DB_URL = process.env.OLD_DB_URL || "";
const OLD_BASE_URL = "https://tgrbatks-production.up.railway.app";

function fixPhotoUrl(url: string | null): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${OLD_BASE_URL}${url}`;
  return `${OLD_BASE_URL}/${url}`;
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    const { offset = 0, limit = 10 } = await req.json().catch(() => ({}));
    await client.connect();

    // 1. جلب المحلات مع الـ regionId الأصلي
    const resShops = await client.query(`
      SELECT s.id as "oldId", s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone",
             s."regionId", r.name as "regionName"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
      ORDER BY s.id ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    if (resShops.rows.length === 0) return NextResponse.json({ success: true, count: 0, done: true });

    // جلب المناطق الحالية للمطابقة بالـ ID أو الاسم
    const allRegions = await prisma.region.findMany();
    const regionIdMap = new Set(allRegions.map(r => r.id));
    const regionNameMap = new Map(allRegions.map(r => [r.name.trim(), r.id]));
    const fallbackRegionId = allRegions[0]?.id || "";

    let shopsImported = 0;
    let employeesImported = 0;
    let customersImported = 0;

    for (const oldShop of resShops.rows) {
      // مطابقة المنطقة بالترتيب: ID ثم Name
      let targetRegionId = fallbackRegionId;
      if (regionIdMap.has(oldShop.regionId)) {
        targetRegionId = oldShop.regionId;
      } else if (oldShop.regionName && regionNameMap.has(oldShop.regionName.trim())) {
        targetRegionId = regionNameMap.get(oldShop.regionName.trim())!;
      }

      const finalShopPhotoUrl = await uploadRemoteImageToR2(fixPhotoUrl(oldShop.photoUrl), "shops");
      const newShop = await prisma.shop.upsert({
        where: { id: oldShop.oldId },
        update: {
          name: oldShop.name,
          locationUrl: oldShop.locationUrl || "",
          ownerName: oldShop.ownerName || "",
          phone: oldShop.phone || "",
          photoUrl: finalShopPhotoUrl,
          regionId: targetRegionId
        },
        create: {
          id: oldShop.oldId,
          name: oldShop.name,
          locationUrl: oldShop.locationUrl || "",
          ownerName: oldShop.ownerName || "",
          phone: oldShop.phone || "",
          photoUrl: finalShopPhotoUrl,
          regionId: targetRegionId
        }
      });
      shopsImported++;

      // 2. سحب الموظفين
      const resEmp = await client.query(`
        SELECT id, name, phone, "orderPortalToken"
        FROM "Employee"
        WHERE "shopId" = $1
      `, [oldShop.oldId]);

      for (const oldEmp of resEmp.rows) {
        await prisma.employee.upsert({
          where: { id: oldEmp.id },
          update: {
            name: oldEmp.name,
            phone: oldEmp.phone,
            shopId: newShop.id,
            orderPortalToken: oldEmp.orderPortalToken
          },
          create: {
            id: oldEmp.id,
            name: oldEmp.name,
            phone: oldEmp.phone,
            shopId: newShop.id,
            orderPortalToken: oldEmp.orderPortalToken
          }
        });
        employeesImported++;
      }

      // 3. سحب الزبائن المرتبطين بالمحل
      const resCust = await client.query(`
        SELECT id, name, phone, "customerLocationUrl", "customerLandmark", "alternatePhone", "customerDoorPhotoUrl"
        FROM "Customer"
        WHERE "shopId" = $1
      `, [oldShop.oldId]);

      for (const oldCust of resCust.rows) {
        const finalCustomerPhotoUrl = await uploadRemoteImageToR2(fixPhotoUrl(oldCust.customerDoorPhotoUrl), "customers");
        await prisma.customer.upsert({
          where: { id: oldCust.id },
          update: {
            name: oldCust.name || "",
            phone: oldCust.phone,
            shopId: newShop.id,
            customerLocationUrl: oldCust.customerLocationUrl || "",
            customerLandmark: oldCust.customerLandmark || "",
            alternatePhone: oldCust.alternatePhone,
            customerDoorPhotoUrl: finalCustomerPhotoUrl
          },
          create: {
            id: oldCust.id,
            name: oldCust.name || "",
            phone: oldCust.phone,
            shopId: newShop.id,
            customerLocationUrl: oldCust.customerLocationUrl || "",
            customerLandmark: oldCust.customerLandmark || "",
            alternatePhone: oldCust.alternatePhone,
            customerDoorPhotoUrl: finalCustomerPhotoUrl
          }
        });
        customersImported++;
      }
    }

    return NextResponse.json({
      success: true,
      shopsCount: shopsImported,
      employeesCount: employeesImported,
      customersCount: customersImported,
      done: resShops.rows.length < limit
    });

  } catch (error: any) {
    console.error("IMPORT ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
