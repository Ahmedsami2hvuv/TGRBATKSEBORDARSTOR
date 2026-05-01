import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";

export type ApplyPreparerShopLinksResult = { ok: true } | { error: string };

function mapUnknownDbError(e: unknown): string {
  if (e instanceof PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      return "تعارض أثناء الحفظ (محل مكرر أو طلبان معاً). حدّث الصفحة ثم أعد المحاولة.";
    }
    if (e.code === "P2003") {
      return "بيانات غير صالحة: المجهز أو المحل غير مرتبط بشكل صحيح في قاعدة البيانات.";
    }
  }
  if (e instanceof PrismaClientValidationError) {
    return `خطأ في البيانات المرسلة لقاعدة البيانات: ${e.message.slice(0, 200)}`;
  }
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  if (
    lower.includes("can't reach database") ||
    lower.includes("server has closed the connection") ||
    lower.includes("econnrefused") ||
    lower.includes("timeout")
  ) {
    return "تعذّر الاتصال بقاعدة البيانات (انقطاع أو مهلة). جرّب بعد قليل أو راجع رابط الاتصال.";
  }
  if (lower.includes("unique constraint") || lower.includes("duplicate key")) {
    return "تعارض أثناء الحفظ. حدّث الصفحة ثم أعد المحاولة.";
  }
  if (lower.includes("prepared statement") || lower.includes("pgbouncer")) {
    return "إعدادات اتصال قاعدة البيانات (موازن الاتصالات) تمنع العملية. استخدم الرابط المباشر للكتابة في DATABASE_URL.";
  }
  if (lower.includes("permission denied") || lower.includes("rls")) {
    return "رفض قاعدة البيانات للصلاحية (سياسات RLS أو المستخدم). تحقق من مفتاح الخدمة.";
  }
  if (
    lower.includes("does not exist in the current database") ||
    lower.includes("column") && lower.includes("does not exist")
  ) {
    return [
      "قاعدة البيانات أقدم من نسخة المشروع: عمود مفقود في جدول الموظفين (مثل lastEmployeeLat).",
      "نفّذ على الخادم: npx prisma migrate deploy",
      "أو نفّذ في محرر SQL لديك الهجرة الأخيرة التي تضيف أعمدة Employee للموقع.",
    ].join(" ");
  }
  return `تعذّر الحفظ: ${raw.slice(0, 220)}`;
}

/**
 * يحدّث ربط محلات المجهز ويُنشئ موظف المحفظة عند الحاجة.
 * يُستدعى من Route Handler وليس كـ Server Action لتفادي مشاكل تسلسل الطلبات.
 */
export async function applyPreparerShopLinks(
  preparerId: string,
  shopIdsInput: string[],
): Promise<ApplyPreparerShopLinksResult> {
  const preparerIdTrim = preparerId.trim();
  const shopIds = [...new Set(shopIdsInput.map((x) => String(x).trim()).filter(Boolean))];

  if (!preparerIdTrim) return { error: "معرّف المجهز مفقود." };

  const preparerExists = await prisma.companyPreparer.findFirst({
    where: { id: preparerIdTrim },
    select: { id: true },
  });
  if (!preparerExists) return { error: "المجهز غير موجود. حدّث الصفحة." };

  if (shopIds.length > 0) {
    const found = await prisma.shop.count({ where: { id: { in: shopIds } } });
    if (found !== shopIds.length) {
      return { error: "أحد المحلات المختارة غير موجود. حدّث الصفحة ثم أعد المحاولة." };
    }
  }

  try {
    await prisma.preparerShop.deleteMany({ where: { preparerId: preparerIdTrim } });
    if (shopIds.length > 0) {
      await prisma.preparerShop.createMany({
        data: shopIds.map((shopId) => ({
          preparerId: preparerIdTrim,
          shopId,
          canSubmitOrders: true,
        })),
      });
    }

    const cp = await prisma.companyPreparer.findUnique({
      where: { id: preparerIdTrim },
      select: { walletEmployeeId: true, name: true, phone: true },
    });
    if (cp && !cp.walletEmployeeId && shopIds.length > 0) {
      const phoneRaw = (cp.phone ?? "").trim();
      const phone = phoneRaw.length > 0 ? phoneRaw : `__prep_wallet__${preparerIdTrim}`;
      const em = await prisma.employee.create({
        data: {
          name: (cp.name ?? "").trim() || "مجهز",
          phone,
          shopId: shopIds[0]!,
        },
      });
      try {
        await prisma.companyPreparer.update({
          where: { id: preparerIdTrim },
          data: { walletEmployeeId: em.id },
        });
      } catch (linkErr) {
        await prisma.employee.delete({ where: { id: em.id } }).catch(() => {});
        throw linkErr;
      }
    }
  } catch (e) {
    console.error("applyPreparerShopLinks", e);
    return { error: mapUnknownDbError(e) };
  }

  try {
    revalidatePath("/admin/preparers");
  } catch (revErr) {
    console.error("applyPreparerShopLinks revalidatePath", revErr);
    return { error: "تم الحفظ لكن تعذّر تحديث الكاش. حدّث الصفحة يدوياً." };
  }

  return { ok: true };
}
