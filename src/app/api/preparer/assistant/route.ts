import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAutoSellPrice } from "@/lib/auto-pricing";

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
        status: { in: ["draft", "pending", "priced"] },
      },
      include: {
        customerRegion: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 2. جلب الطلبات الفعلية المسندة للمجهز
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { submittedByCompanyPreparerId: preparerId },
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
        shop: { select: { name: true } },
        customerRegion: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const formattedOrders: any[] = [];

    // تنسيق المسودات
    for (const d of drafts) {
      const data = (d.data as any) || {};
      const allProds = Array.isArray(data.products) ? data.products : [];

      // تصفية المنتجات المسندة لهذا المجهز أو غير المحددة
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
        orderTime: d.orderTime || "فوري",
        shopName: d.titleLine?.split(" - ")[0] || "مسودة تجهيز",
        status: d.status,
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
        orderTime: o.orderNoteTime || "فوري",
        shopName: o.shop?.name || "طلب توصيل",
        status: o.status,
        products: myProds,
        totalProductsCount: allProds.length,
        myProductsCount: myProds.length,
      });
    }

    return NextResponse.json({
      success: true,
      preparer: { id: preparer.id, name: preparer.name },
      orders: formattedOrders,
    });
  } catch (err: any) {
    console.error("Error in GET /api/preparer/assistant:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ غير متوقع" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      preparerId,
      orderId,
      isDraft,
      originalIndex,
      buyAlf,
      actualBuyAlf,
    } = body;

    if (!preparerId || !orderId || originalIndex == null || buyAlf == null || buyAlf === "") {
      return NextResponse.json({ error: "بيانات التسعير ناقصة" }, { status: 400 });
    }

    const preparer = await prisma.companyPreparer.findUnique({
      where: { id: preparerId },
      select: { id: true, name: true, active: true },
    });

    if (!preparer || !preparer.active) {
      return NextResponse.json({ error: "المجهز غير مصرح له" }, { status: 403 });
    }

    const buyNum = parseFloat(String(buyAlf).replace(/,/g, ".").trim());
    if (!Number.isFinite(buyNum) || buyNum < 0) {
      return NextResponse.json({ error: "سعر الشراء غير صالح" }, { status: 400 });
    }

    const actualBuyTrimmed = actualBuyAlf != null && String(actualBuyAlf).trim() !== "" ? String(actualBuyAlf).replace(/,/g, ".").trim() : null;
    const actualBuyNum = actualBuyTrimmed != null && Number.isFinite(parseFloat(actualBuyTrimmed)) ? parseFloat(actualBuyTrimmed) : null;

    if (isDraft) {
      const draft = await prisma.companyPreparerShoppingDraft.findUnique({
        where: { id: orderId },
      });
      if (!draft) return NextResponse.json({ error: "المسودة غير موجودة" }, { status: 404 });

      const draftData = (draft.data as any) || {};
      const products = Array.isArray(draftData.products) ? [...draftData.products] : [];

      if (!products[originalIndex]) {
        return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
      }

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
        data: {
          data: {
            ...draftData,
            products,
          },
        },
      });

      return NextResponse.json({
        success: true,
        buyAlf: buyNum,
        actualBuyAlf: actualBuyNum,
        sellAlf: sellNum,
      });
    } else {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });
      if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

      const json = (order.preparerShoppingJson as any) || {};
      const products = Array.isArray(json.products) ? [...json.products] : [];

      if (!products[originalIndex]) {
        return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
      }

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
        data: {
          preparerShoppingJson: {
            ...json,
            products,
          },
        },
      });

      return NextResponse.json({
        success: true,
        buyAlf: buyNum,
        actualBuyAlf: actualBuyNum,
        sellAlf: sellNum,
      });
    }
  } catch (err: any) {
    console.error("Error in POST /api/preparer/assistant:", err);
    return NextResponse.json({ error: err.message || "حدث خطأ أثناء الحفظ" }, { status: 500 });
  }
}
