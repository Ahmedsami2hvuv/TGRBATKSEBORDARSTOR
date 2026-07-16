import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * جلب الدين القديم للزبون من دفتر الديون
 * يمكن البحث عن طريق معرف الزبون أو رقم هاتفه
 */
export async function getCustomerOldDebt(
  params: { customerId?: string | null; phone?: string | null },
  db: any = prisma
): Promise<number> {
  let partner = null;

  // 1. البحث عن طريق معرف الزبون الخارجي (externalId)
  if (params.customerId) {
    partner = await db.creditBookPartner.findUnique({
      where: {
        type_externalId: {
          type: "customer",
          externalId: params.customerId,
        },
      },
      include: {
        transactions: true,
      },
    });
  }

  // 2. إذا لم نعثر عليه، نبحث عن طريق الهاتف
  if (!partner && params.phone) {
    const cleanPhone = params.phone.trim();
    partner = await db.creditBookPartner.findFirst({
      where: {
        type: "customer",
        phone: cleanPhone,
      },
      include: {
        transactions: true,
      },
    });
  }

  if (!partner) return 0;

  // 3. حساب الرصيد (مجموع ما نطلبه gave - مجموع ما سدده took)
  const totalGave = partner.transactions
    .filter((t: any) => t.kind === "gave")
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

  const totalTook = partner.transactions
    .filter((t: any) => t.kind === "took")
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

  const balance = totalGave - totalTook;
  return balance > 0 ? balance : 0;
}
