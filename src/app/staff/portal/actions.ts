"use server";

import { PreparerShoppingDraftStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { pushNotifyPreparerNewNotice } from "@/lib/web-push-server";

export type StaffPrepState = { error?: string; ok?: boolean; draftId?: string; preparerName?: string };

export async function submitStaffPreparationDraft(
  _prev: StaffPrepState,
  formData: FormData,
): Promise<StaffPrepState> {
  const se = String(formData.get("se") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const sig = String(formData.get("s") ?? "").trim();
  const v = verifyStaffEmployeePortalQuery(se, exp, sig);
  if (!v.ok) return { error: "الرابط غير صالح أو غير مكتمل." };

  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    select: { id: true, name: true, active: true, portalToken: true },
  });
  if (!staff || !staff.active || staff.portalToken !== v.token) {
    return { error: "الحساب غير مفعّل أو الرابط غير صالح." };
  }

  // التعديل: استقبال عدة مجهزين كـ مصفوفة بدلاً من مجهز واحد
  const preparerIds = formData.getAll("preparerIds").map(String).map(s => s.trim()).filter(Boolean);
  if (preparerIds.length === 0) return { error: "اختر مجهّزاً واحداً على الأقل." };

  const titleLine = String(formData.get("titleLine") ?? "").trim();
  const rawListText = String(formData.get("rawListText") ?? "").trim();
  const productsCsv = String(formData.get("productsCsv") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();

  if (!titleLine || !productsCsv || !customerRegionId || !orderTime) {
    return { error: "بيانات ناقصة — تأكد من عنوان الطلب والمنطقة والمنتجات ووقت الطلب." };
  }

  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) {
    return {
      error:
        "رقم الزبون غير صالح. يمكنك إدخاله بأي صيغة شائعة (مثل 07… أو +964… أو مع مسافات).",
    };
  }

  // منع الإرسال إذا كان الرقم محظوراً عالمياً
  const isBlocked = await prisma.globalBlockedPhone.findUnique({
    where: { phone: phoneLocal },
  });
  if (isBlocked) {
    return {
      error: "عذراً، هذا الرقم محظور عالمياً من التوصيل ولا يمكن رفع طلب له.",
    };
  }

  const region = await prisma.region.findUnique({
    where: { id: customerRegionId },
    select: { id: true },
  });
  if (!region) return { error: "منطقة الزبون غير صالحة." };

  const lines = productsCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { error: "لا توجد منتجات في القائمة." };
  const products = lines.map((line) => ({
    line,
    buyAlf: null as number | null,
    sellAlf: null as number | null,
  }));

  const groupId = `GRP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const createdDraftIds: string[] = [];
  const preparerNames: string[] = [];

  // التعديل: الدوران على جميع المجهزين وإرسال المسودة لكل واحد منهم مع ربطهم
  for (const preparerId of preparerIds) {
    const preparer = await prisma.companyPreparer.findFirst({
      where: { id: preparerId, active: true },
      select: { id: true, name: true },
    });
    if (!preparer) continue;

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId: preparer.id,
        status: PreparerShoppingDraftStatus.draft,
        titleLine,
        rawListText,
        customerRegionId,
        customerPhone: phoneLocal,
        customerName,
        customerLandmark,
        orderTime,
        placesCount: null,
        data: {
          version: 1,
          products,
          groupId,
          fromStaffEmployeeId: staff.id,
          fromStaffEmployeeName: staff.name,
        },
      },
      select: { id: true },
    });

    createdDraftIds.push(draft.id);
    preparerNames.push(preparer.name);

    await prisma.companyPreparerPrepNotice.create({
      data: {
        preparerId: preparer.id,
        title: titleLine,
        body: `طلب تجهيز جديد: ${customerRegionId} - ${phoneLocal}`,
      },
    });

    await pushNotifyPreparerNewNotice({
      preparerId: preparer.id,
      title: titleLine,
      body: rawListText,
      draftId: draft.id,
    }).catch(e => console.error("Web Push failed for staff portal submission:", e));
  }

  if (createdDraftIds.length === 0) {
    return { error: "فشل الإرسال، تأكد أن المجهزين مفعلين في النظام." };
  }

  revalidatePath("/preparer/preparation");
  revalidatePath("/preparer");
  revalidatePath("/staff/portal/submitted");
  return { ok: true, draftId: createdDraftIds[0], preparerName: preparerNames.join(" + ") };
}

export type StaffDraftEditState = { error?: string; ok?: boolean };

export async function updateStaffPreparationDraft(
  _prev: StaffDraftEditState,
  formData: FormData,
): Promise<StaffDraftEditState> {
  const se = String(formData.get("se") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const sig = String(formData.get("s") ?? "").trim();
  const v = verifyStaffEmployeePortalQuery(se, exp, sig);
  if (!v.ok) return { error: "الرابط غير صالح أو غير مكتمل." };

  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    select: { id: true, active: true, portalToken: true },
  });
  if (!staff || !staff.active || staff.portalToken !== v.token) {
    return { error: "الحساب غير مفعّل أو الرابط غير صالح." };
  }

  const draftId = String(formData.get("draftId") ?? "").trim();
  if (!draftId) return { error: "معرّف المسودة مفقود." };

  const draft = await prisma.companyPreparerShoppingDraft.findUnique({
    where: { id: draftId },
    select: { id: true, status: true, data: true },
  });
  if (!draft) return { error: "المسودة غير موجودة." };
  if (draft.status === PreparerShoppingDraftStatus.sent || draft.status === PreparerShoppingDraftStatus.archived) {
    return { error: "لا يمكن تعديل مسودة تم إرسالها أو أرشفتها." };
  }

  const meta = draft.data && typeof draft.data === "object" ? (draft.data as Record<string, unknown>) : {};
  const owner = String(meta.fromStaffEmployeeId ?? "").trim();
  if (!owner || owner !== staff.id) {
    return { error: "لا صلاحية لتعديل هذه المسودة." };
  }

  const titleLine = String(formData.get("titleLine") ?? "").trim();
  const rawListText = String(formData.get("rawListText") ?? "").trim();
  const productsCsv = String(formData.get("productsCsv") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();

  if (!titleLine || !productsCsv || !customerRegionId || !orderTime) {
    return { error: "بيانات ناقصة — تأكد من عنوان الطلب والمنطقة والمنتجات ووقت الطلب." };
  }
  const phoneLocal = normalizeIraqMobileLocal11(customerPhone);
  if (!phoneLocal) return { error: "رقم الزبون غير صالح." };

  // Global block check
  const isBlocked = await prisma.globalBlockedPhone.findUnique({
    where: { phone: phoneLocal },
  });
  if (isBlocked) {
    return { error: "عذراً، هذا الرقم محظور عالمياً ولا يمكن تعديل الطلب إليه." };
  }

  const region = await prisma.region.findUnique({ where: { id: customerRegionId }, select: { id: true } });
  if (!region) return { error: "منطقة الزبون غير صالحة." };

  const lines = productsCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { error: "لا توجد منتجات في القائمة." };

  const existingProducts = Array.isArray(meta.products) ? meta.products : [];
  const priceBuckets = new Map<string, Array<{ buyAlf: number | null; sellAlf: number | null }>>();
  for (const item of existingProducts) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const line = String(row.line ?? "").trim();
    if (!line) continue;
    const buyNum =
      row.buyAlf == null
        ? null
        : typeof row.buyAlf === "number" && Number.isFinite(row.buyAlf)
          ? row.buyAlf
          : null;
    const sellNum =
      row.sellAlf == null
        ? null
        : typeof row.sellAlf === "number" && Number.isFinite(row.sellAlf)
          ? row.sellAlf
          : null;
    const bucket = priceBuckets.get(line);
    const entry = { buyAlf: buyNum, sellAlf: sellNum };
    if (bucket) bucket.push(entry);
    else priceBuckets.set(line, [entry]);
  }

  const products = lines.map((line) => {
    const preserved = priceBuckets.get(line)?.shift();
    return {
      line,
      buyAlf: preserved?.buyAlf ?? null,
      sellAlf: preserved?.sellAlf ?? null,
    };
  });

  const nextData = {
    ...meta,
    version: 1,
    products,
    ...(rawListText ? { rawListText } : {}),
  };

  await prisma.companyPreparerShoppingDraft.update({
    where: { id: draft.id },
    data: {
      titleLine,
      rawListText,
      customerRegionId,
      customerPhone: phoneLocal,
      customerName,
      customerLandmark,
      orderTime,
      placesCount: null,
      status: PreparerShoppingDraftStatus.draft,
      data: nextData,
    },
  });

  revalidatePath("/staff/portal/submitted");
  revalidatePath(`/staff/portal/submitted/${draft.id}`);
  revalidatePath("/preparer/preparation");
  return { ok: true };
}