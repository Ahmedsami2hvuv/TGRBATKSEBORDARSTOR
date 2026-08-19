import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorized = await isAdminSession();
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // نجلب طلبات المتجر (المسودات) غير المسندة والتي حالتها مسودة
    const drafts = await prisma.companyPreparerShoppingDraft.findMany({
      where: {
        status: "draft",
        preparerId: null,
        OR: [
          { titleLine: { contains: "المتجر الالكتروني" } },
          { titleLine: { contains: "السلة المشتركة" } }
        ]
      },
      include: {
        customerRegion: { select: { name: true } }
      },
      orderBy: { createdAt: "asc" } // أقدم طلب أولاً
    });

    const activePreparers = await prisma.companyPreparer.findMany({
      where: { active: true },
      select: { id: true, name: true }
    });

    // تحويل البيانات لشكل مناسب
    const pendingStoreOrders = drafts.map(d => {
      const data = d.data as any || {};
      const products = Array.isArray(data.products) ? data.products : [];
      return {
        id: d.id,
        orderNumber: d.draftNumber,
        title: d.titleLine,
        customerPhone: d.customerPhone,
        regionName: d.customerRegion?.name || "غير محدد",
        landmark: d.customerLandmark || "",
        productsCount: products.length,
        createdAt: d.createdAt
      };
    });

    return NextResponse.json({
      ok: true,
      pendingStoreOrders,
      preparers: activePreparers
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
