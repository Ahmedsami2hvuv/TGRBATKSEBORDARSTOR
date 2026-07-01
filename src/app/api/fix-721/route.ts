import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCourierDeliveryEarningDinar } from "@/lib/courier-earnings";

export async function GET() {
  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: "721" },
          { orderNumber: 721 }
        ]
      },
      include: {
        courier: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود في قاعدة البيانات" }, { status: 404 });
    }

    if (!order.assignedCourierId) {
      return NextResponse.json({ error: "لا يوجد مندوب مسند للطلب" }, { status: 400 });
    }

    const vehicleType = order.courier?.vehicleType || "bike";
    const zeroEarning = order.courier?.zeroEarning || false;
    const deliveryPrice = order.deliveryPrice || null;

    const earning = deliveryPrice != null
      ? computeCourierDeliveryEarningDinar(vehicleType as any, deliveryPrice, zeroEarning)
      : null;

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        courierEarningDinar: earning,
        courierEarningForCourierId: earning != null ? order.assignedCourierId : null,
      }
    });

    return NextResponse.json({
      message: "تم تحديث أرباح الطلب 721 بنجاح للمندوب",
      orderId: updatedOrder.id,
      courierName: order.courier?.name || "غير معروف",
      courierId: updatedOrder.courierEarningForCourierId,
      earningDinar: updatedOrder.courierEarningDinar,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
