"use server";

import { prisma } from "@/lib/prisma";
import { parseAlfInputToDinarDecimalRequired } from "@/lib/money-alf";
import { resyncOrdersAfterRegionPriceChange } from "@/lib/order-courier-money-sync";
import { revalidatePath } from "next/cache";

export type RegionFormState = { error?: string; ok?: boolean };

const DUPLICATE_REGION_MSG =
  "هذه المنطقة موجودة مسبقاً في النظام. لا يمكن تكرار نفس الاسم.";

async function findRegionByNameCaseInsensitive(name: string) {
  return prisma.region.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
}

export async function createRegion(
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("deliveryPrice") ?? "").trim();
  if (!name) {
    return { error: "اسم المنطقة مطلوب" };
  }
  const priceParsed = parseAlfInputToDinarDecimalRequired(priceRaw.replace(",", "."));
  if (!priceParsed.ok) {
    return { error: "سعر التوصيل غير صالح (أدخل المبلغ بالألف، مثال: 5 أو 10.5)" };
  }
  const price = priceParsed.value;
  const existing = await findRegionByNameCaseInsensitive(name);
  if (existing) {
    return { error: DUPLICATE_REGION_MSG };
  }
  await prisma.region.create({
    data: {
      name,
      deliveryPrice: price,
    },
  });
  revalidatePath("/admin/regions");
  return { ok: true };
}

export async function deleteRegion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.region.delete({ where: { id } });
  revalidatePath("/admin/regions");
}

export async function updateRegion(
  _prev: RegionFormState,
  formData: FormData,
): Promise<RegionFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("deliveryPrice") ?? "").trim();
  if (!id) {
    return { error: "معرّف المنطقة مفقود" };
  }
  if (!name) {
    return { error: "اسم المنطقة مطلوب" };
  }
  const priceParsed = parseAlfInputToDinarDecimalRequired(priceRaw.replace(",", "."));
  if (!priceParsed.ok) {
    return { error: "سعر التوصيل غير صالح (أدخل المبلغ بالألف، مثال: 5 أو 10.5)" };
  }
  const price = priceParsed.value;
  const nameTaken = await findRegionByNameCaseInsensitive(name);
  if (nameTaken && nameTaken.id !== id) {
    return { error: DUPLICATE_REGION_MSG };
  }
  await prisma.region.update({
    where: { id },
    data: { name, deliveryPrice: price },
  });
  await resyncOrdersAfterRegionPriceChange(id);
  revalidatePath("/admin/regions");
  revalidatePath(`/admin/regions/${id}/edit`);
  revalidatePath("/admin/orders/tracking");
  revalidatePath("/admin/reports/couriers");
  revalidatePath("/admin/reports/accounting");
  revalidatePath("/mandoub");
  return { ok: true };
}
