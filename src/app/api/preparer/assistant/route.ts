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

    // 1. جلب المحلات المسندة للمجهز
    const prepShopLinks = await prisma.preparerShop.findMany({
      where: { preparerId },
      select: { shopId: true },
    });
    const shopIds = prepShopLinks.map((l) => l.shopId);

    // 2. جلب المسودات التابعة للمجهز أو لمحلاته
    const drafts = await prisma.companyPreparerShoppingDraft.findMany({
      where: {
        OR: [
          { preparerId },
          ...(shopIds.length > 0
            ? [{ customerPhone: { not: "" } }]
            : []),
        ],
        status: { in: [PreparerShoppingDraftStatus.draft, PreparerShoppingDraftStatus.priced] },
      },
      include: {
        customerRegion: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // 3. جلب الطلبات الفعلية
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { submittedByCompanyPreparerId: preparerId },
          ...(shopIds.length > 0 ? [{ shopId: { in: shopIds } }] : []),
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
      take: 50,
    });

    // 4. جلب المناديب المتاحين للإسناد
    const couriers = await prisma.courier.findMany({
      where: courierAssignableWhere,
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    });

    // 5. جلب جميع المحلات النشطة لتسهيل البحث والإسناد
    const shops = await prisma.shop.findMany({
      select: { id: true, name: true, regionId: true },
      orderBy: { name: "asc" },
      take: 250,
    });

    // 6. جلب المناطق
    const regions = await prisma.region.findMany({
      select: { id: true, name: true, deliveryPrice: true },
      orderBy: { name: "asc" },
    });

    // دالة مساعدة متقدمة لاستخراج المواد مهما كان هيكلها أو تسمية حقولها
    function parseProductList(payload: any, fallbackStr: string, isOwner: boolean) {
      let rawList: any[] = [];
      if (Array.isArray(payload)) {
        rawList = payload;
      } else if (payload && typeof payload === "object") {
        if (Array.isArray(payload.products)) rawList = payload.products;
        else if (Array.isArray(payload.webStoreCart)) rawList = payload.webStoreCart;
        else if (Array.isArray(payload.items)) rawList = payload.items;
      } else if (typeof payload === "string") {
        try {
          const parsed = JSON.parse(payload);
          if (Array.isArray(parsed)) rawList = parsed;
          else if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.products)) rawList = parsed.products;
            else if (Array.isArray(parsed.webStoreCart)) rawList = parsed.webStoreCart;
          }
        } catch (e) {}
      }

      if (rawList.length === 0 && fallbackStr) {
        const lines = fallbackStr
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length > 0) {
          rawList = lines.map((line) => ({ line }));
        }
      }

      const all = rawList.map((p: any, idx: number) => {
        let lineName = "";
        if (typeof p === "string") {
          lineName = p.trim();
        } else if (p && typeof p === "object") {
          lineName = String(p.line || p.name || p.title || p.productName || p.label || "").trim();
          const quantity = p.quantity ?? p.qty ?? null;
          if (quantity && Number(quantity) > 1 && !lineName.includes("x") && !lineName.includes("×")) {
            lineName = `${lineName} ×${quantity}`;
          }
        }
        if (!lineName) {
          lineName = `مادة #${idx + 1}`;
        }

        const itemPrepId = p?.assignedPreparerId || p?.pricedById || p?.supplierId || null;
        const itemPrepName = p?.assignedPreparerName || p?.pricedBy || p?.supplierName || null;

        const buy = p?.buyAlf != null && p?.buyAlf !== ""
          ? p.buyAlf
          : (p?.buyPrice != null && p?.buyPrice !== "" ? Number(p.buyPrice) / 1000 : "");

        const actualBuy = p?.actualBuyAlf != null && p?.actualBuyAlf !== ""
          ? p.actualBuyAlf
          : (p?.actualBuyPrice != null && p?.actualBuyPrice !== "" ? Number(p.actualBuyPrice) / 1000 : "");

        const sell = p?.sellAlf != null && p?.sellAlf !== ""
          ? p.sellAlf
          : (p?.salePrice != null && p?.salePrice !== ""
              ? Number(p.salePrice) / 1000
              : (p?.sellPrice != null && p?.sellPrice !== "" ? Number(p.sellPrice) / 1000 : ""));

        return {
          originalIndex: idx,
          line: lineName,
          buyAlf: buy,
          actualBuyAlf: actualBuy,
          sellAlf: sell,
          assignedPreparerId: itemPrepId ? String(itemPrepId).trim() : null,
          assignedPreparerName: itemPrepName ? String(itemPrepName).trim() : null,
          isPriced: Boolean(buy != null && buy !== "" && Number(buy) >= 0),
        };
      });

      // إظهار المواد للمجهز
      const my = all.filter((p) => {
        if (!p.assignedPreparerId || p.assignedPreparerId === "all" || p.assignedPreparerId === "") return true;
        if (p.assignedPreparerId === preparerId) return true;
        return isOwner;
      });

      return { all, my };
    }

    const formattedOrders: any[] = [];

    // تنسيق المسودات
    for (const d of drafts) {
      const isOwner = Boolean(d.preparerId === preparerId);
      const data = (d.data as any) || {};
      const fallback = d.rawListText?.trim() || d.titleLine?.trim() || "مادة المسودة";
      const { all: allProds, my: myProds } = parseProductList(data, fallback, isOwner);

      if (myProds.length > 0 || isOwner) {
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
          products: myProds.length > 0 ? myProds : allProds,
          totalProductsCount: allProds.length,
          myProductsCount: myProds.length > 0 ? myProds.length : allProds.length,
        });
      }
    }

    // تنسيق الطلبات
    for (const o of orders) {
      const isOwner = Boolean(o.submittedByCompanyPreparerId === preparerId || (o.shopId && shopIds.includes(o.shopId)));
      const fallback = o.summary?.trim() || `طلب #${o.orderNumber} - ${o.orderType || "تجهيز"}`;
      const { all: allProds, my: myProds } = parseProductList(o.preparerShoppingJson, fallback, isOwner);

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
        products: myProds.length > 0 ? myProds : allProds,
        totalProductsCount: allProds.length,
        myProductsCount: myProds.length > 0 ? myProds.length : allProds.length,
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
        let products = Array.isArray(draftData.products) ? [...draftData.products] : [];
        if (products.length === 0 && (draft.rawListText || draft.titleLine)) {
          const fallback = draft.rawListText?.trim() || draft.titleLine?.trim() || "مادة المسودة";
          products = fallback.split("\n").map((l: string) => ({ line: l.trim() }));
        }

        if (!products[originalIndex]) {
          products[originalIndex] = { line: `مادة #${originalIndex + 1}` };
        }

        const target = products[originalIndex];
        const lineText = target.line || target.name || target.title || `مادة #${originalIndex + 1}`;
        const noProfit = Boolean(draftData.noProfit);
        const sellNum = calculateAutoSellPrice(lineText, buyNum, noProfit);

        products[originalIndex] = {
          ...target,
          line: lineText,
          buyAlf: buyNum,
          actualBuyAlf: actualBuyNum,
          sellAlf: sellNum,
          pricedBy: preparer.name,
          pricedById: preparer.id,
          assignedPreparerId: preparer.id,
          assignedPreparerName: preparer.name,
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
        let products = Array.isArray(json.products)
          ? [...json.products]
          : (Array.isArray(json.webStoreCart) ? [...json.webStoreCart] : []);

        if (products.length === 0 && order.summary) {
          const fallback = order.summary.trim();
          products = fallback.split("\n").map((l: string) => ({ line: l.trim() }));
        }

        if (!products[originalIndex]) {
          products[originalIndex] = { line: `مادة #${originalIndex + 1}` };
        }

        const target = products[originalIndex];
        const lineText = target.line || target.name || target.title || `مادة #${originalIndex + 1}`;
        const noProfit = Boolean(json.noProfit);
        const sellNum = calculateAutoSellPrice(lineText, buyNum, noProfit);

        products[originalIndex] = {
          ...target,
          line: lineText,
          buyAlf: buyNum,
          actualBuyAlf: actualBuyNum,
          sellAlf: sellNum,
          pricedBy: preparer.name,
          pricedById: preparer.id,
          assignedPreparerId: preparer.id,
          assignedPreparerName: preparer.name,
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

