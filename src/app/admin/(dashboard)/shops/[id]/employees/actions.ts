"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  isPlausibleWhatsAppNumber,
  normalizePhoneDigits,
} from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";

export type EmployeeFormState = { error?: string; ok?: boolean };

export async function createEmployee(
  shopId: string,
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = normalizePhoneDigits(phoneRaw);
  if (!name) {
    return { error: "اسم الموظف مطلوب" };
  }
  if (!phoneRaw) {
    return { error: "رقم الهاتف مطلوب" };
  }
  if (!phone || !isPlausibleWhatsAppNumber(phone)) {
    return {
      error:
        "رقم الهاتف غير صالح. جرّب مثل 077xxxxxxxxx أو +964 77x xxx xxxx",
    };
  }
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    return { error: "المحل غير موجود" };
  }
  await prisma.employee.create({
    data: { name, phone, shopId },
  });
  revalidatePath(`/admin/shops/${shopId}/employees`);
  return { ok: true };
}

export async function deleteEmployee(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const shopId = String(formData.get("shopId") ?? "");
  if (!id || !shopId) return;
  await prisma.employee.delete({ where: { id } });
  revalidatePath(`/admin/shops/${shopId}/employees`);
}

export async function renewEmployeeOrderPortalToken(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const shopId = String(formData.get("shopId") ?? "");
  if (!id || !shopId) return;
  await prisma.employee.update({
    where: { id },
    data: { orderPortalToken: randomUUID() },
  });
  revalidatePath(`/admin/shops/${shopId}/employees`);
}

export async function updateEmployee(
  shopId: string,
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = normalizePhoneDigits(phoneRaw);
  if (!id) {
    return { error: "معرّف الموظف مفقود" };
  }
  if (!name) {
    return { error: "اسم الموظف مطلوب" };
  }
  if (!phoneRaw) {
    return { error: "رقم الهاتف مطلوب" };
  }
  if (!phone || !isPlausibleWhatsAppNumber(phone)) {
    return {
      error:
        "رقم الهاتف غير صالح. جرّب مثل 077xxxxxxxxx أو +964 77x xxx xxxx",
    };
  }
  const emp = await prisma.employee.findFirst({
    where: { id, shopId },
  });
  if (!emp) {
    return { error: "الموظف غير موجود" };
  }
  await prisma.employee.update({
    where: { id },
    data: { name, phone },
  });
  revalidatePath(`/admin/shops/${shopId}/employees`);
  revalidatePath(`/admin/shops/${shopId}/employees/${id}/edit`);
  return { ok: true };
}
