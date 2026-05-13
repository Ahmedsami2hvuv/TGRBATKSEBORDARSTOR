"use server";

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
    if (!OLD_DB_URL) {
      throw new Error("OLD_DB_URL is not defined in environment variables");
    }

    await client.connect();

    // 1. جلب كل من لديهم صور في القاعدة القديمة
    const oldRes = await client.query(`
      SELECT phone, "regionId", "photoUrl"
      FROM "CustomerPhoneProfile"
      WHERE "photoUrl" IS NOT NULL AND "photoUrl" != '' AND "photoUrl" != 'not_found'
    `);

    if (oldRes.rows.length === 0) {
      return { success: true, count: 0, skipped: 0, failed: 0, notFound: 0, message: "لا توجد صور في القاعدة القديمة لسحبها." };
    }

    // 2. جلب الزبائن الحاليين للمطابقة
    const localProfiles = await prisma.customerPhoneProfile.findMany({
      select: { id: true, phone: true, regionId: true, photoUrl: true }
    });

    const localMap = new Map<string, any>();
    for (const p of localProfiles) {
      const pRaw = String(p.phone ?? "").trim();
      const pPhone = normalizeIraqMobileLocal11(pRaw) || pRaw;
      const pRegion = String(p.regionId ?? "").trim();
      localMap.set(`${pPhone}|${pRegion}`, p);
    }

    let syncedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    // 3. البدء في سحب الصور الناقصة فقط
    for (const row of oldRes.rows) {
      const rRaw = String(row.phone ?? "").trim();
      const rPhone = normalizeIraqMobileLocal11(rRaw) || rRaw;
      const rRegion = String(row.regionId ?? "").trim();

      const key = `${rPhone}|${rRegion}`;
      const local = localMap.get(key);

      if (!local) {
        notFoundCount++;
        continue;
      }

      // إذا كانت الصورة موجودة محلياً وهي أصلاً مرفوعة على R2 أو بصيغة صحيحة، نتخطاها
      if (local.photoUrl && (local.photoUrl.startsWith("/uploads/") || local.photoUrl.includes("r2.dev"))) {
        skippedCount++;
        continue;
      }

      let remoteUrl = row.photoUrl;
      // إصلاح الرابط إذا كان نسبياً (مثل /media/...)
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
        console.error(`Error syncing image for ${rPhone}:`, err);
        failedCount++;
      }

      // نعالج 50 في كل مرة لتجنب الـ Timeout
      if (syncedCount >= 50) break;
    }

    revalidatePath("/admin/customers");
    return {
      success: true,
      count: syncedCount,
      failed: failedCount,
      skipped: skippedCount,
      notFound: notFoundCount,
      message: `اكتمل السحب: تم رفع ${syncedCount}, تخطي ${skippedCount}, فشل ${failedCount}, غير موجود ${notFoundCount}`
    };
  } catch (error: any) {
    console.error("SYNC ERROR:", error);
    return { success: false, message: error.message };
  } finally {
    try { await client.end(); } catch (e) {}
  }
}
