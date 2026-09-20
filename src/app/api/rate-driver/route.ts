import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// دالة لضمان وجود جدول DriverRating إن لم يكن موجوداً
async function ensureDriverRatingTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DriverRating" (
        "id" TEXT PRIMARY KEY,
        "orderId" TEXT,
        "orderNumber" INTEGER,
        "customerPhone" TEXT NOT NULL DEFAULT '',
        "customerRegion" TEXT NOT NULL DEFAULT '',
        "customerLandmark" TEXT NOT NULL DEFAULT '',
        "shopName" TEXT NOT NULL DEFAULT '',
        "courierId" TEXT,
        "courierName" TEXT NOT NULL DEFAULT '',
        "mannerRating" INTEGER NOT NULL DEFAULT 5,
        "mannerReason" TEXT,
        "speedRating" INTEGER NOT NULL DEFAULT 5,
        "speedReason" TEXT,
        "overallRating" INTEGER NOT NULL DEFAULT 5,
        "overallReason" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "DriverRating_orderId_idx" ON "DriverRating"("orderId");
      CREATE INDEX IF NOT EXISTS "DriverRating_courierId_idx" ON "DriverRating"("courierId");
      CREATE INDEX IF NOT EXISTS "DriverRating_customerPhone_idx" ON "DriverRating"("customerPhone");
      CREATE INDEX IF NOT EXISTS "DriverRating_createdAt_idx" ON "DriverRating"("createdAt");
    `);
  } catch (err) {
    console.error("ensureDriverRatingTable error:", err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderParam = searchParams.get("order") || searchParams.get("o") || "";

    if (!orderParam) {
      return NextResponse.json(
        { success: false, error: "معرّف الطلب غير موجود" },
        { status: 400 }
      );
    }

    const orderNum = parseInt(orderParam, 10);
    const isNum = !isNaN(orderNum) && String(orderNum) === orderParam.trim();

    // البحث عن الطلب إما بالمعرّف أو برقم الطلب
    const order = await prisma.order.findFirst({
      where: isNum
        ? { OR: [{ id: orderParam }, { orderNumber: orderNum }] }
        : { id: orderParam },
      select: {
        id: true,
        orderNumber: true,
        customerPhone: true,
        customerLandmark: true,
        customerRegion: {
          select: { name: true },
        },
        shop: {
          select: { id: true, name: true, phone: true },
        },
        courier: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "لم يتم العثور على بيانات الطلب المطلوب" },
        { status: 404 }
      );
    }

    // التحقق هل تم التقييم مسبقاً لهذا الطلب
    await ensureDriverRatingTable();
    let existingRating: any = null;
    try {
      existingRating = await (prisma as any).driverRating.findFirst({
        where: {
          OR: [
            { orderId: order.id },
            { orderNumber: order.orderNumber },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      // تجاهل الخطأ في حال لم تُنشأ بعد
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerPhone: order.customerPhone,
        customerRegion: order.customerRegion?.name || "منطقتكم الكريمة",
        customerLandmark: order.customerLandmark || "",
        shopName: order.shop?.name || "المتجر",
        courierId: order.courier?.id || null,
        courierName: order.courier?.name || "مندوب التوصيل",
      },
      alreadyRated: Boolean(existingRating),
      existingRating: existingRating || null,
    });
  } catch (error: any) {
    console.error("GET /api/rate-driver error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "حدث خطأ أثناء تحميل بيانات الطلب" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDriverRatingTable();
    const body = await req.json();

    const {
      orderId,
      orderNumber,
      customerPhone,
      customerRegion,
      customerLandmark,
      shopName,
      courierId,
      courierName,
      mannerRating,
      mannerReason,
      speedRating,
      speedReason,
      overallRating,
      overallReason,
      notes,
    } = body;

    if (!orderId && !orderNumber && !customerPhone) {
      return NextResponse.json(
        { success: false, error: "البيانات الأساسية للتقييم غير مكتملة" },
        { status: 400 }
      );
    }

    // حفظ التقييم في قاعدة البيانات
    const ratingRecord = await (prisma as any).driverRating.create({
      data: {
        orderId: orderId || null,
        orderNumber: typeof orderNumber === "number" ? orderNumber : (orderNumber ? parseInt(orderNumber, 10) : null),
        customerPhone: customerPhone || "",
        customerRegion: customerRegion || "",
        customerLandmark: customerLandmark || "",
        shopName: shopName || "",
        courierId: courierId || null,
        courierName: courierName || "",
        mannerRating: typeof mannerRating === "number" ? mannerRating : 5,
        mannerReason: mannerReason || null,
        speedRating: typeof speedRating === "number" ? speedRating : 5,
        speedReason: speedReason || null,
        overallRating: typeof overallRating === "number" ? overallRating : 5,
        overallReason: overallReason || null,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: ratingRecord,
      message: "تم إرسال تقييمك بنجاح! شكراً لك ❤️",
    });
  } catch (error: any) {
    console.error("POST /api/rate-driver error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "حدث خطأ أثناء حفظ التقييم" },
      { status: 500 }
    );
  }
}
