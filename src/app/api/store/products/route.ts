import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const ids = searchParams.get("ids");

  // السماح بجلب المنتجات إما حسب الفرع أو حسب مصفوفة معرفات (للمفضلة)
  if (!branchId && !ids) {
    return NextResponse.json({ error: "Missing branchId or ids" }, { status: 400 });
  }

  try {
    const where: any = { active: true };

    if (branchId) {
      where.branchId = branchId;
    }

    if (ids) {
      const idArray = ids.split(",").map(id => id.trim()).filter(id => id !== "");
      if (idArray.length > 0) {
        where.id = { in: idArray };
      } else if (!branchId) {
        return NextResponse.json([]);
      }
    }

    const products = await prisma.storeProduct.findMany({
      where,
      select: {
        id: true,
        name: true,
        salePrice: true,
        description: true,
        photoUrls: true,
        hasVariants: true,
        variants: {
          select: {
            id: true,
            name: true,
            salePrice: true
          }
        }
      },
      take: ids ? undefined : 100, // زيادة العدد لضمان ظهور كافة المنتجات
      orderBy: { sequence: "desc" },
    });

    const formattedProducts = products.map(p => ({
      ...p,
      salePrice: Number(p.salePrice),
      photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
      variants: p.variants?.map(v => ({ ...v, salePrice: Number(v.salePrice) }))
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error("API Store Products Error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
