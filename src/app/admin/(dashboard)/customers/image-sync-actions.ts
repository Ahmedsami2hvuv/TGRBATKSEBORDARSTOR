import { prisma } from "@/lib/prisma";
import { uploadRemoteImageToR2 } from "@/lib/order-image";
import { revalidatePath } from "next/cache";
import { Client } from "pg";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

const OLD_DB_URL = process.env.OLD_DB_URL || "";
const OLD_BASE_URL = "https://tgrbatks-production.up.railway.app";

export async function syncCustomerImages() {
  const client = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();

    // 1. جلب كل من لديهم صور في القاعدة القديمة
    const oldRes = await client.query(`
      SELECT phone, "regionId", "photoUrl"
      FROM "CustomerPhoneProfile"
      WHERE "photoUrl" IS NOT NULL AND "photoUrl" != '' AND "photoUrl" != 'not_found'
    `);

    if (oldRes.rows.length === 0) {
      return { success: true, count: 0, message: "لا توجد صور في القاعدة القديمة لسحبها." };
    }

    // 2. جلب الزبائن الحاليين للمطابقة
    const localProfiles = await prisma.customerPhoneProfile.findMany({
      select: { id: true, phone: true, regionId: true, photoUrl: true }
    });

    const localMap = new Map<string, any>();
    for (const p of localProfiles) {
      const phone = normalizeIraqMobileLocal11(p.phone) || p.phone;
      localMap.set(`${phone}|${p.regionId}`, p);
    }

    let syncedCount = 0;
    let failedCount = 0;

    // 3. البدء في سحب الصور الناقصة فقط
    for (const row of oldRes.rows) {
      const phone = normalizeIraqMobileLocal11(row.phone) || row.phone;
      const key = `${phone}|${row.regionId}`;
      const local = localMap.get(key);

      // إذا كان الزبون موجوداً محلياً وصورته فارغة أو ليست على R2
      if (local && (!local.photoUrl || !local.photoUrl.includes("/uploads/"))) {
        let remoteUrl = row.photoUrl;

        // إصلاح الرابط إذا كان نسبياً
        if (remoteUrl && !remoteUrl.startsWith("http") && !remoteUrl.startsWith("data:")) {
          remoteUrl = `${OLD_BASE_URL}${remoteUrl.startsWith('/') ? '' : '/'}${remoteUrl}`;
        }

        try {
          const newR2Url = await uploadRemoteImageToR2(remoteUrl, "customers");
          if (newR2Url) {
            await prisma.customerPhoneProfile.update({
              where: { id: local.id },
              data: { photoUrl: newR2Url }
            });
            syncedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          console.error(`Error syncing image for ${phone}:`, err);
          failedCount++;
        }
      }

      // نتوقف عند 50 صورة في كل مرة لتجنب الـ Timeout في فيرسل
      if (syncedCount >= 50) break;
    }

    revalidatePath("/admin/customers");
    return {
      success: true,
      count: syncedCount,
      failed: failedCount,
      message: `تم سحب ${syncedCount} صورة بنجاح ورفعها لـ R2.`
    };
  } catch (error: any) {
    console.error("SYNC ERROR:", error);
    return { success: false, message: error.message };
  } finally {
    await client.end();
  }
}
