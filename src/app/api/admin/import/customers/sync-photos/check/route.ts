import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { r2ObjectExistsByUrl } from "@/lib/upload-storage";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

function isAlreadyOnR2OrUploads(url: string | null | undefined): boolean {
  const value = (url || "").trim().toLowerCase();
  if (!value) return false;
  return (
    value.startsWith("/uploads/") ||
    value.includes("/uploads/") ||
    value.includes(".r2.dev") ||
    value.includes("cloudflarestorage.com")
  );
}

export async function GET() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();

    const oldRes = await client.query(`
      SELECT cpp.phone, cpp."regionId", r.name as "regionName"
      FROM "CustomerPhoneProfile" cpp
      LEFT JOIN "Region" r ON cpp."regionId" = r.id
      WHERE cpp."photoUrl" IS NOT NULL AND cpp."photoUrl" != '' AND cpp."photoUrl" != 'not_found'
    `);
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const regionIdMap = new Set(allRegions.map((r) => String(r.id).trim()));
    const regionNameMap = new Map(allRegions.map((r) => [String(r.name).trim(), String(r.id).trim()]));

    const localProfiles = await prisma.customerPhoneProfile.findMany({
      select: { phone: true, regionId: true, photoUrl: true },
    });

    const localMap = new Map<string, { photoUrl: string }>();
    for (const p of localProfiles) {
      const phoneRaw = String(p.phone ?? "").trim();
      const regionId = String(p.regionId ?? "").trim();
      if (!phoneRaw || !regionId) continue;
      const phone = normalizeIraqMobileLocal11(phoneRaw) || phoneRaw;
      localMap.set(`${phone}|${regionId}`, { photoUrl: String(p.photoUrl ?? "") });
    }

    const oldKeys = new Set<string>();
    for (const row of oldRes.rows) {
      const phoneRaw = String(row.phone ?? "").trim();
      const oldRegionId = String(row.regionId ?? "").trim();
      if (!phoneRaw || !oldRegionId) continue;
      const regionName = String(row.regionName ?? "").trim();
      let targetRegionId = oldRegionId;
      if (!regionIdMap.has(oldRegionId) && regionName && regionNameMap.has(regionName)) {
        targetRegionId = String(regionNameMap.get(regionName) ?? oldRegionId);
      }
      const phone = normalizeIraqMobileLocal11(phoneRaw) || phoneRaw;
      oldKeys.add(`${phone}|${targetRegionId}`);
    }

    let missingPhotos = 0;
    let alreadySynced = 0;
    let missingLocal = 0;
    for (const key of oldKeys) {
      const local = localMap.get(key);
      if (!local) {
        missingLocal++;
        continue;
      }
      if (isAlreadyOnR2OrUploads(local.photoUrl)) {
        const existsOnR2 = await r2ObjectExistsByUrl(local.photoUrl);
        if (existsOnR2) alreadySynced++;
        else missingPhotos++;
      } else {
        missingPhotos++;
      }
    }

    const [base64InCustomers, base64InOrders] = await Promise.all([
      prisma.customer.count({ where: { customerDoorPhotoUrl: { startsWith: "data:image" } } }),
      prisma.order.count({ where: { customerDoorPhotoUrl: { startsWith: "data:image" } } }),
    ]);

    return NextResponse.json({
      success: true,
      totalWithPhotoInOld: oldKeys.size,
      missingPhotos,
      alreadySynced,
      missingLocal,
      base64InCustomers,
      base64InOrders,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}

