import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

async function migrateCustomerImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";
  // إذا كانت الصورة مرفوعة مسبقاً على R2 الخاص بنا، لا ترفعها مرة أخرى
  if (oldUrl.includes("r2.dev") || oldUrl.includes("pub-")) return oldUrl;

  try {
    const response = await fetch(oldUrl, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg";

    const key = `customers/${nanoid(12)}.${extension}`;
    const uploadedKey = await uploadToR2(buffer, key, contentType);

    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "") || "https://pub-8c3866b1d40842a2818641a9675231c5.r2.dev";
    return `${publicUrl}/${uploadedKey}`;
  } catch (e) {
    console.error("Fetch/Upload Error for URL:", oldUrl, e);
    return "";
  }
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL });
  try {
    const { offset = 0, limit = 20 } = await req.json();

    // التأكد من وجود المجلد في R2
    if (offset === 0) {
      await uploadToR2(Buffer.from("kse-customers"), "customers/.init", "text/plain");
    }

    // جلب البروفايلات التي لديها روابط صور "قديمة" (لا تحتوي على r2.dev)
    const profiles = await prisma.customerPhoneProfile.findMany({
      where: {
        AND: [
          { photoUrl: { not: null } },
          { photoUrl: { not: "" } },
          { photoUrl: { not: { contains: "r2.dev" } } }
        ]
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    if (profiles.length === 0) {
      // إذا خلصنا الصور الموجودة "أصلاً"، نبحث عن الصور المفقودة في السيرفر القديم كخطوة ثانية
      const missingProfiles = await prisma.customerPhoneProfile.findMany({
        where: {
          OR: [
             { photoUrl: null },
             { photoUrl: "" }
          ]
        },
        skip: offset,
        take: limit
      });

      if (missingProfiles.length === 0) return NextResponse.json({ success: true, updated: 0, done: true });

      // منطق البحث في السيرفر القديم (للأمان فقط)
      await client.connect();
      let updatedCount = 0;
      for (const p of missingProfiles) {
        const oldRes = await client.query('SELECT "photoUrl" FROM "CustomerPhoneProfile" WHERE "phone" = $1 AND "photoUrl" IS NOT NULL LIMIT 1', [p.phone]);
        const oldUrl = oldRes.rows[0]?.photoUrl;
        if (oldUrl) {
          const newUrl = await migrateCustomerImage(oldUrl);
          if (newUrl) {
            await prisma.customerPhoneProfile.update({ where: { id: p.id }, data: { photoUrl: newUrl } });
            updatedCount++;
          }
        }
      }
      return NextResponse.json({ success: true, updated: updatedCount, done: missingProfiles.length < limit });
    }

    // معالجة الروابط الموجودة حالياً ورفعها لـ R2
    let updatedCount = 0;
    for (const profile of profiles) {
      if (profile.photoUrl) {
        console.log(`Migrating existing photo for ${profile.phone}: ${profile.photoUrl}`);
        const newUrl = await migrateCustomerImage(profile.photoUrl);
        if (newUrl) {
          await prisma.customerPhoneProfile.update({
            where: { id: profile.id },
            data: { photoUrl: newUrl }
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      processed: profiles.length,
      done: false
    });
  } catch (error: any) {
    console.error("SYNC ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    try { await client.end(); } catch(e) {}
  }
}
