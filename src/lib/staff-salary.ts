import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * يتحقق مما إذا كان الموظف قد دخل شهراً جديداً ولم يُضف راتبه الثابت بعد.
 * إذا كان الأمر كذلك، يتم إضافة راتبه الثابت تلقائياً إلى رصيده المالي المتبقي.
 */
export async function checkAndApplyMonthlySalary(staffEmployeeId: string) {
  const staff = await prisma.staffEmployee.findUnique({
    where: { id: staffEmployeeId },
  });

  if (!staff || Number(staff.fixedSalary) <= 0) return staff;

  const now = new Date();
  const lastAdded = new Date(staff.lastSalaryAddedAt || staff.createdAt);

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth(); // 0 - 11
  const lastYear = lastAdded.getFullYear();
  const lastMonth = lastAdded.getMonth();

  // إذا دخلنا في سنة جديدة أو شهر جديد
  if (nowYear > lastYear || (nowYear === lastYear && nowMonth > lastMonth)) {
    const salary = staff.fixedSalary;

    // نقوم بتحديث رصيد الموظف وتسجيل معاملة إضافة الراتب تلقائياً
    const updated = await prisma.$transaction(async (tx) => {
      // 1. إضافة المعاملة التلقائية للراتب التراكمي
      await tx.staffTransaction.create({
        data: {
          staffEmployeeId,
          type: "salary_addition",
          details: `إضافة راتب شهر ${nowMonth + 1}/${nowYear} التلقائي التراكمي`,
          amount: salary,
          profit: 0,
          deduction: 0,
        },
      });

      // 2. تحديث الرصيد وتاريخ آخر إضافة
      return await tx.staffEmployee.update({
        where: { id: staffEmployeeId },
        data: {
          salaryBalance: { increment: salary },
          lastSalaryAddedAt: now,
        },
      });
    });

    return updated;
  }

  return staff;
}

/**
 * تسجيل معاملة مبيعات (استلام عمولة)
 * يستقطع نصف الربح من الراتب المتبقي
 */
export async function recordReceiveProfitTransaction(input: {
  staffEmployeeId: string;
  details: string;
  amount: number;
  phone: string;
  profit: number;
  imageUrl?: string;
}) {
  const deduction = input.profit / 2;

  return await prisma.$transaction(async (tx) => {
    // 1. إنشاء معاملة المبيعات
    const trx = await tx.staffTransaction.create({
      data: {
        staffEmployeeId: input.staffEmployeeId,
        type: "receive_profit",
        details: input.details,
        amount: input.amount,
        phone: input.phone,
        profit: input.profit,
        deduction: deduction,
        imageUrl: input.imageUrl || "",
      },
    });

    // 2. خصم الاستقطاع (نصف الربح) من رصيد الراتب المتبقي
    const staff = await tx.staffEmployee.update({
      where: { id: input.staffEmployeeId },
      data: {
        salaryBalance: { decrement: deduction },
      },
    });

    return { trx, staff };
  });
}

/**
 * سحب راتب (استلام المتبقي منه)
 * يخصم المبلغ المسحوب من الرصيد المتبقي
 */
export async function recordWithdrawSalaryTransaction(input: {
  staffEmployeeId: string;
  amount: number;
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. إنشاء معاملة السحب
    const trx = await tx.staffTransaction.create({
      data: {
        staffEmployeeId: input.staffEmployeeId,
        type: "withdraw_salary",
        details: "استلام راتب (سحب نقدي من الرصيد المتبقي)",
        amount: input.amount,
        profit: 0,
        deduction: input.amount, // نعتبر أن المسحوب هو قيمة الاستقطاع من الرصيد
      },
    });

    // 2. خصم المبلغ المسحوب من رصيد الراتب المتبقي
    const staff = await tx.staffEmployee.update({
      where: { id: input.staffEmployeeId },
      data: {
        salaryBalance: { decrement: input.amount },
      },
    });

    return { trx, staff };
  });
}
