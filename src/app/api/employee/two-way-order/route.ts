import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";

function verifyRequest(request: Request) {
  const urlObj = new URL(request.url);
  const se = request.headers.get("x-employee-se") || urlObj.searchParams.get("se") || undefined;
  const exp = request.headers.get("x-employee-exp") || urlObj.searchParams.get("exp") || undefined;
  const sig = request.headers.get("x-employee-sig") || urlObj.searchParams.get("s") || undefined;
  
  if (!se || !exp || !sig) return { ok: false };
  return verifyStaffEmployeePortalQuery(se, exp, sig);
}

export async function POST(request: Request) {
  try {
    const verification = verifyRequest(request);
    if (!verification.ok) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const staff = await prisma.staffEmployee.findUnique({
      where: { id: verification.staffEmployeeId },
      select: { id: true, name: true, active: true, portalToken: true }
    });

    if (!staff || !staff.active || staff.portalToken !== verification.token) {
      return NextResponse.json({ error: "الحساب غير مفعّل أو الرابط غير صالح" }, { status: 403 });
    }

    const body = await request.json();
    const {
      sellerPhone,
      sellerRegionId,
      buyerPhone,
      buyerRegionId,
      orderTime,
      orderType,
      sellerAmount,
      profit,
      deliveryPrice,
      sellerLandmark,
      buyerLandmark,
      orderNoteText
    } = body;

    if (!sellerPhone || !sellerRegionId || !buyerPhone || !buyerRegionId || !orderTime) {
      return NextResponse.json({ error: "يرجى ملء كافة الحقول المطلوبة للطلب" }, { status: 400 });
    }

    const sPhone = normalizeIraqMobileLocal11(sellerPhone);
    const bPhone = normalizeIraqMobileLocal11(buyerPhone);

    if (!sPhone || !bPhone) {
      return NextResponse.json({ error: "أرقام الهاتف للبائع أو المشتري غير صالحة" }, { status: 400 });
    }

    // فحص الحظر
    const blockedPhones = await prisma.globalBlockedPhone.findMany({
      where: { phone: { in: [sPhone, bPhone] } }
    });
    if (blockedPhones.length > 0) {
      return NextResponse.json({ error: "أحد الأرقام المدخلة محظور من التوصيل" }, { status: 400 });
    }

    const sAmount = parseFloat(String(sellerAmount || "0"));
    const sProfit = parseFloat(String(profit || "0"));
    const dPrice = parseFloat(String(deliveryPrice || "0"));

    const totalAmount = sAmount + sProfit + dPrice;
    const finalOrderType = orderType || "توصيل فقط";

    const doubleShop = await prisma.shop.findFirst({
      where: { name: { contains: "وجهتين" } }
    }) || await prisma.shop.findFirst();

    if (!doubleShop) {
      return NextResponse.json({ error: "لا يوجد محل معرف في النظام لاستقبال الطلب" }, { status: 400 });
    }

    // جلب ملفات التعريف من الخادم لدمج المعلومات
    const [sProf, bProf] = await Promise.all([
      prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone: sPhone, regionId: sellerRegionId } }
      }),
      prisma.customerPhoneProfile.findUnique({
        where: { phone_regionId: { phone: bPhone, regionId: buyerRegionId } }
      })
    ]);

    const finalSellerLandmark = sellerLandmark || sProf?.landmark || "";
    const finalSellerLoc = sProf?.locationUrl || "";
    const finalSellerPhoto = sProf?.photoUrl || null;
    const finalSellerAltPhone = sProf?.alternatePhone || null;

    const finalBuyerLandmark = buyerLandmark || bProf?.landmark || "";
    const finalBuyerLoc = bProf?.locationUrl || "";
    const finalBuyerPhoto = bProf?.photoUrl || null;

    const order = await prisma.order.create({
      data: {
        shop: { connect: { id: doubleShop.id } },
        routeMode: "double",
        orderType: finalOrderType,
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
        orderNoteTime: `${finalOrderType} - ${orderTime}`,
        orderSubtotal: sAmount + sProfit,
        deliveryPrice: dPrice,
        totalAmount: totalAmount,
        adminOrderCode: orderNoteText || "",
        submissionSource: "staff_portal",
        summary: `طلب وجهتين (${finalOrderType}): من ${sPhone} إلى ${bPhone}${orderNoteText ? `\n\nملاحظة الموظف: ${orderNoteText}` : ""}`,
        preparerShoppingJson: {
          staffId: staff.id,
          staffProfit: sProfit,
          profitSettled: false
        }
      }
    });

    // إشعار التليجرام
    void notifyTelegramNewOrder(order.id).catch(err => console.error("Telegram notify failed:", err));

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber
    });

  } catch (error: any) {
    console.error("Employee two-way-order API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
