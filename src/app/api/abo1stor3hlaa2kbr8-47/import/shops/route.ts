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
    const { offset = 0, limit = 5 } = await req.json().catch(() => ({}));
    await client.connect();

    // 1. جلب المحلات
    const resShops = await client.query(`
      SELECT s.id as "oldId", s.name, s."locationUrl", s."ownerName", s."photoUrl", s."phone",
             s."regionId", r.name as "regionName"
      FROM "Shop" s
      LEFT JOIN "Region" r ON s."regionId" = r.id
      ORDER BY s.id ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    if (resShops.rows.length === 0) return NextResponse.json({ success: true, count: 0, done: true });

    const allRegions = await prisma.region.findMany();
    const regionIdMap = new Set(allRegions.map(r => r.id));
    const regionNameMap = new Map(allRegions.map(r => [r.name.trim(), r.id]));
    const fallbackRegionId = allRegions[0]?.id || "";

    let shopsImported = 0;
    let employeesImported = 0;
    let customersImported = 0;

    for (const oldShop of resShops.rows) {
      let targetRegionId = fallbackRegionId;
      if (regionIdMap.has(oldShop.regionId)) {
        targetRegionId = oldShop.regionId;
      } else if (oldShop.regionName && regionNameMap.has(oldShop.regionName.trim())) {
        targetRegionId = regionNameMap.get(oldShop.regionName.trim())!;
      }

      const existingShop = await prisma.shop.findUnique({ where: { id: oldShop.oldId } });
      let finalShopPhotoUrl = existingShop?.photoUrl || "";

      const oldPhotoUrl = fixPhotoUrl(oldShop.photoUrl);
      if (oldPhotoUrl && (!finalShopPhotoUrl || (!finalShopPhotoUrl.includes("/uploads/") && !finalShopPhotoUrl.includes("r2.dev")))) {
        finalShopPhotoUrl = await uploadRemoteImageToR2(oldPhotoUrl, "shops");
      }

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

      // 2. سحب الموظفين - تحسين: جلب الكل مرة واحدة وفحص التغييرات
      const resEmp = await client.query(`SELECT id, name, phone, "orderPortalToken" FROM "Employee" WHERE "shopId" = $1`, [oldShop.oldId]);
      const oldEmployees = resEmp.rows;
      if (oldEmployees.length > 0) {
        const existingEmps = await prisma.employee.findMany({ where: { id: { in: oldEmployees.map(e => e.id) } } });
        const existingEmpMap = new Map(existingEmps.map(e => [e.id, e]));

        for (const oldEmp of oldEmployees) {
          const ext = existingEmpMap.get(oldEmp.id);
          // إذا كان الموظف موجوداً ومطابقاً تماماً، نتجاوزه لتوفير الوقت
          if (ext &&
              ext.name === oldEmp.name &&
              ext.phone === oldEmp.phone &&
              ext.shopId === newShop.id &&
              ext.orderPortalToken === oldEmp.orderPortalToken) {
            continue;
          }

          await prisma.employee.upsert({
            where: { id: oldEmp.id },
            update: { name: oldEmp.name, phone: oldEmp.phone, shopId: newShop.id, orderPortalToken: oldEmp.orderPortalToken },
            create: { id: oldEmp.id, name: oldEmp.name, phone: oldEmp.phone, shopId: newShop.id, orderPortalToken: oldEmp.orderPortalToken }
          });
          employeesImported++;
        }
      }

      // 3. سحب الزبائن - تحسين: جلب الكل مرة واحدة وفحص التغييرات
      const resCust = await client.query(`SELECT id, name, phone, "customerLocationUrl", "customerLandmark", "alternatePhone", "customerDoorPhotoUrl" FROM "Customer" WHERE "shopId" = $1`, [oldShop.oldId]);
      const oldCustomers = resCust.rows;
      if (oldCustomers.length > 0) {
        const existingCusts = await prisma.customer.findMany({ where: { id: { in: oldCustomers.map(c => c.id) } } });
        const existingCustMap = new Map(existingCusts.map(c => [c.id, c]));

        for (const oldCust of oldCustomers) {
          const ext = existingCustMap.get(oldCust.id);
          const oldCustPhoto = fixPhotoUrl(oldCust.customerDoorPhotoUrl);
          let finalCustomerPhotoUrl = ext?.customerDoorPhotoUrl || "";

          if (oldCustPhoto && (!finalCustomerPhotoUrl || (!finalCustomerPhotoUrl.includes("/uploads/") && !finalCustomerPhotoUrl.includes("r2.dev")))) {
             finalCustomerPhotoUrl = await uploadRemoteImageToR2(oldCustPhoto, "customers");
          }

          // إذا كان الزبون موجوداً ومطابقاً تماماً، نتجاوزه
          if (ext &&
              ext.name === (oldCust.name || "") &&
              ext.phone === oldCust.phone &&
              ext.shopId === newShop.id &&
              ext.customerDoorPhotoUrl === finalCustomerPhotoUrl &&
              ext.customerLocationUrl === (oldCust.customerLocationUrl || "") &&
              ext.customerLandmark === (oldCust.customerLandmark || "")) {
            continue;
          }

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
