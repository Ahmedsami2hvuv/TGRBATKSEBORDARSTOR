import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAdminToken, adminCookieName } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(adminCookieName)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const regions = await prisma.region.findMany();
    let updatedCount = 0;

    for (const r of regions) {
      if (p >= 1000) {
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: p / 1000 }
        });
        updatedCount++;
      }
    }

    const orders = await prisma.order.findMany({
      where: {
        deliveryPrice: { gte: 1000 }
      }
    });
    
    let updatedOrdersCount = 0;
    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      if (p >= 1000) {
        await prisma.order.update({
          where: { id: o.id },
          data: { deliveryPrice: p / 1000 }
        });
        updatedOrdersCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم تحديث ${updatedCount} منطقة و ${updatedOrdersCount} طلب لتكون بالآلاف بدلاً من الدنانير (Direct mode).`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
