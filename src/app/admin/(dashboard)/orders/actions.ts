"use server";

import { ORDER_UPLOADER_ADMIN_LABEL } from "@/lib/order-uploader-label";
import { prisma } from "@/lib/prisma";
import {
  MAX_ORDER_IMAGE_BYTES,
  saveOrderImageUploaded,
  saveCustomerDoorPhotoUploaded,
} from "@/lib/order-image";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { pushNotifyCourierNewAssignment } from "@/lib/web-push-server";
import { revalidatePath } from "next/cache";

export type AssignOrderState = { error?: string; ok?: boolean };
export type RejectOrderState = { error?: string; ok?: boolean };

/** إسناد طلب لواحد أو أكثر من المجهزين مع دمج ومزامنة المنتجات */
export async function assignOrderToPreparer(
  _prev: AssignOrderState,
  formData: FormData,
): Promise<AssignOrderState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const isDraft = formData.get("isDraft") === "true";

  const preparerIds = formData.getAll("preparerIds").length > 0
    ? formData.getAll("preparerIds").map(id => String(id).trim())
    : [String(formData.get("preparerId") ?? "").trim()].filter(Boolean);

  if (!orderId || preparerIds.length === 0) {
    return { error: "يجب اختيار مجهز واحد على الأقل" };
  }

  let customerPhone = "";
  let titleLine = "";
  let summary = "";
  let customerRegionId: string | null = null;
  let customerLandmark = "";
  let orderNoteTime = "";
  let sentOrderId: string | null = null;
  let existingGroupId: string | null = null;
  let mergedProducts: any[] = [];

  if (isDraft) {
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({
      where: { id: orderId },
    });
    if (!draft) return { error: "المسودة غير موجودة" };

    customerPhone = draft.customerPhone;
    titleLine = draft.titleLine;
    summary = draft.rawListText;
    customerRegionId = draft.customerRegionId;
    customerLandmark = draft.customerLandmark;
    orderNoteTime = draft.orderTime;
    sentOrderId = draft.sentOrderId;
    existingGroupId = (draft.data as any)?.groupId || null;

    // جلب كافة المسودات المرتبطة لدمج المنتجات لضمان عدم ضياع أي بيانات للمجهز الجديد
    const allRelated = await prisma.companyPreparerShoppingDraft.findMany({
        where: {
            status: { in: ["draft", "priced"] },
            customerPhone,
            titleLine
        },
        include: { preparer: true }
    });

    allRelated.forEach(r => {
        const rData = (r.data as any) || {};
        const rProducts = rData.products || [];
        rProducts.forEach((p: any) => {
            const ext = mergedProducts.find(m => m.line === p.line);
            const isPriced = p.buyAlf && p.buyAlf !== "0";
            if (ext) {
                if ((!ext.buyAlf || ext.buyAlf === "0") && isPriced) {
                    ext.buyAlf = p.buyAlf; ext.sellAlf = p.sellAlf; ext.pricedBy = r.preparer.name;
                }
            } else {
                mergedProducts.push({...p, pricedBy: isPriced ? r.preparer.name : null});
            }
        });
    });
  } else {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { error: "الطلب غير موجود" };

    customerPhone = order.customerPhone;
    titleLine = `طلب #${order.orderNumber} - ${order.orderType}`;
    summary = order.summary;
    customerRegionId = order.customerRegionId;
    customerLandmark = order.customerLandmark;
    orderNoteTime = order.orderNoteTime || "فوري";
    sentOrderId = order.id;
    mergedProducts = (order.preparerShoppingJson as any)?.products || [];
  }

  // إذا كانت القائمة فارغة، قم بتحليل النص الخام
  if (mergedProducts.length === 0) {
      const lines = summary.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 1);
      mergedProducts = lines.map(line => ({ line, buyAlf: null, sellAlf: null }));
  }

  const finalGroupId = existingGroupId || `GRP-${Date.now()}`;

  for (const preparerId of preparerIds) {
    const existing = await prisma.companyPreparerShoppingDraft.findFirst({
      where: {
        preparerId,
        status: { in: ["draft", "priced"] },
        customerPhone,
        titleLine
      }
    });

    if (existing) {
        // تحديث المسودة الموجودة بالمجموعة الجديدة والمنتجات المدمجة بدلاً من إنشاء واحدة ثانية
        const existingData = (existing.data as any) || {};
        await prisma.companyPreparerShoppingDraft.update({
            where: { id: existing.id },
            data: { 
                data: { 
                    ...existingData, 
                    groupId: finalGroupId, 
                    products: mergedProducts,
                    assignedPreparerId: preparerId,
                    assignedPreparerName: (await prisma.companyPreparer.findUnique({ where: { id: preparerId } }))?.name
                } 
            }
        });
        continue;
    }

    const preparer = await prisma.companyPreparer.findUnique({ where: { id: preparerId } });
    await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparerId,
        titleLine,
        rawListText: summary,
        customerPhone,
        customerName: customerPhone,
        customerRegionId,
        customerLandmark,
        orderTime: orderNoteTime,
        sentOrderId,
        data: {
           version: 1,
           groupId: finalGroupId,
           products: mergedProducts,
           assignedPreparerId: preparerId,
           assignedPreparerName: preparer?.name,
           fromAdminAction: true
        }
      }
    });

    await prisma.companyPreparerPrepNotice.create({
      data: {
        preparerId,
        title: "إسناد طلب تجهيز",
        body: `تم إسناد طلب جديد إليك (${customerPhone}).`,
      },
    });
  }

  revalidatePath("/admin/orders/pending");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

