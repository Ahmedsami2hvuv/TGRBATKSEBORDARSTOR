import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveStoreProductImageUploaded, MAX_ORDER_IMAGE_BYTES } from "@/lib/order-image";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const branchId = formData.get("branchId") as string;
    const removeBg = formData.get("removeBg") === "true";
    const productsJson = formData.get("products") as string;
    const products = JSON.parse(productsJson || "[]");

    if (!branchId) {
      return NextResponse.json({ error: "Missing branchId" }, { status: 400 });
    }

    // 1. إنشاء المنتجات بسرعة بدون صور أولاً
    const createdProducts = [];
    for (const p of products) {
        const product = await prisma.storeProduct.create({
            data: {
                name: p.name,
                description: p.description || "",
                purchasePrice: (parseFloat(p.purchasePrice) || 0),
                salePrice: (parseFloat(p.salePrice) || 0),
                branchId: branchId,
                photoUrls: [],
                active: true,
                sequence: 0,
            },
        });
        createdProducts.push({ ...p, id: product.id });
    }

    // 2. معالجة الصور في الخلفية
    (async () => {
      for (const p of createdProducts) {
        if (p.imageUrl || p.base64) {
          try {
            let file: File | null = null;

            if (p.base64) {
                const res = await fetch(p.base64);
                const blob = await res.blob();
                file = new File([blob], "product.jpg", { type: "image/jpeg" });
            } else if (p.imageUrl) {
                const imgRes = await fetch(p.imageUrl, {
                    signal: AbortSignal.timeout(20000),
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (imgRes.ok) {
                    const buffer = await imgRes.arrayBuffer();
                    file = new File([buffer], "product.jpg", {
                        type: imgRes.headers.get("content-type") || "image/jpeg"
                    });
                }
            }

            if (file) {
                const savedUrl = await saveStoreProductImageUploaded(file, MAX_ORDER_IMAGE_BYTES, { removeBg });
                await prisma.storeProduct.update({
                    where: { id: p.id },
                    data: { photoUrls: [savedUrl] }
                });
            }
          } catch (e) {
            console.error(`Background image processing failed for ${p.name}:`, e);
          }
        }
      }
    })().catch(err => console.error("Critical error in bulk products background processing:", err));

    revalidatePath("/admin/store/products");

    return NextResponse.json({
      ok: true,
      count: createdProducts.length,
      message: "Products created. Images are being processed in the background."
    });
  } catch (error: any) {
    console.error("Bulk Products Import Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
