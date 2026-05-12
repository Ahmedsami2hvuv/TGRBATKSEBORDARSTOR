"use server";

import { PreparerShoppingDraftStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export type AdminPrepState = { error?: string; ok?: boolean; draftIds?: string[]; preparerNames?: string[] };

export async function submitAdminPreparationDraft(
  _prev: AdminPrepState,
  formData: FormData,
): Promise<AdminPrepState> {
  const admin = await isAdminSession();
  if (!admin) return { error: "غير مصرّح (Admin session required)." };

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
  if (!phoneLocal && customerPhone.length > 5) {
      // السماح بأرقام مخصصة أحياناً لكن الأفضل تفعيل الفحص
  }
  const finalPhone = phoneLocal || customerPhone;

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

  const createdDraftIds: string[] = [];
  const preparerNames: string[] = [];

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
        customerPhone: finalPhone,
        customerName,
        customerLandmark,
        orderTime,
        placesCount: null,
        data: {
          version: 1,
          products,
          fromAdminId: "admin",
          fromAdminName: "الإدارة",
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
        body: titleLine,
      },
    });
  }

  if (createdDraftIds.length === 0) {
      return { error: "لم يتم إنشاء أي مسودة، قد يكون المجهز غير فعال." };
  }

  revalidatePath("/admin/orders/pending");
  return { ok: true, draftIds: createdDraftIds, preparerNames };
}
