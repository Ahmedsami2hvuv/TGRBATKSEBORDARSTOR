import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { uploadRemoteImageToR2 } from "@/lib/order-image";

const OLD_DB_URL = process.env.OLD_DB_URL || "";
const OLD_BASE_URL = "https://tgrbatks-production.up.railway.app";

function isAlreadyOnR2(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("r2.dev") || url.startsWith("/uploads/");
}

export async function POST(req: NextRequest) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 15000 });
  try {
    const { offset = 0, limit = 15 } = await req.json();

    await client.connect();

    // 1. جلب عينة من الصور في القاعدة القديمة
    const oldRes = await client.query(`
      SELECT cpp.phone, cpp."regionId", cpp."photoUrl", r.name as "regionName"
      FROM "CustomerPhoneProfile" cpp
      LEFT JOIN "Region" r ON cpp."regionId" = r.id
      WHERE cpp."photoUrl" IS NOT NULL AND cpp."photoUrl" != '' AND cpp."photoUrl" != 'not_found'
      OFFSET $1 LIMIT $2
    `, [offset, limit]);

    if (oldRes.rows.length === 0) {
      return NextResponse.json({ success: true, rowsFetched: 0, synced: 0, skipped: 0 });
    }

    // 2. جلب المناطق المحلية للمطابقة بالاسم إذا اختلف الـ ID
    const localRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const regionNameMap = new Map(localRegions.map(r => [String(r.name).trim(), String(r.id).trim()]));

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    let notFoundLocal = 0;

    for (const row of oldRes.rows) {
      const phoneRaw = String(row.phone ?? "").trim();
      const phone = normalizeIraqMobileLocal11(phoneRaw) || phoneRaw;
      const oldRegionId = String(row.regionId ?? "").trim();
      const regionName = String(row.regionName ?? "").trim();

      // البحث عن الزبون محلياً (بالـ ID أو بالاسم)
      let local = await prisma.customerPhoneProfile.findFirst({
        where: {
          phone: phone,
          OR: [
            { regionId: oldRegionId },
            { region: { name: regionName } }
          ]
        }
      });

      if (!local) {
        notFoundLocal++;
        continue;
      }

      if (isAlreadyOnR2(local.photoUrl)) {
        skipped++;
        continue;
      }

      let remoteUrl = row.photoUrl;
      if (remoteUrl && !remoteUrl.startsWith("http") && !remoteUrl.startsWith("data:")) {
        remoteUrl = `${OLD_BASE_URL}${remoteUrl.startsWith('/') ? '' : '/'}${remoteUrl}`;
      }

      try {
        const newUrl = await uploadRemoteImageToR2(remoteUrl, "customers");
        if (newUrl) {
          await prisma.customerPhoneProfile.update({
            where: { id: local.id },
            data: { photoUrl: newUrl }
          });
          synced++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`Sync error for ${phone}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      rowsFetched: oldRes.rows.length,
      synced,
      skipped,
      errors,
      notFoundLocal
    });
  } catch (error: any) {
    console.error("SYNC API ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
