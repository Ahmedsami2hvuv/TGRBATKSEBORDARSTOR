"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { saveStoreSlideImageUploaded, MAX_ORDER_IMAGE_BYTES } from "@/lib/order-image";

export async function createSlide(formData: FormData) {
  let imageUrl = formData.get("imageUrl") as string;
  const imageFile = formData.get("imageFile") as File;
  const linkUrl = formData.get("linkUrl") as string;
  const sequence = parseInt(formData.get("sequence") as string || "0");

  if (imageFile && imageFile.size > 0) {
    imageUrl = await saveStoreSlideImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
  }

  if (!imageUrl) {
    throw new Error("يجب توفير رابط صورة أو تحميل ملف");
  }

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
  let imageUrl = formData.get("imageUrl") as string;
  const imageFile = formData.get("imageFile") as File;
  const linkUrl = formData.get("linkUrl") as string;
  const sequence = parseInt(formData.get("sequence") as string || "0");
  const active = formData.get("active") === "true";

  if (imageFile && imageFile.size > 0) {
    imageUrl = await saveStoreSlideImageUploaded(imageFile, MAX_ORDER_IMAGE_BYTES);
  }

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
