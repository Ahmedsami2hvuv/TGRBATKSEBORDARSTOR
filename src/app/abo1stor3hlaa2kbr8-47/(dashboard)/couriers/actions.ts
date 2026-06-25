"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export type CourierFormState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export type CourierMandoubResetState = {
  error?: string;
  success?: boolean;
  ok?: boolean;
};

export async function createCourier(state: CourierFormState, formData: FormData): Promise<CourierFormState> {
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const telegramUserIdRaw = formData.get("telegramUserId") as string;
  const telegramUserId = telegramUserIdRaw?.trim() || null;
  const vehicleTypeRaw = formData.get("vehicleType") as string;
  const vehicleType = vehicleTypeRaw === "bike" ? "bike" : "car";

  const showDoorBtn = formData.get("showDoorBtn") === "on";
  const showLocationBtn = formData.get("showLocationBtn") === "on";
  const showCallBtn = formData.get("showCallBtn") === "on";
  const showWhatsAppBtn = formData.get("showWhatsAppBtn") === "on";
  const showNotesBtn = formData.get("showNotesBtn") === "on";
  const showVoiceNotesBtn = formData.get("showVoiceNotesBtn") === "on";
  const zeroEarning = formData.get("zeroEarning") === "on";

  try {
    // التحقق من وجود رقم الهاتف مسبقاً
    const existingPhone = await prisma.courier.findFirst({ where: { phone } });
    if (existingPhone) return { error: "رقم الهاتف هذا مسجل لمندوب آخر بالفعل." };

    // التحقق من وجود معرف تيليجرام مسبقاً (إذا تم إدخاله)
    if (telegramUserId) {
      const existingTelegram = await prisma.courier.findUnique({ where: { telegramUserId } });
      if (existingTelegram) return { error: "معرف التيليجرام هذا مستخدم من قبل مندوب آخر." };
    }

    await prisma.courier.create({
      data: {
        name,
        phone,
        telegramUserId,
        vehicleType,
        showDoorBtn,
        showLocationBtn,
        showCallBtn,
        showWhatsAppBtn,
        showNotesBtn,
        showVoiceNotesBtn,
        zeroEarning,
      },
    });

    revalidatePath(`${SECRET_ADMIN_PATH}/couriers`);
    return { success: true };
  } catch (e: any) {
    console.error("CREATE COURIER ERROR:", e);
    // التحقق من أخطاء Prisma المحددة
    if (e.code === 'P2002') {
       return { error: "فشل الإضافة: يوجد بيانات مكررة (الهاتف أو التيليجرام)." };
    }
    return { error: "حدث خطأ غير متوقع: " + (e.message || "فشل إضافة المندوب") };
  }
}

export async function updateCourier(id: string, state: CourierFormState, formData: FormData): Promise<CourierFormState> {
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const telegramUserIdRaw = formData.get("telegramUserId") as string;
  const telegramUserId = telegramUserIdRaw?.trim() || null;
  const vehicleTypeRaw = formData.get("vehicleType") as string;
  const vehicleType = vehicleTypeRaw === "bike" ? "bike" : "car";

  const showDoorBtn = formData.get("showDoorBtn") === "on";
  const showLocationBtn = formData.get("showLocationBtn") === "on";
  const showCallBtn = formData.get("showCallBtn") === "on";
  const showWhatsAppBtn = formData.get("showWhatsAppBtn") === "on";
  const showNotesBtn = formData.get("showNotesBtn") === "on";
  const showVoiceNotesBtn = formData.get("showVoiceNotesBtn") === "on";
  const zeroEarning = formData.get("zeroEarning") === "on";
  const hiddenFromReports = formData.get("hiddenFromReports") === "on";
  const blocked = formData.get("blocked") === "on";

  try {
    await prisma.courier.update({
      where: { id },
      data: {
        name,
        phone,
        telegramUserId,
        vehicleType,
        showDoorBtn,
        showLocationBtn,
        showCallBtn,
        showWhatsAppBtn,
        showNotesBtn,
        showVoiceNotesBtn,
        zeroEarning,
        hiddenFromReports,
        blocked,
      },
    });
    revalidatePath(`${SECRET_ADMIN_PATH}/couriers`);
    return { success: true };
  } catch (e: any) {
    return { error: "فشل تحديث البيانات: " + (e.message || "تأكد من عدم تكرار الهاتف أو التيليجرام") };
  }
}

export async function deleteCourierAction(
  _state: CourierFormState,
  formData: FormData,
): Promise<CourierFormState> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "معرّف المندوب غير صالح." };

  try {
    await prisma.$transaction(async (tx) => {
      // Preserve historical records while removing this courier account.
      await tx.order.updateMany({
        where: { assignedCourierId: id },
        data: { assignedCourierId: null },
      });

      await tx.order.updateMany({
        where: { courierEarningForCourierId: id },
        data: { courierEarningForCourierId: null },
      });

      await tx.orderCourierMoneyEvent.updateMany({
        where: { courierId: id },
        data: { courierId: null },
      });

      await tx.walletPeerTransfer.updateMany({
        where: { fromCourierId: id },
        data: { fromCourierId: null },
      });

      await tx.walletPeerTransfer.updateMany({
        where: { toCourierId: id },
        data: { toCourierId: null },
      });

      await tx.courierWalletMiscEntry.deleteMany({
        where: { courierId: id },
      });

      await tx.courier.delete({
        where: { id },
      });
    });
    revalidatePath(`${SECRET_ADMIN_PATH}/couriers`);
    return { success: true, message: "تم حذف حساب المندوب نهائيًا." };
  } catch (error: any) {
    return { error: error?.message || "حدث خطأ أثناء حذف الحساب نهائيًا." };
  }
}

