import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAutoSellPrice } from "@/lib/auto-pricing";
import { PreparerShoppingDraftStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { transferOrderToCourierInternal } from "@/lib/order-assign-courier";
import { buildCustomerInvoiceText } from "@/lib/preparation-invoice";
import { notifyTelegramNewOrder, notifyTelegramNewPreparerShoppingOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";
import { syncPhoneProfileFromOrder } from "@/lib/customer-phone-profile-sync";
import { saveOrderImageUploaded } from "@/lib/order-image";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import { reconcileMoneyEventsOnOrderStatusChange } from "@/lib/order-money-reconcile";

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

    // 1. جلب المسودات المسندة للمجهز
    const drafts = await prisma.companyPreparerShoppingDraft.findMany({
      where: {
        preparerId,
        status: PreparerShoppingDraftStatus.draft,
      },
      include: {
        customerRegion: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    // 2. جلب الطلبات الفعلية
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
        status: { in: ["pending", "assigned", "processing", "draft", "delivering"] },
      },
      include: {
        shop: { select: { id: true, name: true } },
        customerRegion: { select: { id: true, name: true } },
        courier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    // 3. جلب المناديب المتاحين للإسناد
    const couriers = await prisma.courier.findMany({
      where: courierAssignableWhere,
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    });

    // 4. جلب جميع المحلات النشطة لتسهيل البحث والإسناد
    const shops = await prisma.shop.findMany({
      select: { id: true, name: true, regionId: true },
      orderBy: { name: "asc" },
      take: 200,
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
      let allProds = Array.isArray(data.products) ? data.products : [];

      if (allProds.length === 0) {
        const fallbackText = d.rawListText?.trim() || d.titleLine?.trim() || "مادة المسودة";
        const lines = fallbackText.split("\n").map((l: string) => l.trim()).filter(Boolean);
        allProds = (lines.length > 0 ? lines : [fallbackText]).map((line: string) => ({
          line,
          buyAlf: null,
          actualBuyAlf: null,
          sellAlf: null,
          assignedPreparerId: preparerId,
          assignedPreparerName: preparer.name,
        }));
      }

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
        courier: data.autoCourierName ? { id: data.autoCourierId || "", name: data.autoCourierName, phone: null } : null,
        products: myProds,
        totalProductsCount: allProds.length,
        myProductsCount: myProds.length,
      });
    }

    // تنسيق الطلبات
    for (const o of orders) {
      const json = (o.preparerShoppingJson as any) || {};
      let allProds = Array.isArray(json.products) ? json.products : [];

      if (allProds.length === 0) {
        const fallbackText = o.summary?.trim() || `طلب #${o.orderNumber} - ${o.orderType || "تجهيز"}`;
        const lines = fallbackText.split("\n").map((l: string) => l.trim()).filter(Boolean);
        allProds = (lines.length > 0 ? lines : [fallbackText]).map((line: string, idx: number) => ({
          line,
          buyAlf: o.purchasePrice ? Number(o.purchasePrice) / 1000 : null,
          actualBuyAlf: null,
          sellAlf: idx === 0 && o.orderSubtotal ? Number(o.orderSubtotal) / 1000 : null,
          assignedPreparerId: preparerId,
          assignedPreparerName: preparer.name,
        }));
      }

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

    // 2. إجراء إسناد الطلب لمندوب فوراً
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
        return NextResponse.json({ success: true, message: `تم إسناد الطلب للمندوب: ${courier.name} ✓` });
      }
    }

    // 3. إجراء "أعطيت" (تسليم الطلب للمندوب وتحديث حالته إلى delivering)
    if (action === "action_given") {
      const { orderId, isDraft } = body;
      if (!orderId) return NextResponse.json({ error: "معرف الطلب مطلوب" }, { status: 400 });

      if (isDraft) {
        return NextResponse.json({ success: true, message: "تم تسجيل الإجراء للمسودة بنجاح ✓" });
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

      await prisma.$transaction(async (tx) => {
        await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, order.status as any, "delivering");
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "delivering",
            customerPaymentReceivedAt: new Date(),
          },
        });
      });

      return NextResponse.json({ success: true, message: `تم تسجيل (أعطيت للمندوب) بنجاح ✓` });
    }

    // 4. إجراء "أخذت" (استلام الطلب من المحل أو استلام الحساب)
    if (action === "action_taken") {
      const { orderId, isDraft } = body;
      if (!orderId) return NextResponse.json({ error: "معرف الطلب مطلوب" }, { status: 400 });

      if (isDraft) {
        return NextResponse.json({ success: true, message: "تم تسجيل الاستلام للمسودة بنجاح ✓" });
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

      await prisma.$transaction(async (tx) => {
        const newStatus = order.assignedCourierId ? "assigned" : "processing";
        await reconcileMoneyEventsOnOrderStatusChange(tx, orderId, order.status as any, newStatus as any);
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            shopCostPaidAt: new Date(),
          },
        });
      });

      return NextResponse.json({ success: true, message: `تم تسجيل (أخذت من المحل) بنجاح ✓` });
    }

    // 5. إجراء "رفع طلب جديد مباشر" (create_order)
    if (action === "create_order") {
      const {
        shopId,
        orderType = "عادي",
        customerPhone,
        orderSubtotalAlf,
        orderTime = "فوري",
        regionId,
        deliveryPriceAlf,
        prepaidAll = false,
        isReverseOrder = false,
        imageBase64,
        notes = "",
      } = body;

      if (!shopId) return NextResponse.json({ error: "يرجى اختيار المحل" }, { status: 400 });
      if (!customerPhone || customerPhone.trim().length < 8) {
        return NextResponse.json({ error: "يرجى إدخال رقم هاتف زبون صحيح" }, { status: 400 });
      }
      if (!regionId) return NextResponse.json({ error: "يرجى اختيار المنطقة" }, { status: 400 });

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: { region: true },
      });
      if (!shop) return NextResponse.json({ error: "المحل المحدد غير موجود" }, { status: 404 });

      const region = await prisma.region.findUnique({ where: { id: regionId } });
      if (!region) return NextResponse.json({ error: "المنطقة المحددة غير موجودة" }, { status: 404 });

      // حساب الأسعار
      const subtotalNum = parseFloat(String(orderSubtotalAlf || 0).replace(/,/g, "."));
      const subtotalDinar = new Decimal(isNaN(subtotalNum) ? 0 : subtotalNum).mul(ALF_PER_DINAR);

      let deliveryDinar = Decimal.max(shop.region?.deliveryPrice ?? 0, region.deliveryPrice ?? 0);
      if (deliveryPriceAlf != null && deliveryPriceAlf !== "") {
        const manualDelNum = parseFloat(String(deliveryPriceAlf).replace(/,/g, "."));
        if (!isNaN(manualDelNum) && manualDelNum >= 0) {
          deliveryDinar = new Decimal(manualDelNum).mul(ALF_PER_DINAR);
        }
      }

      const totalDinar = subtotalDinar.plus(deliveryDinar);

      // حفظ الصورة إن وجدت
      let imageUrl: string | null = null;
      if (imageBase64 && typeof imageBase64 === "string" && imageBase64.startsWith("data:image/")) {
        try {
          const parts = imageBase64.split(";base64,");
          const mimeMatch = parts[0].match(/:(.*?)$/);
          const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const buffer = Buffer.from(parts[1], "base64");
          imageUrl = await saveOrderImageUploaded(buffer, { mime });
        } catch (imgErr) {
          console.error("Image upload failed in assistant order:", imgErr);
        }
      }

      // تجهيز سجل الزبون
      let customer = await prisma.customer.findFirst({
        where: { shopId, phone: customerPhone.trim() },
      });

      if (customer) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { customerRegionId: regionId },
        });
      } else {
        customer = await prisma.customer.create({
          data: {
            shopId,
            phone: customerPhone.trim(),
            name: "",
            customerRegionId: regionId,
          },
        });
      }

      const preparerLabel = preparer.name?.trim() ? `المجهز ${preparer.name.trim()}` : "المجهز";
      const summaryText = notes.trim() ? (isReverseOrder ? `[طلب عكسي] ${notes.trim()}` : notes.trim()) : (isReverseOrder ? "[طلب عكسي]" : "");

      const orderProducts = notes.trim()
        ? notes.trim().split("\n").map(l => l.trim()).filter(Boolean).map((line, idx) => ({
            line,
            buyAlf: null,
            actualBuyAlf: null,
            sellAlf: idx === 0 && subtotalNum > 0 ? subtotalNum : null,
            pricedBy: null,
            pricedById: null,
            assignedPreparerId: preparer.id,
            assignedPreparerName: preparer.name,
          }))
        : [
            {
              line: `مادة طلب ${orderType}`,
              buyAlf: null,
              actualBuyAlf: null,
              sellAlf: subtotalNum > 0 ? subtotalNum : null,
              pricedBy: null,
              pricedById: null,
              assignedPreparerId: preparer.id,
              assignedPreparerName: preparer.name,
            }
          ];

      const createdOrder = await prisma.order.create({
        data: {
          shopId,
          customerId: customer.id,
          status: "pending",
          submissionSource: "company_preparer",
          submittedByCompanyPreparerId: preparer.id,
          orderType: isReverseOrder ? `عكسي - ${orderType}` : orderType,
          orderNoteTime: orderTime || "فوري",
          customerPhone: customerPhone.trim(),
          customerRegionId: regionId,
          orderSubtotal: subtotalDinar,
          deliveryPrice: deliveryDinar,
          totalAmount: totalDinar,
          prepaidAll: Boolean(prepaidAll),
          imageUrl,
          orderImageUploadedByName: imageUrl ? preparerLabel : null,
          summary: summaryText,
          preparerShoppingJson: {
            version: 1,
            products: orderProducts,
            placesCount: 1,
            noProfit: false,
          },
        },
      });

      await syncPhoneProfileFromOrder(createdOrder.id).catch(() => {});
      void notifyTelegramNewOrder(createdOrder.id);
      void notifyTelegramNewPreparerShoppingOrder(createdOrder.id);
      await pushNotifyAdminsNewPendingOrder(createdOrder.orderNumber).catch(() => {});

      return NextResponse.json({
        success: true,
        orderNumber: createdOrder.orderNumber,
        message: `تم رفع الطلب بنجاح برقم #${createdOrder.orderNumber} ✓`,
      });
    }

    return NextResponse.json({ error: "الإجراء غير معروف" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in POST /api/preparer/assistant:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ أثناء تنفيذ الإجراء" }, { status: 500 });
  }
}

