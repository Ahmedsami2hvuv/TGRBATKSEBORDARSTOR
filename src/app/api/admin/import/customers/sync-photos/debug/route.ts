import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // جلب آخر 5 زبائن تم تحديث روابطهم لـ R2
  const updatedSamples = await prisma.customerPhoneProfile.findMany({
    where: {
      photoUrl: {
        contains: "r2.dev"
      }
    },
    take: 5,
    orderBy: { updatedAt: 'desc' }
  });

  // جلب عينة من الزبائن الذين لا يزالون بروابط قديمة
  const oldSamples = await prisma.customerPhoneProfile.findMany({
    where: {
      photoUrl: {
        contains: "railway.app"
      }
    },
    take: 5
  });

  return NextResponse.json({
    message: "فحص حالة المزامنة",
    updatedToR2Count: await prisma.customerPhoneProfile.count({ where: { photoUrl: { contains: "r2.dev" } } }),
    stillOnOldServerCount: await prisma.customerPhoneProfile.count({ where: { photoUrl: { contains: "railway.app" } } }),
    samplesInR2: updatedSamples,
    samplesOld: oldSamples,
    env_check: {
      has_r2_key: !!process.env.R2_ACCESS_KEY_ID,
      bucket_name: process.env.R2_BUCKET_NAME,
      endpoint: process.env.R2_ENDPOINT
    }
  });
}