export async function resetCourierMandoubTotals(id: string, _prevState?: CourierMandoubResetState): Promise<CourierMandoubResetState> {
  try {
    const courier = await prisma.courier.findUnique({
      where: { id },
      select: { mandoubTotalsResetAt: true, createdAt: true, mandoubWalletCarryOverDinar: true },
    });
    if (!courier) return { error: "المندوب غير موجود" };

    const resetAt = courier.mandoubTotalsResetAt;
    const periodStartAt = resetAt ?? courier.createdAt;
    const periodEndAt = new Date();

    const orders = await prisma.order.findMany({
      where: {
        assignedCourierId: id,
        status: { in: ["assigned", "delivering", "delivered", "archived"] },
      },
      select: {
        assignedCourierId: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        courierEarningDinar: true,
        courierEarningForCourierId: true,
        deliveryPrice: true,
        courierVehicleType: true,
        courier: { select: { vehicleType: true } },
        moneyEvents: {
          orderBy: { createdAt: "asc" },
          select: {
            kind: true,
            amountDinar: true,
            deletedAt: true,
            createdAt: true,
            courierId: true,
          },
        },
      },
    });

    const listNorm = orders.map((o) => ({
      ...o,
      moneyEvents: o.moneyEvents.map((e) => ({
        ...e,
        courierId: e.courierId ?? undefined,
      })),
    }));

    const { computeMandoubTotalsForCourier } = await import("@/lib/mandoub-courier-totals");
    const metrics = computeMandoubTotalsForCourier(listNorm as any, id, resetAt, true);

    const allEvents = await prisma.orderCourierMoneyEvent.findMany({
      where: { deletedAt: null, courierId: id },
      select: { courierId: true, kind: true, amountDinar: true, createdAt: true },
    });

    const allMisc = await prisma.courierWalletMiscEntry.findMany({
      where: { deletedAt: null, courierId: id },
      select: { courierId: true, direction: true, amountDinar: true, createdAt: true, label: true },
    });

    let tipSum = 0;
    for (const m of allMisc) {
      if (m.label.includes("[إكرامية]") && (!resetAt || m.createdAt > resetAt)) {
        tipSum += Number(m.amountDinar);
      }
    }

    const { computeMoneySumsFromCourierEvents, mergeMiscWalletIntoSums } = await import("@/lib/mandoub-courier-event-totals");
    
    const money = mergeMiscWalletIntoSums(
      computeMoneySumsFromCourierEvents(allEvents, id, resetAt),
      allMisc,
      resetAt
    );

    const oldCarryOver = typeof courier.mandoubWalletCarryOverDinar.toNumber === "function" 
      ? courier.mandoubWalletCarryOverDinar.toNumber() 
      : Number(courier.mandoubWalletCarryOverDinar);
      
    const newCarryOver = oldCarryOver + money.remainingNet;
    const totalProfitDinar = metrics.sumEarnings + tipSum;
    const totalOrders = metrics.ordersDelivered;

    await prisma.$transaction(async (tx) => {
      await tx.courierProfitHistory.create({
        data: {
          courierId: id,
          periodStartAt,
          periodEndAt,
          totalOrders,
          totalProfitDinar,
        },
      });

      await tx.courier.update({
        where: { id },
        data: { 
          mandoubWalletCarryOverDinar: newCarryOver,
          mandoubTotalsResetAt: periodEndAt
        }
      });
    });

    revalidatePath(`${SECRET_ADMIN_PATH}/couriers`);
    revalidatePath(`${SECRET_ADMIN_PATH}/reports`);
    revalidatePath(`${SECRET_ADMIN_PATH}/reports/couriers-history`);
    
    return { success: true, ok: true };
  } catch (e: any) {
    console.error("Reset courier error:", e);
    return { error: "فشل تصفير الحساب", ok: false };
  }
}

export async function toggleCourierChat(id: string, disabled: boolean) {
  try {
    await prisma.courier.update({
      where: { id },
      data: { chatDisabled: disabled }
    });
    revalidatePath(`${SECRET_ADMIN_PATH}/couriers`);
    return { success: true };
  } catch (e) {
    return { error: "فشل تعديل حالة الدردشة" };
  }
}

export async function toggleCourierAI(id: string, disabled: boolean) {
  try {
    await prisma.courier.update({
      where: { id },
      data: { aiDisabled: disabled }
    });
    revalidatePath(`${SECRET_ADMIN_PATH}/couriers`);
    return { success: true };
  } catch (e) {
    return { error: "فشل تعديل حالة الذكاء الاصطناعي" };
  }
}
