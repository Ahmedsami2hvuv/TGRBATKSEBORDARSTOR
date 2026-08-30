import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getStoreProductMetadata } from "@/lib/store-meta";
import Link from "next/link";
import { ProductCard } from "../../product-card";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  return getStoreProductMetadata(params.id);
}

function safeJson(data: any) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || typeof value.toNumber === 'function')) {
        return Number(value.toString());
    }
    return value;
  }));
}

export default async function ProductDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const productId = params.id;

  const productRaw = await prisma.storeProduct.findUnique({
    where: { id: productId },
    include: {
      supplier: true,
      branch: {
        include: { category: true }
      },
      variants: {
        where: { active: true },
        orderBy: { sequence: "asc" }
      }
    }
  });

  if (!productRaw) {
    return (
      <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100" dir="rtl">
        <h2 className="text-xl font-bold text-slate-900">المنتج المطلوب غير متوفر حالياً</h2>
        <Link href="/store" className="text-green-600 underline mt-4 block font-bold">العودة للمتجر الرئيسي</Link>
      </div>
    );
  }

  // إذا كان المنتج يتبع قسماً وفرعاً، نوجهه إلى رابط القسم مع فتح المنتج
  const branchId = productRaw.branchId;
  const categoryId = productRaw.branch?.categoryId;

  if (categoryId) {
    redirect(`/store/c/${categoryId}?b=${branchId}&product=${productId}`);
  }

  const product = safeJson(productRaw);

  return (
    <div className="max-w-md mx-auto py-8" dir="rtl">
      <ProductCard product={product} />
    </div>
  );
}
