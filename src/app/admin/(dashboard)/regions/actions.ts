"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateRegionAction(id: string, name: string, price: number) {
  try {
    await prisma.region.update({
      where: { id },
      data: {
        name,
        deliveryPrice: price
      }
    });
    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
