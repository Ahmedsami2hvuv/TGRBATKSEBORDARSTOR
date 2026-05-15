import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { whatsappMeUrl } from "@/lib/whatsapp";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import { revalidatePath } from "next/cache";
import { sendTelegramHtmlToChat } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const telegramUserId = searchParams.get("uid");

  if (!telegramUserId) {
    return new NextResponse("Missing user ID", { status: 400 });
  }

  // 1. جلب الجلسة الحالية
  const session = await prisma.telegramBotSession.findUnique({
    where: { telegramUserId },
  });

  if (!session || session.step !== "shop_emp_order_confirm") {
    return new NextResponse("Session expired or invalid", { status: 404 });
  }

  const payload = JSON.parse(session.payload || "{}");
  const { employeeId, draft } = payload;

  try {
    // 2. جلب بيانات الموظف والمحل
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shop: { include: { region: true } } },
    });

    if (!emp) throw new Error("Employee not found");

    const price = new Decimal(draft.orderSubtotal);
    const finalDel = new Decimal(draft.deliveryPrice);
    const total = price.add(finalDel);

    // 3. إنشاء الطلب
    const order = await prisma.order.create({
      data: {
        shopId: emp.shopId,
        status: "pending",
        orderType: draft.orderType || "غير محدد",
        customerRegionId: draft.regionId,
        customerPhone: draft.customerPhone,
        orderSubtotal: price,
        deliveryPrice: finalDel,
        totalAmount: total,
        submissionSource: "admin_on_behalf_of_employee",
        submittedByEmployeeId: employeeId,
        orderNoteTime: draft.orderNoteTime || "فوري",
      },
    });

    // 4. تنظيف الجلسة وإرسال الإشعارات
    await prisma.telegramBotSession.delete({ where: { telegramUserId } });
    revalidatePath("/admin/orders/pending");
    await notifyTelegramNewOrder(order.id).catch(() => {});
    void pushNotifyAdminsNewPendingOrder(order.orderNumber).catch(() => {});

    // 5. تحديث رسالة التليجرام لتظهر أنها "تمت"
    if (session.chatId) {
        await sendTelegramHtmlToChat(session.chatId, `✅ تم رفع الطلب <b>#${order.orderNumber}</b> بنجاح وتحويلك للواتساب.`);
    }

    // 6. تجهيز رابط الواتساب والتحويل التلقائي
    const waMsg = [
      "مرحباً، لقد قمت برفع طلب جديد عبر التليجرام:",
      `🏢 من محل: ${emp.shop.name}`,
      `📍 من منطقة: ${emp.shop.region.name}`,
      `🎯 إلى منطقة: ${draft.regionName}`,
      `📞 رقم الزبون: ${draft.customerPhone}`,
      `💰 سعر الطلب: ${formatDinarAsAlf(price)}`,
      `🚚 التوصيل: ${formatDinarAsAlf(finalDel)}`,
      `🔢 رقم الطلب: ${order.orderNumber}`,
    ].join("\n");

    const waUrl = whatsappMeUrl("+9647733921468", waMsg);
    return NextResponse.redirect(waUrl);

  } catch (error) {
    console.error("Error confirming order via link:", error);
    return new NextResponse("Error processing order", { status: 500 });
  }
}
