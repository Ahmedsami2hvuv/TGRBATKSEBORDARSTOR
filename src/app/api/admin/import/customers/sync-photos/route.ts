import { NextResponse } from "next/server";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";
import { nanoid } from "nanoid";

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";

async function migrateCustomerImage(oldUrl: string | null | undefined): Promise<string> {
  if (!oldUrl || !oldUrl.startsWith("http")) return "";
  if (oldUrl.includes("r2.dev") || oldUrl.includes("pub-")) return oldUrl;

  try {
    const response = await fetch(oldUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg";

    const key = `customers/${nanoid(12)}.${extension}`;
    const uploadedKey = await uploadToR2(buffer, key, contentType);

    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "") || "https://pub-8c3866b1d40842a2818641a9675231c5.r2.dev";
    return `${publicUrl}/${uploadedKey}`;
  } catch (e) { return ""; }
}

export async function POST(req: Request) {
  const client = new Client({ connectionString: OLD_DB_URL });
  try {
    const { offset = 0, limit = 20 } = await req.json();

    // إنشاء المجلد في R2 عند أول طلب
    if (offset === 0) {
      await uploadToR2(Buffer.from("kse-customers"), "customers/.init", "text/plain");
    }

    const profiles = await prisma.customerProfile.findMany({
      where: {
        OR: [
          { photoUrl: "" },
          { photoUrl: null as any },
          { photoUrl: { not: { contains: "r2.dev" } } }
        ]
      },
      skip: offset,
      take: limit,
      include: { customer: true }
    });

    if (profiles.length === 0) return NextResponse.json({ success: true, updated: 0, done: true });

    await client.connect();
    let updatedCount = 0;

    for (const profile of profiles) {
      const oldRes = await client.query('SELECT "photoUrl" FROM "CustomerProfile" WHERE "phone" = $1 AND "photoUrl" IS NOT NULL LIMIT 1', [profile.customer.phone]);
      const oldUrl = oldRes.rows[0]?.photoUrl;

      if (oldUrl) {
        const newUrl = await migrateCustomerImage(oldUrl);
        if (newUrl) {
          await prisma.customerProfile.update({
            where: { id: profile.id },
            data: { photoUrl: newUrl }
          });
          updatedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, updated: updatedCount, done: profiles.length < limit });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