/** إعادة إسناد (تغيير) المجهز */
export async function reassignOrderToPreparer(
  _prev: AssignOrderState,
  formData: FormData,
): Promise<AssignOrderState> {
  const id = String(formData.get("id") ?? "").trim();
  const preparerIds = formData.getAll("preparerIds").length > 0
    ? formData.getAll("preparerIds").map(id => String(id).trim())
    : [String(formData.get("preparerId") ?? "").trim()].filter(Boolean);
  const isDraft = formData.get("isDraft") === "true";

  if (!id || preparerIds.length === 0) return { error: "يجب اختيار مجهز واحد على الأقل" };

  const preparerId = preparerIds[0];

  // جلب بيانات المجهز الجديد
  const newPreparer = await prisma.companyPreparer.findUnique({ where: { id: preparerId } });
  if (!newPreparer) return { error: "المجهز غير موجود" };

  if (isDraft) {
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id } });
    if (!draft) return { error: "المسودة غير موجودة" };

    // تحديث بيانات المجهز في المسودة والمنتجات
    const draftData = (draft.data as any) || {};
    const products = (draftData.products || []).map((p: any) => ({
      ...p,
      assignedPreparerId: preparerId,
      assignedPreparerName: newPreparer.name
    }));

    await prisma.companyPreparerShoppingDraft.update({
      where: { id },
      data: { 
        preparerId,
        data: { ...draftData, products }
      }
    });
  } else {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return { error: "الطلب غير موجود" };

    // تحديث بيانات المجهز في الطلب والمنتجات
    const orderData = (order.preparerShoppingJson as any) || {};
    const products = (orderData.products || []).map((p: any) => ({
      ...p,
      assignedPreparerId: preparerId,
      assignedPreparerName: newPreparer.name
    }));

    await prisma.order.update({
      where: { id },
      data: { 
        submittedByCompanyPreparerId: preparerId,
        preparerShoppingJson: { ...orderData, products }
      }
    });
  }

  revalidatePath("/admin/orders/pending");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}

/** حذف طلب أو مسودة بالكامل */
export async function deleteOrderPermanently(
  _prev: any,
  formData: FormData,
): Promise<any> {
  const id = String(formData.get("id") ?? "").trim();
  const isDraft = formData.get("isDraft") === "true";

  if (!id) return { error: "المعرف مفقود" };

  try {
    if (isDraft) {
      const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id } });
      if (draft) {
          const draftData = (draft.data as any) || {};
          const groupId = draftData.groupId;

          if (groupId) {
             await prisma.companyPreparerShoppingDraft.deleteMany({
                 where: { data: { path: ["groupId"], equals: groupId } }
             });
          } else {
             await prisma.companyPreparerShoppingDraft.delete({ where: { id } });
          }
      }
    } else {
      await prisma.companyPreparerShoppingDraft.deleteMany({ where: { sentOrderId: id } });
      await prisma.order.delete({ where: { id } });
    }
  } catch (e) {
    return { error: "فشل الحذف، قد يكون الطلب مرتبطاً بسجلات أخرى" };
  }

  revalidatePath("/admin/orders/pending");
  return { ok: true };
}

