import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const phone = String(url.searchParams.get("phone") ?? "").trim();
  const customerId = String(url.searchParams.get("customerId") ?? "").trim();
  const year = String(url.searchParams.get("year") ?? "").trim();
  const month = url.searchParams.get("month");

  if (!phone && !customerId) {
    return NextResponse.json({ error: "phone or customerId required" }, { status: 400 });
  }

  // تحديد نطاق التاريخ
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  if (year && /^\d{4}$/.test(year)) {
    const yr = parseInt(year, 10);
    const mo = month !== null && month !== "" ? parseInt(month, 10) : null;

    if (mo !== null && mo >= 0 && mo <= 11) {
      // نطاق شهري
      startDate = new Date(Date.UTC(yr, mo, 1, 0, 0, 0, 0));
      startDate = new Date(startDate.getTime() - 3 * 60 * 60 * 1000);
      endDate = new Date(Date.UTC(yr, mo + 1, 0, 23, 59, 59, 999));
      endDate = new Date(endDate.getTime() - 3 * 60 * 60 * 1000);
    } else {
      // نطاق سنوي
      startDate = new Date(Date.UTC(yr - 1, 11, 31, 21, 0, 0, 0));
      endDate = new Date(Date.UTC(yr, 11, 31, 20, 59, 59, 999));
    }
  }

  const where: Record<string, unknown> = {};
  if (customerId) {
    where.customerId = customerId;
  } else {
    where.customerPhone = phone;
  }
  if (startDate && endDate) {
    where.createdAt = { gte: startDate, lte: endDate };
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      orderType: true,
      orderSubtotal: true,
      deliveryPrice: true,
      totalAmount: true,
      summary: true,
      customerLandmark: true,
      customerLocationUrl: true,
      customerPhone: true,
      shop: { select: { name: true, phone: true } },
      customerRegion: { select: { name: true } },
      courier: { select: { name: true } },
      submittedBy: { select: { name: true } },
    },
  });

  const filteredOrders = orders.filter((order) => {
    const customerPhone = order.customerPhone ?? "";
    const shopPhone = order.shop?.phone ?? "";
    if (!customerPhone || !shopPhone) return true;

    const a = normalizeIraqMobileLocal11(customerPhone);
    const b = normalizeIraqMobileLocal11(shopPhone);
    if (a && b) return a !== b;

    return customerPhone.replace(/\D/g, "") !== shopPhone.replace(/\D/g, "");
  });

  return NextResponse.json({ orders: filteredOrders });
}
