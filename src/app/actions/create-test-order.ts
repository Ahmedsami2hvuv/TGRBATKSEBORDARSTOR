"use server";

import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { ADMIN_OFFICE_LABEL, ADMIN_SHOP_NAMES } from "@/lib/admin-order-from-admin-constants";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";

const SYSTEM_ADMIN_SHOP_NAME = ADMIN_OFFICE_LABEL;
const SYSTEM_ADMIN_PHONE = "07733921568";

export async function createTestOrderAction(): Promise<{
  ok: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
}> {
  try {
    // 1. جلب أو إنشاء محل الإدارة
    let shop = await prisma.shop.findFirst({
      where: { name: { in: ADMIN_SHOP_NAMES } },
      include: { region: true },
    });

    if (!shop) {
      let firstRegion = await prisma.region.findFirst();
      if (!firstRegion) {
        firstRegion = await prisma.region.create({
          data: {
            name: "جيكور",
            deliveryPrice: new Decimal(3000),
          },
        });
      }
      shop = await prisma.shop.create({
        data: {
          name: SYSTEM_ADMIN_SHOP_NAME,
          phone: SYSTEM_ADMIN_PHONE,
          locationUrl: "",
          region: { connect: { id: firstRegion.id } },
        },
        include: { region: true },
      });
    }

    // 2. جلب منطقة "جيكور"
    let region = await prisma.region.findFirst({
      where: {
        name: { contains: "جيكور", mode: "insensitive" },
      },
    });

    if (!region) {
      region = await prisma.region.findFirst();
      if (!region) {
        region = await prisma.region.create({
          data: {
            name: "جيكور",
            deliveryPrice: new Decimal(3000),
          },
        });
      }
    }

    // 3. جلب المندوب "boos"
    const courier = await prisma.courier.findFirst({
      where: {
        OR: [
          { name: { contains: "boos", mode: "insensitive" } },
          { name: { contains: "boss", mode: "insensitive" } },
          { name: { contains: "بوس", mode: "insensitive" } },
        ],
      },
    });

    // 4. رقم هاتف الزبون والعميل التابع لمحل الإدارة
    const testPhoneRaw = "07733921468";
    const testPhone = normalizeIraqMobileLocal11(testPhoneRaw) || testPhoneRaw;

    // البحث عن عميل برقم الهاتف أو تابع لمحل الإدارة
    let customer = await prisma.customer.findFirst({
      where: {
        shopId: shop.id,
        phone: testPhone,
      },
    });

    if (!customer) {
      // محاولة العثور على أي عميل لمحل الإدارة أو إنشاء واحد
      const anyShopCustomer = await prisma.customer.findFirst({
        where: { shopId: shop.id },
      });

      customer = await prisma.customer.create({
        data: {
          shopId: shop.id,
          name: anyShopCustomer?.name ? `${anyShopCustomer.name} (تيست)` : "زبون تجريبي",
          phone: testPhone,
          customerRegionId: region.id,
          customerLocationUrl: "",
          customerLandmark: "طلب تجريبي تيست",
        },
      });
    }

    // جلب موظف/عميل تابع لمحل الإدارة
    const shopEmployee = await prisma.shopEmployee.findFirst({
      where: { shopId: shop.id },
    });

    // 5. حساب رقم الطلب الجديد
    const lastOrder = await prisma.order.findFirst({
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;

    // 6. المبالغ والأسعار: السعر 10.5 ألف دينار (10,500 د.ع)
    const orderPriceAlf = 10.5;
    const orderSubtotal = new Decimal(orderPriceAlf * 1000); // 10500
    const deliveryPrice = region.deliveryPrice ?? new Decimal(0);
    const totalAmount = orderSubtotal; // السعر الكلي للطلب 10.5

    // 7. إنشاء الطلب
    const order = await prisma.order.create({
      data: {
        orderNumber: nextOrderNumber,
        orderType: "تيست",
        status: courier ? "assigned" : "pending",
        shopId: shop.id,
        submittedByEmployeeId: shopEmployee?.id ?? null,
        customerId: customer.id,
        customerPhone: testPhone,
        customerRegionId: region.id,
        customerLandmark: "طلب تجريبي سريع (تيست)",
        customerLocationUrl: "",
        orderSubtotal: orderSubtotal,
        purchasePrice: orderSubtotal,
        deliveryPrice: deliveryPrice,
        totalAmount: totalAmount,
        assignedCourierId: courier?.id ?? null,
        submissionSource: "admin_portal",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 8. مزامنة ملف الهاتف
    void syncPhoneProfileFromOrder(order.id).catch(() => {});

    // 9. إعادة التحقق من المسارات (Revalidation)
    revalidatePath("/abo1stor3hlaa2kbr8-47/orders/tracking");
    revalidatePath("/abo1stor3hlaa2kbr8-47/orders/pending");
    revalidatePath("/abo1stor3hlaa2kbr8-47/orders");
    revalidatePath("/abo1stor3hlaa2kbr8-47");
    revalidatePath("/mandoub");

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  } catch (error: any) {
    console.error("[createTestOrderAction] Error:", error);
    return {
      ok: false,
      error: error?.message || "تعذر إنشاء طلب التيست",
    };
  }
}
