import type { Prisma } from "@prisma/client";

/**
 * سياسة النظام: لا تُلغى حركات الصادر/الوارد ولا تُصفّر أرباح المندوب تلقائياً عند تغيير حالة الطلب
 * أو سحبه من المندوب. الإلغاء الناعم والمسح يتم فقط من مسار الحذف اليدوي الصريح في الواجهة.
 *
 * تُستدعى الدالة من أماكن قديمة للتوافق؛ محتواها فارغ عمداً.
 */
export async function reconcileMoneyEventsOnOrderStatusChange(
  _tx: Prisma.TransactionClient,
  _orderId: string,
  _prevStatus: string,
  _nextStatus: string,
): Promise<void> {
  /* no-op — راجع التعليق أعلاه */
}
