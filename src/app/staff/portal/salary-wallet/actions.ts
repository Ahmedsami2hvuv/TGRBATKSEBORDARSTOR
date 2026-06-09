"use server";

import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { recordReceiveProfitTransaction, recordWithdrawSalaryTransaction } from "@/lib/staff-salary";
import { revalidatePath } from "next/cache";
import { getBotTokenByPurpose } from "@/lib/telegram-bots";
import { sendTelegramMessage } from "@/lib/telegram";

export type SalaryActionState = { error?: string; ok?: boolean; waUrl?: string };

/**
 * تسجيل معاملة مبيعات (عمولة)
 */
export async function createSalaryTransactionAction(
  _prev: SalaryActionState,
  formData: FormData,
): Promise<SalaryActionState> {
  const se = String(formData.get("se") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const s = String(formData.get("s") ?? "").trim();

  const v = verifyStaffEmployeePortalQuery(se, exp, s);
  if (!v.ok) return { error: "الربط غير صالح أو انتهت الصلاحية." };

  const staff = await prisma.staffEmployee.findUnique({ where: { id: v.staffEmployeeId } });
  if (!staff || !staff.active) return { error: "الموظف غير موجود أو موقوف." };

  const details = String(formData.get("details") ?? "").trim(); // سنستخدم details لتخزين "نوع المعاملة"
  const phone = String(formData.get("phone") ?? "").trim();
  const profit = Number(formData.get("profit") ?? 0);
  const photoFile = formData.get("photo") as File | null;

  if (!details) return { error: "يرجى كتابة نوع المعاملة." };
  if (!phone) return { error: "يرجى إدخال رقم هاتف البائع." };
  if (profit <= 0) return { error: "يرجى إدخال مبلغ الربح." };

  let imageUrl = "";
  if (photoFile && photoFile.size > 0) {
    try {
      const { saveCustomerProfilePhotoUploaded } = await import("@/lib/order-image");
      imageUrl = await saveCustomerProfilePhotoUploaded(photoFile, 20); // حد أقصى 20 ميجا
    } catch (err: any) {
      return { error: `فشل رفع صورة المعاملة: ${err.message}` };
    }
  }

  // 1. تسجيل المعاملة في قاعدة البيانات وخصم نصف الربح من الراتب (سعر المنتج amount يُضبط 0)
  const result = await recordReceiveProfitTransaction({
    staffEmployeeId: staff.id,
    details,
    amount: 0,
    phone,
    profit,
    imageUrl,
  });

  const deduction = profit / 2;
  const remainingSalary = Number(result.staff.salaryBalance);
  const originalSalary = Number(staff.fixedSalary);
  const totalSalary = remainingSalary + profit; 

  // 2. إرسال إشعار فوراً إلى بوت التليجرام
  try {
    const botToken = await getBotTokenByPurpose("notification");
    if (botToken) {
      const telegramMessageText = [
        `📊 <b>معاملة موظف جديدة (عمولة مبيعات)</b>`,
        `👤 <b>الموظف:</b> ${staff.name}`,
        `📝 <b>نوع المعاملة:</b> ${details}`,
        `💵 <b>الربح المستلم:</b> ${profit.toLocaleString()} د.ع`,
        `🔴 <b>الاستقطاع من الراتب:</b> ${deduction.toLocaleString()} د.ع`,
        `📞 <b>رقم هاتف البائع:</b> ${phone}`,
        `-------------------------`,
        `💵 <b>الراتب الثابت:</b> ${originalSalary.toLocaleString()} د.ع`,
        `⏳ <b>المتبقي من الراتب:</b> ${remainingSalary.toLocaleString()} د.ع`,
        `📈 <b>الراتب الكلي (الوضع الحالي):</b> ${totalSalary.toLocaleString()} د.ع`
      ].join("\n");

      await sendTelegramMessage(telegramMessageText, { botToken });
    }
  } catch (err) {
    console.error("Failed to send telegram notification:", err);
  }

  // 3. إعداد رسالة واتساب التلقائية ونقله للمدير
  const waMsg = [
    `*تفاصيل معاملة الموظف ${staff.name}*`,
    `العملية: تسجيل عمولة مبيعات`,
    `نوع المعاملة: ${details}`,
    `مبلغ الربح المستلم: ${profit} د.ع`,
    `الاستقطاع من الراتب: ${deduction} د.ع`,
    `هاتف البائع: ${phone}`,
    `-------------------------`,
    `الراتب الثابت: ${originalSalary} د.ع`,
    `المتبقي من الراتب: ${remainingSalary} د.ع`,
    `الراتب الكلي (الوضع الحالي): ${totalSalary} د.ع`
  ].join("\n");

  const waPhone = "9647733921468"; // رقم المدير الافتراضي
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

  revalidatePath(`/staff/portal/salary-wallet`);
  return { ok: true, waUrl };
}

/**
 * سحب راتب (استلام المتبقي)
 */
export async function withdrawSalaryAction(
  _prev: SalaryActionState,
  formData: FormData,
): Promise<SalaryActionState> {
  const se = String(formData.get("se") ?? "").trim();
  const exp = String(formData.get("exp") ?? "").trim();
  const s = String(formData.get("s") ?? "").trim();

  const v = verifyStaffEmployeePortalQuery(se, exp, s);
  if (!v.ok) return { error: "الربط غير صالح أو انتهت الصلاحية." };

  const staff = await prisma.staffEmployee.findUnique({ where: { id: v.staffEmployeeId } });
  if (!staff || !staff.active) return { error: "الموظف غير موجود أو موقوف." };

  const withdrawAmount = Number(formData.get("withdrawAmount") ?? 0);
  const remainingSalary = Number(staff.salaryBalance);

  if (withdrawAmount <= 0) return { error: "يرجى كتابة مبلغ صالح للسحب." };
  if (withdrawAmount > remainingSalary) return { error: "المبلغ المطلوب سحبه يتجاوز الرصيد المتبقي لراتبك." };

  // 1. تسجيل عملية السحب في قاعدة البيانات وخصم المبلغ من الرصيد
  const result = await recordWithdrawSalaryTransaction({
    staffEmployeeId: staff.id,
    amount: withdrawAmount,
  });

  const newRemaining = Number(result.staff.salaryBalance);
  const originalSalary = Number(staff.fixedSalary);

  // 2. إرسال إشعار فوراً إلى بوت التليجرام
  try {
    const botToken = await getBotTokenByPurpose("notification");
    if (botToken) {
      const telegramMessageText = [
        `📥 <b>عملية سحب راتب موظف</b>`,
        `👤 <b>الموظف:</b> ${staff.name}`,
        `💵 <b>المبلغ المسحوب:</b> ${withdrawAmount.toLocaleString()} د.ع`,
        `-------------------------`,
        `⏳ <b>الرصيد المتبقي السابق:</b> ${remainingSalary.toLocaleString()} د.ع`,
        `📉 <b>الرصيد المتبقي الحالي:</b> ${newRemaining.toLocaleString()} د.ع`
      ].join("\n");

      await sendTelegramMessage(telegramMessageText, { botToken });
    }
  } catch (err) {
    console.error("Failed to send telegram notification:", err);
  }

  // 3. إعداد رسالة واتساب التلقائية ونقله للمدير
  const waMsg = [
    `*عملية سحب راتب موظف*`,
    `الموظف: ${staff.name}`,
    `المبلغ المستلم: ${withdrawAmount} د.ع`,
    `الرصيد المتبقي السابق: ${remainingSalary} د.ع`,
    `الرصيد المتبقي الحالي: ${newRemaining} د.ع`
  ].join("\n");

  const waPhone = "9647733921468"; // رقم المدير الافتراضي
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

  revalidatePath(`/staff/portal/salary-wallet`);
  return { ok: true, waUrl };
}
