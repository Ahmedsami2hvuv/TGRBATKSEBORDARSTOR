import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

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
      SELECT phone, "regionId"
      FROM "CustomerPhoneProfile"
      WHERE "photoUrl" IS NOT NULL AND "photoUrl" != '' AND "photoUrl" != 'not_found'
    `);

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
      const regionId = String(row.regionId ?? "").trim();
      if (!phoneRaw || !regionId) continue;
      const phone = normalizeIraqMobileLocal11(phoneRaw) || phoneRaw;
      oldKeys.add(`${phone}|${regionId}`);
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
      if (isAlreadyOnR2OrUploads(local.photoUrl)) alreadySynced++;
      else missingPhotos++;
    }

    return NextResponse.json({
      success: true,
      totalWithPhotoInOld: oldKeys.size,
      missingPhotos,
      alreadySynced,
      missingLocal,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}

