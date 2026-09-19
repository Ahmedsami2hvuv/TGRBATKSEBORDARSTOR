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

    let region = await prisma.region.findFirst({
      where: { name: { contains: "جيكور", mode: "insensitive" } },
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

    const courier = await prisma.courier.findFirst({
      where: {
        OR: [
          { name: { contains: "boos", mode: "insensitive" } },
          { name: { contains: "boss", mode: "insensitive" } },
          { name: { contains: "بوس", mode: "insensitive" } },
        ],
      },
    });

    const testPhoneRaw = "07733921468";
    const testPhone = normalizeIraqMobileLocal11(testPhoneRaw) || testPhoneRaw;

    let customer = await prisma.customer.findFirst({
      where: { shopId: shop.id, phone: testPhone },
    });

    if (!customer) {
      const anyShopCustomer = await prisma.customer.findFirst({
        where: { shopId: shop.id },
      });
      customer = await prisma.customer.create({
        data: {
          shopId: shop.id,
          name: anyShopCustomer?.name? `${anyShopCustomer.name} (تيست)` : "زبون تجريبي",
          phone: testPhone,
          customerRegionId: region.id,
          customerLocationUrl: "",
          customerLandmark: "طلب تجريبي تيست",
        },
      });
    }

    const shopEmployee = await prisma.employee.findFirst({
      where: { shopId: shop.id },
    });

    const lastOrder = await prisma.order.findFirst({
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const nextOrderNumber = (lastOrder?.orderNumber?? 0) + 1;

    // ✅ التصليح هنا: السعر 10.5 مباشرة وليس 10500
    const orderPrice = 10.5;
    const orderSubtotal = new Decimal(orderPrice); // كان * 1000 وصار 10500
    const deliveryPrice = region.deliveryPrice?? new Decimal(0);
    const totalAmount = orderSubtotal; // 10.5 فقط

    const order = await prisma.order.create({
      data: {
        orderNumber: nextOrderNumber,
        orderType: "تيست",
        status: courier? "assigned" : "pending",
        shopId: shop.id,
        submittedByEmployeeId: shopEmployee?.id?? null,
        customerId: customer.id,
        customerPhone: testPhone,
        customerRegionId: region.id,
        customerLandmark: "طلب تجريبي سريع (تيست)",
        customerLocationUrl: "",
        orderSubtotal: orderSubtotal,
        purchasePrice: orderSubtotal,
        deliveryPrice: deliveryPrice,
        totalAmount: totalAmount,
        assignedCourierId: courier?.id?? null,
        submissionSource: "admin_portal",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    void syncPhoneProfileFromOrder(order.id).catch(() => {});

    revalidatePath("/abo1stor3hlaa2kbr8-47/orders/tracking");
    revalidatePath("/abo1stor3hlaa2kbr8-47/orders/pending");
    revalidatePath("/abo1stor3hlaa2kbr8-47/orders");
    revalidatePath("/abo1stor3hlaa2kbr8-47");
    revalidatePath("/mandoub");

    return { ok: true, orderId: order.id, orderNumber: order.orderNumber };
  } catch (error: any) {
    console.error("[createTestOrderAction] Error:", error);
    return { ok: false, error: error?.message || "تعذر إنشاء طلب التيست" };
  }
}
