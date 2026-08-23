import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, categoryId, categoryName, staffToken } = body;

    if (!text || text.trim() === "") {
      return NextResponse.json({ success: false, error: "النص الممرر فارغ" }, { status: 400 });
    }

    const rawText = text.trim();
    const lines = rawText.split("\n").map((l: string) => l.trim()).filter(Boolean);

    // استخراج رقم الهاتف البائع باستخدام التعبير النمطي (Regex)
    let sellerPhone = "";
    const phoneMatch = rawText.match(/(07[3-9]\d{8}|9647[3-9]\d{8}|\+9647[3-9]\d{8})/);
    if (phoneMatch) {
      sellerPhone = phoneMatch[0];
    }

    // استخراج السعر إن وجد
    let price = "";
    const priceMatch = rawText.match(/(\d+[\d,]*\s*(ألف|الف|دينار|\$|الاف|آلاف)?)/);
    if (priceMatch) {
      price = priceMatch[0];
    }

    // عنوان السلعة (السطر الأول أو الكلمات الأولى)
    let title = lines.length > 0 ? lines[0] : "سلعة للبيع";
    if (sellerPhone && title.includes(sellerPhone)) {
      title = title.replace(sellerPhone, "").trim();
    }

    // المحلة / المكان
    let location = "";
    for (const line of lines) {
      if (line.includes("محلة") || line.includes("حي") || line.includes("شارع") || line.includes("منطقة")) {
        location = line;
        break;
      }
    }

    // تحديد أو إنشاء القسم
    let finalCategoryId = categoryId;
    if (!finalCategoryId && categoryName) {
      const cat = await prisma.marketplaceCategory.upsert({
        where: { name: categoryName.trim() },
        update: {},
        create: { name: categoryName.trim() }
      });
      finalCategoryId = cat.id;
    }

    if (!finalCategoryId) {
      // إذا لم يحدد قسم، نستخدم قسم عام "أخرى"
      const defaultCat = await prisma.marketplaceCategory.upsert({
        where: { name: "عام" },
        update: {},
        create: { name: "عام" }
      });
      finalCategoryId = defaultCat.id;
    }

    // إنشاء المنشور في المعرض
    const item = await prisma.marketplaceItem.create({
      data: {
        title: title || "سلعة مستعملة",
        categoryId: finalCategoryId,
        location: location || "غير محدد",
        price: price || "حسب الاتفاق",
        sellerPhone: sellerPhone || "غير محدد",
        sellerName: "مجهز عبر الموظف"
      },
      include: { category: true }
    });

    return NextResponse.json({
      success: true,
      message: "تم رفع البيعة ونشرها بنجاح!",
      item
    });
  } catch (error: any) {
    console.error("Quick Sell error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
