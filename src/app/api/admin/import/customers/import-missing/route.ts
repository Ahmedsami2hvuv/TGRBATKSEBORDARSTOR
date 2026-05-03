import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    await client.connect();

    // ندعم الدفعات لتجنب timeout على Vercel
    const reqBody = await req.json().catch(() => ({}));
    const offsetRaw = Number((reqBody as any).offset ?? 0);
    const limitRaw = Number((reqBody as any).limit ?? 100);
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(300, limitRaw)) : 100;

    const [oldRes, allRegions, localProfiles] = await Promise.all([
      client.query(
        `
        SELECT cpp.phone, cpp."regionId", cpp."locationUrl", cpp."photoUrl", cpp.notes, cpp.landmark, cpp."alternatePhone",
               r.name as "regionName"
        FROM "CustomerPhoneProfile" cpp
        LEFT JOIN "Region" r ON cpp."regionId" = r.id
        ORDER BY cpp."createdAt" ASC
        LIMIT $1 OFFSET $2
      `,
        [limit, offset]
      ),
      prisma.region.findMany(),
      prisma.customerPhoneProfile.findMany({ select: { phone: true, regionId: true } }),
    ]);

    const existingKeys = new Set(localProfiles.map((p) => `${p.phone.trim()}|${p.regionId.trim()}`));
    const regionIdMap = new Set(allRegions.map((r) => r.id));
    const regionNameMap = new Map(allRegions.map((r) => [r.name.trim(), r.id]));

    let imported = 0;
    let skippedExisting = 0;
    let skippedNoRegion = 0;

    for (const row of oldRes.rows) {
      const phone = String(row.phone ?? "").trim();
      const regionId = String(row.regionId ?? "").trim();
      if (!phone || !regionId) {
        skippedNoRegion++;
        continue;
      }

      const key = `${phone}|${regionId}`;
      if (existingKeys.has(key)) {
        skippedExisting++;
        continue;
      }

      let targetRegionId: string | null = null;
      if (regionIdMap.has(regionId)) {
        targetRegionId = regionId;
      } else if (row.regionName && regionNameMap.has(String(row.regionName).trim())) {
        targetRegionId = regionNameMap.get(String(row.regionName).trim()) || null;
      } else if (row.regionName) {
        const newReg = await prisma.region.create({
          data: { id: regionId, name: String(row.regionName), deliveryPrice: 0 as any },
        });
        targetRegionId = newReg.id;
        regionIdMap.add(newReg.id);
        regionNameMap.set(newReg.name.trim(), newReg.id);
      }

      if (!targetRegionId) {
        skippedNoRegion++;
        continue;
      }

      await prisma.customerPhoneProfile.create({
        data: {
          phone,
          regionId: targetRegionId,
          locationUrl: String(row.locationUrl ?? ""),
          photoUrl: String(row.photoUrl ?? ""),
          notes: String(row.notes ?? ""),
          landmark: String(row.landmark ?? ""),
          alternatePhone: row.alternatePhone ? String(row.alternatePhone) : null,
        },
      });
      imported++;
      existingKeys.add(`${phone}|${targetRegionId}`);
    }

    return NextResponse.json({
      success: true,
      rowsFetched: oldRes.rows.length,
      imported,
      skippedExisting,
      skippedNoRegion,
      oldTotal: oldRes.rows.length,
      done: oldRes.rows.length < limit,
      message: `تمت مقارنة البيانات واستيراد ${imported} فقط من غير الموجود.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}

