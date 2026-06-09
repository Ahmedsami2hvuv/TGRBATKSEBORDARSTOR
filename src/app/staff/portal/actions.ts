"use server";

import { PreparerShoppingDraftStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { pushNotifyPreparerNewNotice } from "@/lib/web-push-server";
import { notifyTelegramDraftCanceled, notifyTelegramNewOrder, notifyTelegramStaffOrderUpdate } from "@/lib/telegram-notify";
import { saveOrderImageUploaded } from "@/lib/order-image";
import { MAX_VOICE_NOTE_BYTES, saveVoiceNoteUploaded } from "@/lib/voice-note";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { sendTelegramMessage } from "@/lib/telegram";

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

  // التعديل: استقبال عدة مجهزين كـ مصفوفة (اختياري الآن)
  const preparerIds = formData.getAll("preparerIds").map(String).map(s => s.trim()).filter(Boolean);

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
        "رقم الزبون غير صالح. يجب أن يبدأ بـ 07 أو 7 وتأكد من عدد الأرقام.",
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

  // إذا لم يتم اختيار مجهزين، يتم إنشاء مسودة واحدة بدون مجهز (للمسؤول)
  if (preparerIds.length === 0) {
    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        preparer: undefined, // طلب غير مسند
        status: PreparerShoppingDraftStatus.draft,
        titleLine,
        rawListText,
        customerRegion: { connect: { id: customerRegionId } },
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
          noProfit: formData.get("noProfit") === "true",
        },
      },
      select: { id: true },
    });
    createdDraftIds.push(draft.id);
    preparerNames.push("غير مسند (عام)");
  } else {
    // التعديل: الدوران على جميع المجهزين وإرسال المسودة لكل واحد منهم مع ربطهم
    for (const preparerId of preparerIds) {
      const preparer = await prisma.companyPreparer.findFirst({
        where: { id: preparerId, active: true },
        select: { id: true, name: true },
      });
      if (!preparer) continue;

      const draft = await prisma.companyPreparerShoppingDraft.create({
        data: {
          preparer: { connect: { id: preparer.id } },
          status: PreparerShoppingDraftStatus.draft,
          titleLine,
          rawListText,
          customerRegion: { connect: { id: customerRegionId } },
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
            noProfit: formData.get("noProfit") === "true",
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
  }

  if (createdDraftIds.length === 0) {
    return { error: "فشل الإرسال، تأكد أن المجهزين مفعلين في النظام." };
  }

  revalidatePath("/preparer/preparation");
  revalidatePath("/preparer");
  revalidatePath("/staff/portal/submitted");
  return { ok: true, draftId: createdDraftIds[0], preparerName: preparerNames.join(" + ") };
}

export type StaffDoubleOrderState = { error?: string; ok?: boolean; orderId?: string; orderNumber?: number };

export async function submitStaffDoubleOrder(
  _prev: StaffDoubleOrderState,
  formData: FormData,
): Promise<StaffDoubleOrderState> {
  const se = String(formData.get("se") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const sig = String(formData.get("s") ?? "").trim();
  const v = verifyStaffEmployeePortalQuery(se, exp, sig);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
  });
  if (!staff || !staff.active) return { error: "الحساب غير مفعّل." };

  const sellerPhone = String(formData.get("sellerPhone") ?? "").trim();
  const sellerRegionId = String(formData.get("sellerRegionId") ?? "").trim();
  const buyerPhone = String(formData.get("buyerPhone") ?? "").trim();
  const buyerRegionId = String(formData.get("buyerRegionId") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();
  const orderType = String(formData.get("orderType") ?? "توصيل فقط").trim();
  const sellerAmount = parseFloat(String(formData.get("sellerAmount") ?? "0"));
  const profit = parseFloat(String(formData.get("profit") ?? "0"));
  const deliveryPrice = parseFloat(String(formData.get("deliveryPrice") ?? "0"));

  let sellerLandmark = String(formData.get("sellerLandmark") ?? "").trim();
  let sellerLocationUrl = String(formData.get("sellerLocationUrl") ?? "").trim();
  let buyerLandmark = String(formData.get("buyerLandmark") ?? "").trim();
  let buyerLocationUrl = String(formData.get("buyerLocationUrl") ?? "").trim();

  const imageFile = formData.get("imageFile") as File | null;
  const voiceFile = formData.get("voiceFile") as File | null;
  const orderNoteText = String(formData.get("orderNoteText") ?? "").trim();

  if (!sellerPhone || !sellerRegionId || !buyerPhone || !buyerRegionId || !orderTime) {
    return { error: "يرجى ملء كافة الحقول المطلوبة." };
  }

  const sPhone = normalizeIraqMobileLocal11(sellerPhone);
  const bPhone = normalizeIraqMobileLocal11(buyerPhone);
  if (!sPhone || !bPhone) return { error: "أرقام الهاتف غير صالحة." };

  // Fetch profiles on server for extra reliability if client-side didn't provide them
  const [sProf, bProf] = await Promise.all([
    prisma.customerPhoneProfile.findUnique({
      where: { phone_regionId: { phone: sPhone, regionId: sellerRegionId } }
    }),
    prisma.customerPhoneProfile.findUnique({
      where: { phone_regionId: { phone: bPhone, regionId: buyerRegionId } }
    })
  ]);

  // Merge Data: Priority to manual input, fallback to stored profile
  const finalSellerLandmark = sellerLandmark || sProf?.landmark || "";
  const finalSellerLoc = sellerLocationUrl || sProf?.locationUrl || "";
  const finalSellerPhoto = sProf?.photoUrl || null;
  const finalSellerAltPhone = sProf?.alternatePhone || null;

  const finalBuyerLandmark = buyerLandmark || bProf?.landmark || "";
  const finalBuyerLoc = buyerLocationUrl || bProf?.locationUrl || "";
  const finalBuyerPhoto = bProf?.photoUrl || null;

  let imageUrl: string | null = null;
  if (imageFile && imageFile.size > 0) {
    try {
      imageUrl = await saveOrderImageUploaded(imageFile, 0);
    } catch (e) {
      console.error("Image upload failed:", e);
    }
  }

  let voiceNoteUrl: string | null = null;
  if (voiceFile && voiceFile.size > 0) {
    try {
      voiceNoteUrl = await saveVoiceNoteUploaded(voiceFile, MAX_VOICE_NOTE_BYTES);
    } catch (e) {
      console.error("Voice upload failed:", e);
    }
  }

  const totalAmount = sellerAmount + profit + deliveryPrice;

  try {
    const doubleShop = await prisma.shop.findFirst({
      where: { name: { contains: "وجهتين" } }
    }) || await prisma.shop.findFirst();

    if (!doubleShop) return { error: "لا يوجد محل معرف في النظام لاستقبال الطلب." };

    const order = await prisma.order.create({
      data: {
        shop: { connect: { id: doubleShop.id } },
        routeMode: "double",
        orderType: orderType,
        status: "pending",
        customerPhone: sPhone,
        customerRegion: { connect: { id: sellerRegionId } },
        customerLandmark: finalSellerLandmark,
        customerLocationUrl: finalSellerLoc,
        customerDoorPhotoUrl: finalSellerPhoto,
        alternatePhone: finalSellerAltPhone,
        secondCustomerPhone: bPhone,
        secondCustomerRegion: { connect: { id: buyerRegionId } },
        secondCustomerLandmark: finalBuyerLandmark,
        secondCustomerLocationUrl: finalBuyerLoc,
        secondCustomerDoorPhotoUrl: finalBuyerPhoto,
        orderNoteTime: `${orderType} - ${orderTime}`,
        orderSubtotal: sellerAmount + profit,
        deliveryPrice: deliveryPrice,
        totalAmount: totalAmount,
        imageUrl: imageUrl || null,
        voiceNoteUrl: voiceNoteUrl || null,
        adminOrderCode: orderNoteText,
        submissionSource: "staff_portal",
        summary: `طلب وجهتين (${orderType}): من ${sPhone} إلى ${bPhone}${orderNoteText ? `\n\nملاحظة الموظف: ${orderNoteText}` : ""}`,
        // تخزين بيانات الربح والموظف في حقل JSON
        preparerShoppingJson: {
          staffId: staff.id,
          staffProfit: profit,
          profitSettled: false
        }
      }
    });

    // إشعار الإدارة بطلب جديد
    void notifyTelegramNewOrder(order.id).catch(err => console.error("Telegram notify failed:", err));

    revalidatePath("/staff/portal/submitted");
    return { ok: true, orderId: order.id, orderNumber: order.orderNumber };
  } catch (err: any) {
    return { error: "فشل في حفظ الطلب: " + err.message };
  }
}

export async function settleStaffProfit(
  arg1: any,
  arg2?: any,
): Promise<{ error?: string; ok?: boolean; waUrl?: string }> {
  // دعم الاستدعاء المباشر من النموذج (formData) أو من useActionState (prevState, formData)
  const formData = arg2 instanceof FormData ? arg2 : (arg1 as FormData);

  const se = String(formData.get("se") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const sig = String(formData.get("s") ?? "").trim();
  const v = verifyStaffEmployeePortalQuery(se, exp, sig);
  if (!v.ok) return { error: "الرابط غير صالح." };

  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
  });
  if (!staff || !staff.active) return { error: "الحساب غير مفعّل." };

  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return { error: "معرف الطلب مفقود." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) return { error: "الطلب غير موجود." };

  const json = order.preparerShoppingJson as any;
  if (!json || json.staffId !== staff.id) {
    return { error: "لا تملك صلاحية لتسوية هذا الطلب." };
  }

  if (json.profitSettled) {
    return { error: "تم تسوية هذا الطلب مسبقاً." };
  }

  const profit = Number(json.staffProfit || 0);
  const deduction = profit / 2;

  // 1. تحديث الطلب وتحديث رصيد الموظف وتسجيل المعاملة المالية في عملية واحدة (transaction)
  const result = await prisma.$transaction(async (tx) => {
    // أ. تحديث حالة تسوية الطلب
    await tx.order.update({
      where: { id: orderId },
      data: {
        preparerShoppingJson: {
          ...json,
          profitSettled: true,
          settledAt: new Date().toISOString(),
        },
      },
    });

    // ب. خصم نصف ربح الطلب (الاستقطاع) من رصيد الراتب المتبقي
    const updatedStaff = await tx.staffEmployee.update({
      where: { id: staff.id },
      data: {
        salaryBalance: { decrement: deduction },
      },
    });

    // ج. تسجيل معاملة مالية موثقة
    await tx.staffTransaction.create({
      data: {
        staffEmployeeId: staff.id,
        type: "receive_profit",
        details: `تسوية أرباح طلب رقم #${order.orderNumber} واصل`,
        amount: 0,
        phone: order.customerPhone || "",
        profit: profit,
        deduction: deduction,
      },
    });

    return updatedStaff;
  });

  const remainingSalary = Number(result.salaryBalance);
  const originalSalary = Number(staff.fixedSalary);
  const totalSalary = remainingSalary + profit;

  // 2. إرسال إشعار تيليجرام للموظف وللإدارة
  try {
    const notificationBotToken = await getBotTokenByPurpose("notification");
    if (notificationBotToken) {
      const telegramMessageText = [
        `📊 <b>تسوية أرباح طلب (واصل)</b>`,
        `👤 <b>الموظف:</b> ${staff.name}`,
        `🔢 <b>طلب رقم:</b> #${order.orderNumber}`,
        `💵 <b>مبلغ الربح المستلم:</b> ${profit.toLocaleString()} د.ع`,
        `🔴 <b>الاستقطاع من الراتب:</b> ${deduction.toLocaleString()} د.ع`,
        `-------------------------`,
        `💵 <b>الراتب الثابت:</b> ${originalSalary.toLocaleString()} د.ع`,
        `⏳ <b>المتبقي من الراتب:</b> ${remainingSalary.toLocaleString()} د.ع`,
        `📈 <b>الراتب الكلي (الوضع الحالي):</b> ${totalSalary.toLocaleString()}.ع`
      ].join("\n");

      await sendTelegramMessage(telegramMessageText, { botToken: notificationBotToken });
    }
  } catch (err) {
    console.error("Failed to send telegram notification:", err);
  }

  // 3. إعداد رابط واتساب للمدير
  const waMsg = [
    `*تسوية أرباح طلب (واصل) للموظف ${staff.name}*`,
    `طلب رقم: #${order.orderNumber}`,
    `مبلغ الربح المستلم: ${profit} د.ع`,
    `الاستقطاع من الراتب: ${deduction} د.ع`,
    `-------------------------`,
    `الراتب الثابت: ${originalSalary} د.ع`,
    `المتبقي من الراتب: ${remainingSalary} د.ع`,
    `الراتب الكلي (الوضع الحالي): ${totalSalary} د.ع`
  ].join("\n");

  const waPhone = "9647733921468"; // رقم المدير الافتراضي
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

  revalidatePath("/staff/portal/salary-wallet");
  revalidatePath("/staff/portal/profits");
  return { ok: true, waUrl };
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
  const productsJsonStr = String(formData.get("productsJson") ?? "").trim();
  const customerRegionId = String(formData.get("customerRegionId") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerLandmark = String(formData.get("customerLandmark") ?? "").trim();
  const orderTime = String(formData.get("orderTime") ?? "").trim();
  const newPreparerId = String(formData.get("preparerId") ?? "").trim() || null;

  if (!titleLine || !productsJsonStr || !customerRegionId || !orderTime) {
    return { error: "بيانات ناقصة — تأكد من عنوان الطلب والمنطقة والمنتجات ووقت الطلب." };
  }

  let parsedProducts: Array<{ id: string; line: string; preparerId: string | null }> = [];
  try {
    parsedProducts = JSON.parse(productsJsonStr);
  } catch {
    return { error: "خطأ في تنسيق المنتجات." };
  }
  
  parsedProducts = parsedProducts.filter((p) => p.line.trim() !== "");
  if (parsedProducts.length === 0) return { error: "لا توجد منتجات في القائمة." };

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

  if (newPreparerId) {
    const preparer = await prisma.companyPreparer.findUnique({ where: { id: newPreparerId } });
    if (!preparer || !preparer.active) {
      return { error: "المجهز المحدد غير موجود أو غير مفعل." };
    }
  }

  const existingProducts = Array.isArray(meta.products) ? meta.products : [];
  const priceBuckets = new Map<string, Array<{ buyAlf: number | null; sellAlf: number | null }>>();
  for (const item of existingProducts) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const line = String(row.line ?? "").trim();
    if (!line) continue;
    const buyNum = row.buyAlf == null ? null : typeof row.buyAlf === "number" && Number.isFinite(row.buyAlf) ? row.buyAlf : null;
    const sellNum = row.sellAlf == null ? null : typeof row.sellAlf === "number" && Number.isFinite(row.sellAlf) ? row.sellAlf : null;
    const bucket = priceBuckets.get(line);
    const entry = { buyAlf: buyNum, sellAlf: sellNum };
    if (bucket) bucket.push(entry);
    else priceBuckets.set(line, [entry]);
  }

  const groups = new Map<string | null, Array<{ line: string; buyAlf: number | null; sellAlf: number | null }>>();
  for (const p of parsedProducts) {
    const lineStr = p.line.trim();
    const pId = p.preparerId || newPreparerId;
    const preserved = priceBuckets.get(lineStr)?.shift();
    const finalProduct = {
      line: lineStr,
      buyAlf: preserved?.buyAlf ?? null,
      sellAlf: preserved?.sellAlf ?? null,
    };
    const group = groups.get(pId);
    if (group) group.push(finalProduct);
    else groups.set(pId, [finalProduct]);
  }

  const groupEntries = Array.from(groups.entries());
  if (groupEntries.length === 0) return { error: "لا توجد منتجات مقبولة." };

  const [firstGroup, ...otherGroups] = groupEntries;

  const nextDataFirst = {
    ...meta,
    version: 1,
    products: firstGroup[1],
    ...(rawListText ? { rawListText } : {}),
  };

  await prisma.companyPreparerShoppingDraft.update({
    where: { id: draft.id },
    data: {
      titleLine,
      rawListText,
      customerRegion: { connect: { id: customerRegionId } },
      customerPhone: phoneLocal,
      customerName,
      customerLandmark,
      orderTime,
      placesCount: null,
      status: PreparerShoppingDraftStatus.draft,
      data: nextDataFirst,
      preparer: firstGroup[0] ? { connect: { id: firstGroup[0] } } : { disconnect: true },
    },
  });

  if (otherGroups.length > 0) {
    const groupId = String(meta.groupId || `GRP-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    // تحديث مسودة الأولى بمعرف المجموعة
    await prisma.companyPreparerShoppingDraft.update({
      where: { id: draft.id },
      data: {
        data: { ...nextDataFirst, groupId }
      }
    });

    for (const [prepId, prods] of otherGroups) {
      const nextDataOther = {
        ...meta,
        version: 1,
        products: prods,
        groupId,
        ...(rawListText ? { rawListText } : {}),
      };
      await prisma.companyPreparerShoppingDraft.create({
        data: {
          preparer: prepId ? { connect: { id: prepId } } : undefined,
          status: PreparerShoppingDraftStatus.draft,
          titleLine,
          rawListText,
          customerRegion: { connect: { id: customerRegionId } },
          customerPhone: phoneLocal,
          customerName,
          customerLandmark,
          orderTime,
          placesCount: null,
          data: nextDataOther,
        },
      });
    }
  }

  revalidatePath("/staff/portal/submitted");
  revalidatePath(`/staff/portal/submitted/${draft.id}`);
  revalidatePath("/preparer/preparation");
  return { ok: true };
}

export async function cancelStaffPreparationDraft(
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
    select: { id: true, status: true, data: true, titleLine: true, customerPhone: true },
  });
  if (!draft) return { error: "المسودة غير موجودة." };

  // التحقق من الصلاحية
  const meta = draft.data && typeof draft.data === "object" ? (draft.data as Record<string, unknown>) : {};
  const owner = String(meta.fromStaffEmployeeId ?? "").trim();
  if (owner !== staff.id) {
    return { error: "لا صلاحية لرفض هذه المسودة." };
  }

  if (draft.status === PreparerShoppingDraftStatus.sent || draft.status === PreparerShoppingDraftStatus.archived) {
    return { error: "لا يمكن رفض طلب تم إرساله أو أرشفته بالفعل." };
  }

  await prisma.companyPreparerShoppingDraft.update({
    where: { id: draftId },
    data: { status: PreparerShoppingDraftStatus.archived },
  });

  // إرسال إشعار للإدارة برفض الطلب
  void notifyTelegramDraftCanceled(draftId).catch(console.error);

  // تحديث المسارات
  revalidatePath("/staff/portal/submitted");
  revalidatePath("/preparer/preparation");

  return { ok: true };
}
