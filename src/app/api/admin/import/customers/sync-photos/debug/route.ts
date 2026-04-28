import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reset = searchParams.get("reset");

  if (reset === "true") {
    // تصفير أي رابط يحتوي على r2.dev لكي يعيد النظام سحبه
    await prisma.customerPhoneProfile.updateMany({
      where: { photoUrl: { contains: "r2.dev" } },
      data: { photoUrl: "" }
    });

    // أيضاً تصفير الروابط المعطلة إذا أردت محاولة سحبها مجدداً
    await prisma.customerPhoneProfile.updateMany({
      where: { photoUrl: { contains: "broken_link" } },
      data: { photoUrl: "" }
    });

    return NextResponse.json({ message: "تم تصفير الروابط بنجاح! يرجى الآن ضغط 'استيراد الزبائن' لإعادة جلب الروابط الأصلية، ثم 'سحب الصور'" });
  }

  const r2Count = await prisma.customerPhoneProfile.count({
    where: { photoUrl: { contains: "r2.dev" } }
  });

  const oldServerCount = await prisma.customerPhoneProfile.count({
    where: { photoUrl: { contains: "railway.app" } }
  });

  return NextResponse.json({
    message: "Status Check",
    synced_to_r2: r2Count,
    still_on_old_server: oldServerCount,
    env_vars_status: {
      has_access_key: !!process.env.R2_ACCESS_KEY_ID,
      has_secret_key: !!process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET_NAME,
      endpoint: process.env.R2_ENDPOINT
    },
    action_hint: "أضف ?reset=true للرابط لتصفير روابط R2 والبدء من جديد"
  });
}
