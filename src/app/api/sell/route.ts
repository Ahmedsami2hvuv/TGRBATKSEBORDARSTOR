import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const itemId = searchParams.get("itemId");
    const search = searchParams.get("search")?.trim() || "";

    if (itemId) {
      const item = await prisma.marketplaceItem.update({
        where: { id: itemId },
        data: { viewsCount: { increment: 1 } },
        include: { category: true, staffEmployee: true }
      });
      return NextResponse.json({ success: true, item });
    }

    const categories = await prisma.marketplaceCategory.findMany({
      orderBy: { sortOrder: "asc" }
    });

    const whereCondition: any = { isActive: true };
    if (categoryId) {
      whereCondition.categoryId = categoryId;
    }
    if (search) {
      whereCondition.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { price: { contains: search, mode: "insensitive" } }
      ];
    }

    const items = await prisma.marketplaceItem.findMany({
      where: whereCondition,
      include: { category: true, staffEmployee: true },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      success: true,
      categories,
      items
    });
  } catch (error: any) {
    console.error("Sell GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, buyerName, buyerPhone, buyerAddress } = body;

    if (!itemId || !buyerName || !buyerPhone) {
      return NextResponse.json(
        { success: false, error: "الرجاء إدخال اسمك ورقم هاتفك" },
        { status: 400 }
      );
    }

    const item = await prisma.marketplaceItem.findUnique({
      where: { id: itemId },
      include: { category: true, staffEmployee: true }
    });

    if (!item) {
      return NextResponse.json({ success: false, error: "السلعة غير موجودة" }, { status: 404 });
    }

    const inquiry = await prisma.marketplaceInquiry.create({
      data: {
        itemId,
        buyerName,
        buyerPhone,
        buyerAddress: buyerAddress || ""
      }
    });

    await prisma.marketplaceItem.update({
      where: { id: itemId },
      data: { inquiriesCount: { increment: 1 } }
    });

    // استخراج اسم الموظف الناشر
    const publisherName = item.staffEmployee?.name || item.staffEmployeeName || item.sellerName || "";
    const publisherSuffix = publisherName ? ` ${publisherName}` : "";

    // صياغة رسالة الواتساب التلقائية بالشكل والتنسيق المطلوب بالضبط
    const waText = `السلام عليكم\nاني ${buyerName}\nدخلت الك من الموقع مال ابو الاكبر\nاجيتك ع السلعه (${item.title}) الي ناشرها${publisherSuffix}\nالي سعرها: ${item.price || "غير محدد"}`;
    
    let cleanPhone = item.sellerPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "964" + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith("964")) {
      cleanPhone = "964" + cleanPhone;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`;

    return NextResponse.json({
      success: true,
      inquiryId: inquiry.id,
      whatsappUrl
    });
  } catch (error: any) {
    console.error("Sell POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
