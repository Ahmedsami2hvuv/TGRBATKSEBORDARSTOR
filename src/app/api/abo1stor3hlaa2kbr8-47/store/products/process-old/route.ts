import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveStoreProductImageUploaded } from "@/lib/order-image";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "list-ids") {
        try {
            const products = await prisma.storeProduct.findMany({
                where: { active: true },
                select: { id: true }
            });
            return NextResponse.json({ ids: products.map(p => p.id) });
        } catch (e: any) {
            return NextResponse.json({ error: e.message }, { status: 500 });
        }
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
    try {
        const { productIds } = await req.json();

        if (!productIds || !Array.isArray(productIds)) {
            return NextResponse.json({ error: "No product IDs provided" }, { status: 400 });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const id of productIds) {
            try {
                // إضافة تأخير بسيط لتجنب الضغط العالي على المعالج (CPU)
                await new Promise(r => setTimeout(r, 100));

                const product = await prisma.storeProduct.findUnique({ where: { id } });
                if (!product || !product.photoUrls || product.photoUrls.length === 0) continue;

                const newPhotoUrls: string[] = [];

                for (const oldUrl of product.photoUrls) {
                    // إذا كانت الصورة بصيغة Base64، نحولها لـ File ونعيد معالجتها
                    if (oldUrl.startsWith("data:image")) {
                        const res = await fetch(oldUrl);
                        const blob = await res.blob();
                        const file = new File([blob], "reprocess.jpg", { type: "image/jpeg" });

                        // إضافة "bg_bypass" في الاسم لضمان عدم حدوث تكرار لا نهائي إذا قمت بتعديل الوظيفة لاحقاً
                        // لكن حالياً saveStoreProductImageUploaded ستطبق الذكاء الاصطناعي
                        const processedUrl = await saveStoreProductImageUploaded(file, 20 * 1024 * 1024);
                        newPhotoUrls.push(processedUrl);
                    } else {
                        // إذا كان رابط خارجي، نحمله ونعالجه
                        const res = await fetch(oldUrl);
                        if (res.ok) {
                            const blob = await res.blob();
                            const file = new File([blob], "reprocess.jpg", { type: "image/jpeg" });
                            const processedUrl = await saveStoreProductImageUploaded(file, 20 * 1024 * 1024);
                            newPhotoUrls.push(processedUrl);
                        } else {
                            newPhotoUrls.push(oldUrl); // فشل التحميل، نتركها كما هي
                        }
                    }
                }

                await prisma.storeProduct.update({
                    where: { id },
                    data: { photoUrls: newPhotoUrls }
                });
                results.success++;
            } catch (err: any) {
                results.failed++;
                results.errors.push(`Product ${id}: ${err.message}`);
            }
        }

        return NextResponse.json(results);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
