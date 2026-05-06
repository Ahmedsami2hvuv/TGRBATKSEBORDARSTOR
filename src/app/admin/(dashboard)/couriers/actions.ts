"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type CourierFormState = {
  error?: string;
  success?: boolean;
  message?: string;
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

export async function deleteCourierAction(
  _state: CourierFormState,
  formData: FormData,
): Promise<CourierFormState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "معرّف المندوب غير صالح." };

  try {
    await prisma.$transaction(async (tx) => {
      // Preserve historical records while removing this courier account.
      await tx.order.updateMany({
        where: { assignedCourierId: id },
        data: { assignedCourierId: null },
      });

      await tx.order.updateMany({
        where: { courierEarningForCourierId: id },
        data: { courierEarningForCourierId: null },
      });

      await tx.orderCourierMoneyEvent.updateMany({
        where: { courierId: id },
        data: { courierId: null },
      });

      await tx.walletPeerTransfer.updateMany({
        where: { fromCourierId: id },
        data: { fromCourierId: null },
      });

      await tx.walletPeerTransfer.updateMany({
        where: { toCourierId: id },
        data: { toCourierId: null },
      });

      await tx.courierWalletMiscEntry.deleteMany({
        where: { courierId: id },
      });

      await tx.courier.delete({
        where: { id },
      });
    });
    revalidatePath("/admin/couriers");
    return { success: true, message: "تم حذف حساب المندوب نهائيًا." };
  } catch (error: any) {
    return { error: error?.message || "حدث خطأ أثناء حذف الحساب نهائيًا." };
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
