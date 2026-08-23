import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const portalToken = searchParams.get("token") || searchParams.get("se");

    // تحقق اختياري من توكن الموظف إذا لزم الأمر
    let staffEmployee = null;
    if (portalToken) {
      staffEmployee = await prisma.staffEmployee.findFirst({
        where: { OR: [{ id: portalToken }, { portalToken: portalToken }] }
      });
    }

    const categories = await prisma.marketplaceCategory.findMany({
      orderBy: { sortOrder: "asc" }
    });

    const items = await prisma.marketplaceItem.findMany({
      include: {
        category: true,
        inquiries: {
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // حساب إحصائيات كود الموظف والموقع
    let totalViews = 0;
    let totalInquiries = 0;
    items.forEach((item) => {
      totalViews += item.viewsCount;
      totalInquiries += item.inquiriesCount;
    });

    const inquiries = await prisma.marketplaceInquiry.findMany({
      include: {
        item: {
          include: { category: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      success: true,
      staffEmployee: staffEmployee ? { id: staffEmployee.id, name: staffEmployee.name } : null,
      stats: {
        totalItems: items.length,
        totalViews,
        totalInquiries,
        totalCategories: categories.length
      },
      categories,
      items,
      inquiries
    });
  } catch (error: any) {
    console.error("Staff Marketplace GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // إضافة أو تحديث قسم (اسم، صورة، تسلسل)
    if (action === "create_category" || action === "update_category") {
      const { id, name, imageUrl, sortOrder } = body;
      if (!name) {
        return NextResponse.json({ success: false, error: "يرجى تحديد اسم القسم" }, { status: 400 });
      }

      const parsedOrder = parseInt(sortOrder) || 0;

      let category;
      if (id) {
        category = await prisma.marketplaceCategory.update({
          where: { id },
          data: {
            name: name.trim(),
            imageUrl: imageUrl || "",
            sortOrder: parsedOrder
          }
        });
      } else {
        category = await prisma.marketplaceCategory.upsert({
          where: { name: name.trim() },
          update: {
            imageUrl: imageUrl || "",
            sortOrder: parsedOrder
          },
          create: {
            name: name.trim(),
            imageUrl: imageUrl || "",
            sortOrder: parsedOrder
          }
        });
      }

      return NextResponse.json({ success: true, category });
    }

    // حذف قسم
    if (action === "delete_category") {
      const { categoryId } = body;
      if (!categoryId) {
        return NextResponse.json({ success: false, error: "معرف القسم مطلوب" }, { status: 400 });
      }
      await prisma.marketplaceCategory.delete({ where: { id: categoryId } });
      return NextResponse.json({ success: true });
    }


    // إضافة أو نشر سلعة جديدة
    if (action === "create_item") {
      const {
        title,
        categoryId,
        categoryName,
        imageUrl,
        location,
        price,
        sellerPhone,
        sellerName,
        staffEmployeeId
      } = body;

      if (!title || (!categoryId && !categoryName) || !sellerPhone) {
        return NextResponse.json(
          { success: false, error: "يرجى إكمال الحقول الأساسية: عنوان السلعة، القسم، ورقم البائع" },
          { status: 400 }
        );
      }

      let finalCategoryId = categoryId;
      if (!finalCategoryId && categoryName) {
        const cat = await prisma.marketplaceCategory.upsert({
          where: { name: categoryName.trim() },
          update: {},
          create: { name: categoryName.trim() }
        });
        finalCategoryId = cat.id;
      }

      const item = await prisma.marketplaceItem.create({
        data: {
          title: title.trim(),
          categoryId: finalCategoryId,
          imageUrl: imageUrl || "",
          location: location || "",
          price: price || "",
          sellerPhone: sellerPhone.trim(),
          sellerName: sellerName || "",
          staffEmployeeId: staffEmployeeId || null
        },
        include: { category: true }
      });

      return NextResponse.json({ success: true, item });
    }

    // تحديث حالة التبليغ للبائع
    if (action === "notify_seller") {
      const { inquiryId } = body;
      if (!inquiryId) {
        return NextResponse.json({ success: false, error: "معرف الطلب مطلوب" }, { status: 400 });
      }

      const inquiry = await prisma.marketplaceInquiry.update({
        where: { id: inquiryId },
        data: { notifiedSeller: true },
        include: { item: true }
      });

      // تجهيز نص رسالة التبليغ للواتساب
      const waText = `مرحبا\nدخل الك (${inquiry.buyerName}) [${inquiry.buyerPhone}]\nعلمود السلعة (${inquiry.item.title})\nاشتراها لو لا؟`;

      let cleanPhone = inquiry.item.sellerPhone.replace(/[^0-9]/g, "");
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "964" + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith("964")) {
        cleanPhone = "964" + cleanPhone;
      }

      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`;

      return NextResponse.json({ success: true, inquiry, whatsappUrl });
    }

    // تأشير السلعة كمبيوعة أو إعادتها كـ متاح
    if (action === "toggle_sold") {
      const { itemId, isSold } = body;
      if (!itemId) {
        return NextResponse.json({ success: false, error: "معرف السلعة مطلوب" }, { status: 400 });
      }

      const item = await prisma.marketplaceItem.update({
        where: { id: itemId },
        data: { isSold: isSold !== undefined ? Boolean(isSold) : true }
      });

      return NextResponse.json({ success: true, item });
    }

    // حذف سلعة
    if (action === "delete_item") {
      const { itemId } = body;
      await prisma.marketplaceItem.delete({ where: { id: itemId } });
      return NextResponse.json({ success: true });
    }


    return NextResponse.json({ success: false, error: "إجراء غير معروف" }, { status: 400 });
  } catch (error: any) {
    console.error("Staff Marketplace POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
