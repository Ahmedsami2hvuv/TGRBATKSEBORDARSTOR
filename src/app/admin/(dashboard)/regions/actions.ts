"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type RegionFormState = {
  error?: string;
  ok?: boolean;
};

// الدالة المستخدمة في الفورم القديم
export async function updateRegion(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const deliveryPriceStr = formData.get("deliveryPrice") as string;
  const deliveryPriceRaw = parseFloat(deliveryPriceStr);

  if (!id || !name || isNaN(deliveryPriceRaw)) {
    return { error: "يرجى ملء كافة الحقول بشكل صحيح" };
  }

  const deliveryPrice = deliveryPriceRaw < 1000 ? deliveryPriceRaw * 1000 : deliveryPriceRaw;

  try {
    await prisma.region.update({
      where: { id },
      data: { name, deliveryPrice }
    });
    revalidatePath("/admin/regions");
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// الدالة المستخدمة في القائمة الجديدة (البحث)
export async function updateRegionAction(id: string, name: string, price: number) {
  try {
    // Ensure price is stored in Dinars. If user enters 3, store 3000.
    const dinarPrice = price < 1000 ? price * 1000 : price;

    await prisma.region.update({
      where: { id },
      data: {
        name,
        deliveryPrice: dinarPrice
      }
    });
    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
