import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
const OLD_BASE_URL = "https://tgrbatks-production.up.railway.app";
const R2_DOMAIN = "pub-2f347893a77443198f121df01053c847.r2.dev";

export async function POST() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 30000 });
  try {
    await client.connect();

    // 1. جلب عينة من الزبائن من السيرفر القديم الذين يملكون صوراً
    const res = await client.query(`
      SELECT phone, "regionId", "photoUrl"
      FROM "CustomerPhoneProfile"
      WHERE "photoUrl" IS NOT NULL AND "photoUrl" != '' AND "photoUrl" != 'not_found'
      LIMIT 10
    `);

    let successCount = 0;
    let skipCount = 0;

    for (const row of res.rows) {
      // 2. التحقق هل الصورة مرفوعة مسبقاً في قاعدتنا الجديدة؟
      const localCustomer = await prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone: row.phone, regionId: row.regionId } }
      });

      if (localCustomer?.photoUrl && localCustomer.photoUrl.includes(R2_DOMAIN)) {
        skipCount++;
        continue; // مرفوعة مسبقاً، تخطى
      }

      try {
        let buffer: Buffer;
        let contentType = "image/jpeg";
        let ext = "jpg";

        // 3. معالجة الصور (Base64 أو URL) القادمة من السيرفر القديم
        if (row.photoUrl.startsWith("data:image")) {
          const parts = row.photoUrl.split(",");
          const info = parts[0].split(";")[0];
          contentType = info.split(":")[1] || "image/jpeg";
          ext = contentType.split("/")[1] || "jpg";
          buffer = Buffer.from(parts[1], 'base64');
        } else {
          let targetUrl = row.photoUrl;
          if (targetUrl.startsWith("/")) targetUrl = `${OLD_BASE_URL}${targetUrl}`;
          else if (!targetUrl.startsWith("http")) targetUrl = `${OLD_BASE_URL}/${targetUrl}`;

          const imgRes = await fetch(targetUrl);
          if (!imgRes.ok) continue;
          const arrayBuffer = await imgRes.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          contentType = imgRes.headers.get("content-type") || "image/jpeg";
          ext = contentType.split("/")[1] || "jpg";
        }

        // 4. الرفع لـ R2
        const key = `customers/${row.phone}-${row.regionId}.${ext}`;
        const uploadedKey = await uploadToR2(buffer, key, contentType);

        if (uploadedKey) {
          const publicUrl = `https://${R2_DOMAIN}/${uploadedKey}`;
          await prisma.customerPhoneProfile.update({
            where: { phone_regionId: { phone: row.phone, regionId: row.regionId } },
            data: { photoUrl: publicUrl }
          });
          successCount++;
        }
      } catch (err) {
        console.error(`Sync error for ${row.phone}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      synced: successCount,
      skipped: skipCount,
      message: `تمت معالجة ${successCount} صور جديدة.`
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
