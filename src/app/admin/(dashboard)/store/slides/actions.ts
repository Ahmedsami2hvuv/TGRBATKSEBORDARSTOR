"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createSlide(formData: FormData) {
  const imageUrl = formData.get("imageUrl") as string;
  const linkUrl = formData.get("linkUrl") as string;
  const sequence = parseInt(formData.get("sequence") as string || "0");

  await prisma.storeSlide.create({
    data: {
      imageUrl,
      linkUrl: linkUrl || "",
      sequence,
    },
  });

  revalidatePath("/admin/store/slides");
  revalidatePath("/store");
}

export async function updateSlide(id: string, formData: FormData) {
  const imageUrl = formData.get("imageUrl") as string;
  const linkUrl = formData.get("linkUrl") as string;
  const sequence = parseInt(formData.get("sequence") as string || "0");
  const active = formData.get("active") === "true";

  await prisma.storeSlide.update({
    where: { id },
    data: {
      imageUrl,
      linkUrl: linkUrl || "",
      sequence,
      active,
    },
  });

  revalidatePath("/admin/store/slides");
  revalidatePath("/store");
}

export async function deleteSlide(id: string) {
  await prisma.storeSlide.delete({
    where: { id },
  });

  revalidatePath("/admin/store/slides");
  revalidatePath("/store");
}
