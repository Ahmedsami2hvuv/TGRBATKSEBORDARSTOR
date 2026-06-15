import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const body = await request.json();
    const { orderNumber, action, courierId } = body;

    if (!orderNumber || !action) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber: Number(orderNumber) }
    });

    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    if (action === "reject") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "cancelled" }
      });
      return NextResponse.json({ success: true, message: "تم الرفض بنجاح" });
    } else if (action === "assign") {
      if (!courierId) {
        return NextResponse.json({ error: "يجب تحديد المندوب" }, { status: 400 });
      }
      
      await prisma.order.update({
        where: { id: order.id },
        data: { 
          status: "assigned",
          assignedCourierId: courierId
        }
      });
      return NextResponse.json({ success: true, message: "تم الإسناد بنجاح" });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
