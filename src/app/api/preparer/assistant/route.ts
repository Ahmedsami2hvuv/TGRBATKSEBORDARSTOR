import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAutoSellPrice } from "@/lib/auto-pricing";
import { PreparerShoppingDraftStatus } from "@prisma/client";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { transferOrderToCourierInternal } from "@/lib/order-assign-courier";
import { buildCustomerInvoiceText } from "@/lib/preparation-invoice";
import { notifyTelegramNewOrder, notifyTelegramOrderPrepared } from "@/lib/telegram-notify";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const preparerId = searchParams.get("preparerId")?.trim();

    if (!preparerId) {
      return NextResponse.json({ error: "معرف المجهز مطلوب" }, { status: 400 });
    }

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: preparerId },
      select: { id: true, name: true, active: true },
    });

    if (!preparer || !preparer.active) {
      return NextResponse.json({ error: "المجهز غير موجود أو غير نشط" }, { status: 404 });
    }

    // 1. جلب المسودات المسندة للمجهز (حالة draft فقط)
    const drafts = await prisma.companyPreparerShoppingDraft.findMany({
      where: {
        preparerId,
        status: PreparerShoppingDraftStatus.draft,
      },
      include: {
        customerRegion: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    // 2. جلب الطلبات الفعلية المسندة للمجهز أو لمحل مرتبط به
    const prepShopLinks = await prisma.preparerShop.findMany({
      where: { preparerId },
      select: { shopId: true },
    });
    const shopIds = prepShopLinks.map((l) => l.shopId);

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { submittedByCompanyPreparerId: preparerId },
          { shopId: { in: shopIds } },
          {
            preparerShoppingJson: {
              path: ["products"],
              array_contains: [{ assignedPreparerId: preparerId }],
            },
          },
        ],
        status: { in: ["pending", "assigned", "processing", "draft"] },
      },
      include: {
        shop: { select: { id: true, name: true } },
        customerRegion: { select: { id: true, name: true } },
        courier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    // 3. جلب المناديب المتاحين للإسناد
    const couriers = await prisma.courier.findMany({
      where: courierAssignableWhere,
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    });

    // 4. جلب المحلات المرتبطة بالمجهز
    const shops = await prisma.shop.findMany({
      where: {
        id: { in: shopIds },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // 5. جلب المناطق
    const regions = await prisma.region.findMany({
      select: { id: true, name: true, deliveryPrice: true },
      orderBy: { name: "asc" },
    });

    const formattedOrders: any[] = [];

    // تنسيق المسودات
    for (const d of drafts) {
      const data = (d.data as any) || {};
      const allProds = Array.isArray(data.products) ? data.products : [];

      const myProds = allProds
        .map((p: any, idx: number) => ({
          originalIndex: idx,
          line: p.line || "",
          buyAlf: p.buyAlf != null && p.buyAlf !== "" ? p.buyAlf : "",
          actualBuyAlf: p.actualBuyAlf != null && p.actualBuyAlf !== "" ? p.actualBuyAlf : "",
          sellAlf: p.sellAlf != null && p.sellAlf !== "" ? p.sellAlf : "",
          assignedPreparerId: p.assignedPreparerId || null,
          assignedPreparerName: p.assignedPreparerName || null,
          isPriced: Boolean(p.buyAlf != null && p.buyAlf !== "" && Number(p.buyAlf) >= 0),
        }))
        .filter((p: any) => !p.assignedPreparerId || p.assignedPreparerId === preparerId);

      formattedOrders.push({
        id: d.id,
        orderNumber: d.draftNumber || parseInt(d.id.replace(/[^0-9]/g, "").slice(0, 6)) || 1,
        isDraft: true,
        title: d.titleLine || "مسودة طلب",
        regionName: d.customerRegion?.name || "—",
        regionId: d.customerRegionId || null,
        orderTime: d.orderTime || "فوري",
        customerPhone: d.customerPhone || "",
        customerName: d.customerName || "",
        shopName: d.titleLine?.split(" - ")[0] || "مسودة تجهيز",
        status: d.status,
        courier: null,
        products: myProds,
        totalProductsCount: allProds.length,
        myProductsCount: myProds.length,
      });
    }

    // تنسيق الطلبات
    for (const o of orders) {
      const json = (o.preparerShoppingJson as any) || {};
      const allProds = Array.isArray(json.products) ? json.products : [];

      const myProds = allProds
        .map((p: any, idx: number) => ({
          originalIndex: idx,
          line: p.line || "",
          buyAlf: p.buyAlf != null && p.buyAlf !== "" ? p.buyAlf : "",
          actualBuyAlf: p.actualBuyAlf != null && p.actualBuyAlf !== "" ? p.actualBuyAlf : "",
          sellAlf: p.sellAlf != null && p.sellAlf !== "" ? p.sellAlf : "",
          assignedPreparerId: p.assignedPreparerId || null,
          assignedPreparerName: p.assignedPreparerName || null,
          isPriced: Boolean(p.buyAlf != null && p.buyAlf !== "" && Number(p.buyAlf) >= 0),
        }))
        .filter((p: any) => !p.assignedPreparerId || p.assignedPreparerId === preparerId);

      formattedOrders.push({
        id: o.id,
        orderNumber: o.orderNumber,
        isDraft: false,
        title: `طلب #${o.orderNumber}`,
        regionName: o.customerRegion?.name || "—",
        regionId: o.customerRegionId || null,
        orderTime: o.orderNoteTime || "فوري",
        customerPhone: o.customerPhone || "",
        customerName: o.customer?.name || "",
        shopName: o.shop?.name || "طلب توصيل",
        shopId: o.shopId,
        status: o.status,
        courier: o.courier ? { id: o.courier.id, name: o.courier.name, phone: o.courier.phone } : null,
        products: myProds,
        totalProductsCount: allProds.length,
        myProductsCount: myProds.length,
      });
    }

    return NextResponse.json({
      success: true,
      preparer: { id: preparer.id, name: preparer.name },
      orders: formattedOrders,
      couriers,
      shops,
      regions,
    });
  } catch (err: any) {
    console.error("Error in GET /api/preparer/assistant:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ غير متوقع" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "save_price";
    const { preparerId } = body;

    if (!preparerId) {
      return NextResponse.json({ error: "معرف المجهز مطلوب" }, { status: 400 });
    }

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: preparerId },
      select: { id: true, name: true, active: true },
    });

    if (!preparer || !preparer.active) {
      return NextResponse.json({ error: "المجهز غير مصرح له" }, { status: 403 });
    }

    // 1. إجراء حفظ السعر الفوري
    if (action === "save_price") {
      const { orderId, isDraft, originalIndex, buyAlf, actualBuyAlf } = body;

      if (!orderId || originalIndex == null || buyAlf == null || buyAlf === "") {
        return NextResponse.json({ error: "بيانات التسعير ناقصة" }, { status: 400 });
      }

      const buyNum = parseFloat(String(buyAlf).replace(/,/g, ".").trim());
      if (!Number.isFinite(buyNum) || buyNum < 0) {
        return NextResponse.json({ error: "سعر الشراء غير صالح" }, { status: 400 });
      }

      const actualBuyTrimmed = actualBuyAlf != null && String(actualBuyAlf).trim() !== "" ? String(actualBuyAlf).replace(/,/g, ".").trim() : null;
      const actualBuyNum = actualBuyTrimmed != null && Number.isFinite(parseFloat(actualBuyTrimmed)) ? parseFloat(actualBuyTrimmed) : null;

      if (isDraft) {
        const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: orderId } });
        if (!draft) return NextResponse.json({ error: "المسودة غير موجودة" }, { status: 404 });

        const draftData = (draft.data as any) || {};
        const products = Array.isArray(draftData.products) ? [...draftData.products] : [];
        if (!products[originalIndex]) return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });

        const target = products[originalIndex];
        const noProfit = Boolean(draftData.noProfit);
        const sellNum = calculateAutoSellPrice(target.line, buyNum, noProfit);

        products[originalIndex] = {
          ...target,
          buyAlf: buyNum,
          actualBuyAlf: actualBuyNum,
          sellAlf: sellNum,
          pricedBy: preparer.name,
          pricedById: preparer.id,
        };

        await prisma.companyPreparerShoppingDraft.update({
          where: { id: orderId },
          data: { data: { ...draftData, products } },
        });

        return NextResponse.json({
          success: true,
          buyAlf: buyNum,
          actualBuyAlf: actualBuyNum,
          sellAlf: sellNum,
        });
      } else {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

        const json = (order.preparerShoppingJson as any) || {};
        const products = Array.isArray(json.products) ? [...json.products] : [];
        if (!products[originalIndex]) return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });

        const target = products[originalIndex];
        const noProfit = Boolean(json.noProfit);
        const sellNum = calculateAutoSellPrice(target.line, buyNum, noProfit);

        products[originalIndex] = {
          ...target,
          buyAlf: buyNum,
          actualBuyAlf: actualBuyNum,
          sellAlf: sellNum,
          pricedBy: preparer.name,
          pricedById: preparer.id,
        };

        await prisma.order.update({
          where: { id: orderId },
          data: { preparerShoppingJson: { ...json, products } },
        });

        return NextResponse.json({
          success: true,
          buyAlf: buyNum,
          actualBuyAlf: actualBuyNum,
          sellAlf: sellNum,
        });
      }
    }

    // 2. إجراء إسناد الطلب لمندوب
    if (action === "assign_courier") {
      const { orderId, courierId, isDraft } = body;
      if (!orderId || !courierId) {
        return NextResponse.json({ error: "معرف الطلب والمندوب مطلوب" }, { status: 400 });
      }

      const courier = await prisma.courier.findUnique({ where: { id: courierId }, select: { id: true, name: true } });
      if (!courier) return NextResponse.json({ error: "المندوب غير موجود" }, { status: 404 });

      if (isDraft) {
        const draft = await prisma.companyPreparerShoppingDraft.findUnique({ where: { id: orderId } });
        if (!draft) return NextResponse.json({ error: "المسودة غير موجودة" }, { status: 404 });

        const data = (draft.data as any) || {};
        await prisma.companyPreparerShoppingDraft.update({
          where: { id: orderId },
          data: {
            data: {
              ...data,
              autoCourierId: courier.id,
              autoCourierName: courier.name,
            },
          },
        });
        return NextResponse.json({ success: true, message: `تم تعيين المندوب: ${courier.name}` });
      } else {
        await transferOrderToCourierInternal(orderId, courierId);
        return NextResponse.json({ success: true, message: `تم إسناد الطلب للمندوب: ${courier.name}` });
      }
    }

    // 3. إجراء تحديث حالة الطلب السريع (أعطيت للمندوب / استلمت من المحل)
    if (action === "update_order_status") {
      const { orderId, newStatus } = body;
      if (!orderId || !newStatus) {
        return NextResponse.json({ error: "بيانات الحالة ناقصة" }, { status: 400 });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });

      return NextResponse.json({ success: true, message: `تم تحديث حالة الطلب إلى: ${newStatus}` });
    }

    return NextResponse.json({ error: "الإجراء غير معروف" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in POST /api/preparer/assistant:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ أثناء تنفيذ الإجراء" }, { status: 500 });
  }
}
