import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/upload-storage";

export const runtime = "nodejs";

const R2_DOMAIN = process.env.R2_BUCKET_DOMAIN || "pub-2f347893a77443198f121df01053c847.r2.dev";

export async function POST(req: Request) {
  try {
    // 0. معالجة الصور التي تم حفظها كـ Base64 في جدول الزبائن الرئيسي (CustomerPhoneProfile)
    const profilesWithBase64 = await prisma.customerPhoneProfile.findMany({
      where: {
        photoUrl: { startsWith: "data:image" }
      },
      select: { id: true, phone: true, regionId: true, photoUrl: true }
    });

    let profileUpdates = 0;
    for (const p of profilesWithBase64) {
      if (!p.photoUrl) continue;
      
      try {
        let contentType = "image/jpeg";
        let ext = "jpg";
        let base64Data = p.photoUrl;

        const parts = p.photoUrl.split(",");
        if (parts.length > 1) {
            const info = parts[0].split(";")[0];
            contentType = info.split(":")[1] || "image/jpeg";
            ext = contentType.split("/")[1] || "jpg";
            base64Data = parts[1];
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const key = `customers/${p.phone}-${p.regionId}.${ext}`;
        const uploadedKey = await uploadToR2(buffer, key, contentType);

        if (uploadedKey) {
            const publicUrl = `https://${R2_DOMAIN}/${uploadedKey}`;
            await prisma.customerPhoneProfile.update({
                where: { id: p.id },
                data: { photoUrl: publicUrl }
            });
            profileUpdates++;
        }
      } catch (err) {
        console.error("Error uploading base64 profile image for phone", p.phone, err);
      }
    }

    // 1. تنظيف جدول زبائن المحلات (Customer)
    const customersWithLongUrls = await prisma.customer.findMany({
      where: {
        customerDoorPhotoUrl: { startsWith: "data:image" }
      },
      select: { id: true, phone: true, customerRegionId: true }
    });

    let customerUpdates = 0;
    for (const c of customersWithLongUrls) {
      if (!c.customerRegionId) continue;
      
      // جلب الرابط النظيف من الملف المرجعي
      const profile = await prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone: c.phone, regionId: c.customerRegionId } }
      });

      if (profile?.photoUrl && profile.photoUrl.includes("r2.dev")) {
        await prisma.customer.update({
          where: { id: c.id },
          data: { customerDoorPhotoUrl: profile.photoUrl }
        });
        customerUpdates++;
      } else {
        // إذا لم يتم رفعه لـ R2 بعد، يمكننا مسحه مؤقتاً لمنع التعليق أو تركه
        // للسهولة، سنتركه ليتم سحبه في المرة القادمة
      }
    }

    // 2. تنظيف جدول الطلبيات (Order)
    const ordersWithLongUrls = await prisma.order.findMany({
      where: {
        customerDoorPhotoUrl: { startsWith: "data:image" }
      },
      select: { id: true, customerPhone: true, customerRegionId: true }
    });

    let orderUpdates = 0;
    for (const o of ordersWithLongUrls) {
      if (!o.customerPhone || !o.customerRegionId) continue;
      
      // جلب الرابط النظيف من الملف المرجعي
      const profile = await prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone: o.customerPhone, regionId: o.customerRegionId } }
      });

      if (profile?.photoUrl && profile.photoUrl.includes("r2.dev")) {
        await prisma.order.update({
          where: { id: o.id },
          data: { customerDoorPhotoUrl: profile.photoUrl }
        });
        orderUpdates++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم رفع ${profileUpdates} صور أساسية، وتنظيف ${customerUpdates} زبون محل، و ${orderUpdates} طلبية.`,
      profileUpdates,
      customerUpdates,
      orderUpdates
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
