import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
const OLD_BASE_URL = "https://tgrbatks-production.up.railway.app";

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

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    await client.connect();

    const { offset = 0, limit = 15 } = await req.json().catch(() => ({ offset: 0, limit: 15 }));
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Number(limit))) : 15;

    const res = await client.query(`
      SELECT phone, "regionId", "photoUrl"
      FROM "CustomerPhoneProfile"
      WHERE "photoUrl" IS NOT NULL AND "photoUrl" != '' AND "photoUrl" != 'not_found'
      ORDER BY "createdAt" ASC
      LIMIT $1 OFFSET $2
    `, [safeLimit, offset]);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let notFoundLocalCount = 0;

    for (const row of res.rows) {
      const normalizedPhone = normalizeIraqMobileLocal11(String(row.phone ?? "")) || String(row.phone ?? "").trim();
      const localCustomer =
        (await prisma.customerPhoneProfile.findUnique({
          where: { phone_regionId: { phone: normalizedPhone, regionId: row.regionId } },
        })) ||
        (await prisma.customerPhoneProfile.findUnique({
          where: { phone_regionId: { phone: String(row.phone ?? "").trim(), regionId: row.regionId } },
        }));

      if (!localCustomer) {
        notFoundLocalCount++;
        continue;
      }

      if (isAlreadyOnR2OrUploads(localCustomer.photoUrl)) {
        skipCount++;
        continue;
      }

      try {
        let buffer: Buffer;
        let contentType = "image/jpeg";
        let ext = "jpg";

        const oldPhotoUrl = String(row.photoUrl ?? "").trim();
        if (!oldPhotoUrl) {
          skipCount++;
          continue;
        }

        const isDataImage = oldPhotoUrl.startsWith("data:image");
        const isRawBase64 = !isDataImage && !oldPhotoUrl.startsWith("http") && !oldPhotoUrl.startsWith("/") && oldPhotoUrl.length > 500;

        if (isDataImage || isRawBase64) {
          let base64Data = oldPhotoUrl;
          if (isDataImage) {
            const parts = oldPhotoUrl.split(",", 2);
            if (parts.length < 2 || !parts[1]) {
              errorCount++;
              continue;
            }
            const info = parts[0].split(";")[0];
            contentType = info.split(":")[1] || "image/jpeg";
            ext = contentType.split("/")[1] || "jpg";
            base64Data = parts[1];
          }
          buffer = Buffer.from(base64Data, "base64");
        } else {
          let targetUrl = oldPhotoUrl;
          if (targetUrl.startsWith("/")) targetUrl = `${OLD_BASE_URL}${targetUrl}`;
          else if (!targetUrl.startsWith("http")) targetUrl = `${OLD_BASE_URL}/${targetUrl}`;

          const imgRes = await fetch(targetUrl, {
            signal: AbortSignal.timeout(20000),
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (!imgRes.ok) {
            errorCount++;
            continue;
          }
          const arrayBuffer = await imgRes.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          contentType = imgRes.headers.get("content-type") || "image/jpeg";
          ext = contentType.split("/")[1] || "jpg";
        }

        const key = `customers/${normalizedPhone}-${row.regionId}.${Date.now()}.${ext}`;
        const uploadedKey = await uploadToR2(buffer, key, contentType);

        if (uploadedKey) {
          await prisma.customerPhoneProfile.update({
            where: { id: localCustomer.id },
            data: { photoUrl: `/uploads/${uploadedKey}` },
          });
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        console.error(`Sync error for ${row.phone}:`, err);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      synced: successCount,
      skipped: skipCount,
      errors: errorCount,
      notFoundLocal: notFoundLocalCount,
      rowsFetched: res.rows.length,
      message: `تم رفع ${successCount} صورة إلى R2. تم تخطي ${skipCount}، وفشل ${errorCount}، وغير موجود محلياً ${notFoundLocalCount}.`,
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
