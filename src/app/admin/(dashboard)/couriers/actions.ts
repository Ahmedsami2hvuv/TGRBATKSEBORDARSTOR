"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type CourierFormState = {
  error?: string;
  success?: boolean;
};

export type CourierMandoubResetState = {
  error?: string;
  success?: boolean;
};

export async function createCourier(state: CourierFormState, formData: FormData): Promise<CourierFormState> {
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;

  try {
    await prisma.courier.create({
      data: { name, phone, password }
    });
    revalidatePath("/admin/couriers");
    return { success: true };
  } catch (e) {
    return { error: "فشل إضافة المندوب" };
  }
}

export async function updateCourier(id: string, state: CourierFormState, formData: FormData): Promise<CourierFormState> {
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;

  try {
    await prisma.courier.update({
      where: { id },
      data: { name, phone, password }
    });
    revalidatePath("/admin/couriers");
    return { success: true };
  } catch (e) {
    return { error: "فشل تحديث البيانات" };
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
        data: { isBlocked: true }
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

export async function resetCourierMandoubTotals(id: string): Promise<CourierMandoubResetState> {
  try {
    await prisma.courier.update({
      where: { id },
      data: { carryOverDinar: 0 }
    });
    revalidatePath("/admin/couriers");
    return { success: true };
  } catch (e) {
    return { error: "فشل تصفير الحساب" };
  }
}
