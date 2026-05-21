import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveStoreBranchImageUploaded, saveStoreProductImageUploaded, MAX_ORDER_IMAGE_BYTES } from "@/lib/order-image";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const categoryId = formData.get("categoryId") as string;
    const branchName = formData.get("branchName") as string;
    const removeBg = formData.get("removeBg") === "true";
    const branchPhoto = formData.get("branchPhoto") as File | null;
    const branchRemoteImageUrl = formData.get("branchRemoteImageUrl") as string | null;
    const productsJson = formData.get("products") as string;
    const products = JSON.parse(productsJson || "[]");

    if (!categoryId || !branchName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let branchPhotoUrl = "";

    // 1. التعامل مع صورة الفرع
    if (branchPhoto && branchPhoto.size > 0) {
      branchPhotoUrl = await saveStoreBranchImageUploaded(branchPhoto, MAX_ORDER_IMAGE_BYTES);
    } else if (branchRemoteImageUrl) {
      try {
        const imgRes = await fetch(branchRemoteImageUrl);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const file = new File([buffer], "branch.jpg", { type: imgRes.headers.get("content-type") || "image/jpeg" });
          branchPhotoUrl = await saveStoreBranchImageUploaded(file, MAX_ORDER_IMAGE_BYTES);
        }
      } catch (e) {
        console.error("Failed to fetch remote branch image", e);
      }
    }

    // 2. إنشاء الفرع
    const branch = await prisma.storeBranch.create({
      data: {
        name: branchName,
        categoryId,
        photoUrl: branchPhotoUrl,
        active: true,
        sequence: 0,
      },
    });

    console.log(`Branch created: ${branch.id}, starting products import...`);

    // 3. إنشاء المنتجات بسرعة بدون صور أولاً لضمان استجابة فورية
    // سنقوم بإنشاء كافة المنتجات بنصوصها فقط أولاً
    const productCreationPromises = products.map((p: any) =>
      prisma.storeProduct.create({
        data: {
          name: p.name,
          description: p.description || "",
          purchasePrice: Math.round(p.price || 0),
          salePrice: Math.round(p.price || 0),
          branchId: branch.id,
          photoUrls: [],
          active: true,
          sequence: 0,
        },
      })
    );

    const createdProducts = await Promise.all(productCreationPromises);

    // 4. تشغيل عملية تحميل ومعالجة الصور في الخلفية
    // لا نقوم بعمل await لهذه العملية لكي نرسل الاستجابة للمتصفح فوراً
    // ملاحظة: في بيئات Serverless قد يتم إنهاء العملية، لكن في Node.js العادي ستستمر.
    (async () => {
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const product = createdProducts[i];

        if (p.imageUrl && product) {
          try {
            const imgRes = await fetch(p.imageUrl, {
              signal: AbortSignal.timeout(20000),
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (imgRes.ok) {
              const buffer = await imgRes.arrayBuffer();
              const file = new File([buffer], "product.jpg", {
                type: imgRes.headers.get("content-type") || "image/jpeg"
              });
              const savedUrl = await saveStoreProductImageUploaded(file, MAX_ORDER_IMAGE_BYTES, { removeBg });

              await prisma.storeProduct.update({
                where: { id: product.id },
                data: { photoUrls: [savedUrl] }
              });
              console.log(`Image processed and updated for product: ${product.name}`);
            }
          } catch (e) {
            console.error(`Background image processing failed for ${p.name}:`, e);
          }
        }
      }
      console.log(`Bulk background image processing finished for branch ${branch.id}`);
    })().catch(err => console.error("Critical error in background image processing:", err));

    revalidatePath("/abo1stor3hlaa2kbr8-47/store/branches");
    revalidatePath("/abo1stor3hlaa2kbr8-47/store/products");

    return NextResponse.json({
      ok: true,
      branchId: branch.id,
      productsCount: createdProducts.length,
      message: "Branch and products created. Images are being processed in the background."
    });
  } catch (error: any) {
    console.error("Bulk Import Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
