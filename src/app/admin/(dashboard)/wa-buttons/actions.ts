"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type WaButtonsFormState = {
  ok?: boolean;
  error?: string;
};

type Recipient = "customer" | "customer2" | "shop";
type CustomerLocationRule = "any" | "exists" | "missing" | "courier_gps";
type VisibilityScope = "all" | "admin" | "employee" | "preparer" | "mandoub";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function buildAutoInternalName(label: string): string {
  const cleaned = label.trim().replace(/\s+/g, "_");
  if (cleaned) return `auto_${cleaned}`;
  return `auto_${Date.now()}`;
}

export async function upsertMandoubWaButton(
  _prev: WaButtonsFormState,
  formData: FormData,
): Promise<WaButtonsFormState> {
  const id = formString(formData, "id").trim();
  const label = formString(formData, "label").trim();
  const name = formString(formData, "name").trim();
  const iconKey = formString(formData, "iconKey").trim() || "💬";
  const recipient = formString(formData, "recipient") as Recipient;
  const customerLocationRulesRaw = formData
    .getAll("customerLocationRules")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  const visibilityScopesRaw = formData
    .getAll("visibilityScopes")
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean);

  const visibilityScopes = visibilityScopesRaw
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((v) =>
      v === "all" || v === "admin" || v === "employee" || v === "preparer" || v === "mandoub"
    ) as VisibilityScope[];

  // نخزنها كسلسلة CSV داخل نفس عمود `visibilityScope` (وليس dropdown).
  const visibilityScope =
    visibilityScopes.length === 0 || visibilityScopes.includes("all")
      ? ("all" as VisibilityScope)
      : (visibilityScopes.join(",") as string as VisibilityScope);

  const customerLocationRules = customerLocationRulesRaw.filter((v) =>
    v === "any" || v === "exists" || v === "missing" || v === "courier_gps",
  ) as CustomerLocationRule[];
  const customerLocationRule =
    customerLocationRules.length === 0 || customerLocationRules.includes("any")
      ? "any"
      : customerLocationRules.join(",");

  const statuses = formData.getAll("statuses").map((v) => (typeof v === "string" ? v : "")).filter(Boolean);
  const statusesCsv = statuses.join(",");

  if (!label) return { error: "اسم الزر مطلوب." };
  const internalName = name || buildAutoInternalName(label);

  const dataBase = {
    name: internalName,
    label,
    iconKey,
    recipient: recipient === "shop" || recipient === "customer2" ? recipient : "customer",
    statusesCsv,
    customerLocationRule,
    visibilityScope,
    isActive: true,
  };

  if (id) {
    await prisma.mandoubWaButtonSetting.update({
      where: { id },
      data: dataBase,
    });
  } else {
    await prisma.mandoubWaButtonSetting.create({
      data: {
        ...dataBase,
        templateText: "",
      },
    });
  }

  revalidatePath("/admin/wa-buttons");
  return { ok: true };
}

/** حفظ نص/نماذج الرسالة فقط — من نافذة «النماذج» */
export async function updateMandoubWaButtonTemplates(
  _prev: WaButtonsFormState,
  formData: FormData,
): Promise<WaButtonsFormState> {
  const id = formString(formData, "id").trim();
  const templateText = formString(formData, "templateText");
  if (!id) return { error: "معرّف الزر غير صالح." };

  const row = await prisma.mandoubWaButtonSetting.findUnique({ where: { id } });
  if (!row) return { error: "الزر غير موجود." };

  await prisma.mandoubWaButtonSetting.update({
    where: { id },
    data: { templateText },
  });

  revalidatePath("/admin/wa-buttons");
  return { ok: true };
}

export async function deleteMandoubWaButton(formData: FormData): Promise<void> {
  const id = formString(formData, "id").trim();
  if (!id) return;

  await prisma.mandoubWaButtonSetting.delete({ where: { id } });
  revalidatePath("/admin/wa-buttons");
}

export async function duplicateMandoubWaButton(
  formData: FormData,
): Promise<void> {
  const id = formString(formData, "id").trim();
  if (!id) return;

  const row = await prisma.mandoubWaButtonSetting.findUnique({ where: { id } });
  if (!row) return;

  await prisma.mandoubWaButtonSetting.create({
    data: {
      name: row.name,
      label: row.label,
      iconKey: row.iconKey,
      templateText: row.templateText,
      recipient: row.recipient,
      statusesCsv: row.statusesCsv,
      customerLocationRule: row.customerLocationRule,
      visibilityScope: row.visibilityScope,
      isActive: true,
    },
  });

  revalidatePath("/admin/wa-buttons");
}

