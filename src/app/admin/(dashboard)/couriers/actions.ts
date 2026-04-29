"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type CourierFormState = {
  error?: string;
  success?: boolean;
};

export async function createCourier(state: CourierFormState, formData: FormData): Promise<CourierFormState> {
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const telegramUserIdRaw = formData.get("telegramUserId") as string;
  const telegramUserId = telegramUserIdRaw?.trim() || null;
  const vehicleTypeRaw = formData.get("vehicleType") as string;
  const vehicleType = vehicleTypeRaw === "bike" ? "bike" : "car";

  try {
    // التحقق من وجود رقم الهاتف مسبقاً
    const existingPhone = await prisma.courier.findFirst({ where: { phone } });
    if (existingPhone) return { error: "رقم الهاتف هذا مسجل لمندوب آخر بالفعل." };

    // التحقق من وجود معرف تيليجرام مسبقاً (إذا تم إدخاله)
    if (telegramUserId) {
      const existingTelegram = await prisma.courier.findUnique({ where: { telegramUserId } });
      if (existingTelegram) return { error: "معرف التيليجرام هذا مستخدم من قبل مندوب آخر." };
    }

    await prisma.courier.create({
      data: { name, phone, telegramUserId, vehicleType }
    });

    revalidatePath("/admin/couriers");
    return { success: true };
  } catch (e: any) {
    console.error("CREATE COURIER ERROR:", e);
    // التحقق من أخطاء Prisma المحددة
    if (e.code === 'P2002') {
       return { error: "فشل الإضافة: يوجد بيانات مكررة (الهاتف أو التيليجرام)." };
    }
    return { error: "حدث خطأ غير متوقع: " + (e.message || "فشل إضافة المندوب") };
  }
}

export async function updateCourier(id: string, state: CourierFormState, formData: FormData): Promise<CourierFormState> {
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const telegramUserIdRaw = formData.get("telegramUserId") as string;
  const telegramUserId = telegramUserIdRaw?.trim() || null;
  const vehicleTypeRaw = formData.get("vehicleType") as string;
  const vehicleType = vehicleTypeRaw === "bike" ? "bike" : "car";

  try {
    await prisma.courier.update({
      where: { id },
      data: { name, phone, telegramUserId, vehicleType }
    });
    revalidatePath("/admin/couriers");
    return { success: true };
  } catch (e: any) {
    return { error: "فشل تحديث البيانات: " + (e.message || "تأكد من عدم تكرار الهاتف أو التيليجرام") };
  }
}

export async function deleteCourierAction(id: string) {
  try {
    const hasOrders = await prisma.order.findFirst({
      where: { OR: [{ courierEarningForCourierId: id }, { courierId: id }] }
    });

    if (hasOrders) {
      await prisma.courier.update({
        where: { id },
        data: { blocked: true } // تصحيح اسم الحقل من isBlocked إلى blocked بناءً على الـ Schema
      });
      revalidatePath("/admin/couriers");
      return { success: true, message: "تم تعطيل المندوب بنجاح (لا يمكن حذفه لوجود طلبات)." };
    }

    await prisma.courier.delete({ where: { id } });
    revalidatePath("/admin/couriers");
    return { success: true, message: "تم حذف المندوب بنجاح." };
  } catch (error) {
    return { success: false, message: "حدث خطأ أثناء الحذف." };
  }
}

export async function resetCourierMandoubTotals(id: string) {
  try {
    await prisma.courier.update({
      where: { id },
      data: { 
        mandoubWalletCarryOverDinar: 0,
        mandoubTotalsResetAt: new Date()
      }
    });

    revalidatePath("/admin/couriers");
    return { success: true };
  } catch (e) {
    return { error: "فشل تصفير الحساب" };
  }
}
