"use client";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteCourierAction(id: string) {
  try {
    // التحقق من وجود طلبات مرتبطة
    const hasOrders = await prisma.order.findFirst({
      where: { OR: [{ courierEarningForCourierId: id }, { courierId: id }] }
    });

    if (hasOrders) {
      // إذا كان لديه طلبات، نقوم بتعطيله فقط ولا نحذفه لتجنب الخطأ البرمجي
      await prisma.courier.update({
        where: { id },
        data: { isBlocked: true }
      });
      return { success: true, message: "تم تعطيل المندوب بنجاح (لا يمكن حذفه لوجود طلبات مسجلة باسمه)." };
    }

    await prisma.courier.delete({ where: { id } });
    revalidatePath("/admin/couriers");
    return { success: true, message: "تم حذف المندوب بنجاح." };
  } catch (error) {
    console.error(error);
    return { success: false, message: "حدث خطأ أثناء معالجة الطلب." };
  }
}