export async function assignPendingOrderToCourier(
  _prev: AssignOrderState,
  formData: FormData,
): Promise<AssignOrderState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const courierId = String(formData.get("courierId") ?? "").trim();
  const customerLocationUrl = String(formData.get("customerLocationUrl") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const customerAlternatePhone = String(formData.get("customerAlternatePhone") ?? "").trim();
  const directReceipt = formData.get("directReceipt") === "on";
  const doorPhotoFile = formData.get("doorPhoto") as File | null;

  if (!orderId || !courierId) return { error: "بيانات ناقصة" };

  try {
    let doorPhotoUrl: string | undefined = undefined;
    if (doorPhotoFile && doorPhotoFile.size > 0) {
      if (doorPhotoFile.size > MAX_ORDER_IMAGE_BYTES) {
        return { error: "صورة الباب كبيرة جداً (الحد الأقصى 5 ميجا)" };
      }
      doorPhotoUrl = await saveCustomerDoorPhotoUploaded(doorPhotoFile);
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        assignedCourierId: courierId,
        status: directReceipt ? "delivering" : "assigned",
        customerPaymentReceivedAt: directReceipt ? new Date() : null,
        customerLocationUrl: customerLocationUrl || undefined,
        customerLandmark: customerLandmark || undefined,
        alternatePhone: customerAlternatePhone || undefined,
        customerDoorPhotoUrl: doorPhotoUrl || undefined,
      },
    });

    // مزامنة البيانات مع بروفايل الهاتف لضمان ظهورها في الطلبات القادمة لهذا الزبون
    if (updatedOrder.customerPhone) {
        await syncPhoneProfileFromOrder(updatedOrder.id);
    }

    // إرسال إشعار للمندوب
    try {
        await pushNotifyCourierNewAssignment(courierId, updatedOrder.orderNumber);
    } catch (e) {
        console.error("Failed to push notify courier:", e);
    }

    revalidatePath("/admin/orders/pending");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (e: any) {
    console.error("Error in assignPendingOrderToCourier:", e);
    return { error: "حدث خطأ أثناء الإسناد: " + (e.message || "خطأ غير معروف") };
  }
}

export async function rejectPendingOrder(
  _prev: RejectOrderState,
  formData: FormData,
): Promise<RejectOrderState> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return { error: "المعرف مفقود" };
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "cancelled" },
    });
    revalidatePath("/admin/orders/pending");
    return { ok: true };
  } catch (e) {
    return { error: "فشل تحديث حالة الطلب" };
  }
}

export async function setDraftAutoCourier(
  _prev: AssignOrderState,
  formData: FormData,
): Promise<AssignOrderState> {
  const draftId = String(formData.get("draftId") ?? "").trim();
  const courierIdRaw = String(formData.get("courierId") ?? "").trim();

  if (!draftId) return { error: "معرف المسودة مفقود" };

  try {
    const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: draftId } });
    if (!draft) return { error: "المسودة غير موجودة" };

    let autoCourierId: string | null = null;
    let autoCourierName: string | null = null;

    if (courierIdRaw) {
      const courier = await prisma.courier.findUnique({
        where: { id: courierIdRaw },
        select: { id: true, name: true },
      });
      if (!courier) return { error: "المندوب غير موجود" };
      autoCourierId = courier.id;
      autoCourierName = courier.name;
    }

    const currentData = ((draft.data as any) || {}) as Record<string, any>;
    const groupId = typeof currentData.groupId === "string" ? currentData.groupId.trim() : "";

    const related = groupId
      ? await prisma.companyPreparerShoppingDraft.findMany({
          where: { data: { path: ["groupId"], equals: groupId } },
          select: { id: true, data: true },
        })
      : await prisma.companyPreparerShoppingDraft.findMany({
          where: {
            customerPhone: draft.customerPhone,
            titleLine: draft.titleLine,
            status: { in: ["draft", "priced"] },
          },
          select: { id: true, data: true },
        });

    for (const row of related) {
      const rowData = ((row.data as any) || {}) as Record<string, any>;
      await prisma.companyPreparerShoppingDraft.update({
        where: { id: row.id },
        data: {
          data: {
            ...rowData,
            autoCourierId,
            autoCourierName,
          },
        },
      });
    }

    revalidatePath("/admin/orders/pending");
    return { ok: true };
  } catch (e) {
    return { error: "فشل حفظ مندوب التحويل التلقائي" };
  }
}
