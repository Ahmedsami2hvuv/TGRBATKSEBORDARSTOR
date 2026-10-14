import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ShopStoreView } from "./shop-store-view";
import { serializePrisma } from "@/lib/serialize-prisma";
import { Metadata } from "next";
import Link from "next/link";
import { ensureShopStoreTablesIfMissing } from "@/lib/db-self-heal-shop-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopId: string }>;
}): Promise<Metadata> {
  const { shopId } = await params;
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, storeBio: true, photoUrl: true },
    });
    if (!shop) return { title: "متجر المحل | وصلي" };
    return {
      title: `متجر ${shop.name} | وصلي`,
      description: shop.storeBio || `تسوق من متجر ${shop.name} مع أسرع توصيل عبر وصلي`,
      openGraph: {
        title: `متجر ${shop.name}`,
        description: shop.storeBio || `تسوق من متجر ${shop.name} عبر منصة وصلي`,
        images: shop.photoUrl ? [{ url: shop.photoUrl }] : [],
      },
    };
  } catch {
    return { title: "متجر المحل | وصلي" };
  }
}

export default async function SingleShopStorePage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;

  const [shopRaw, regionsRaw] = await Promise.all([
    prisma.shop.findFirst({
      where: {
        OR: [{ storeToken: shopId }, { id: shopId }],
      },
      include: { region: true },
    }),
    prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }).catch(() => []),
  ]);

  if (!shopRaw) {
    notFound();
  }

  // إذا لم يكن المتجر مفعلاً من قبل الإدارة
  if (!shopRaw.storeEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner">
            🏪
          </div>
          <h1 className="text-xl font-black text-slate-900">متجر {shopRaw.name}</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            متجر هذا المحل غير متاح للطلب عبر الإنترنت حالياً، أو لم يتم تفعيله بعد من قبل إدارة الموقع.
          </p>
          <div className="pt-2">
            <Link
              href="/store"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md transition"
            >
              الذهاب إلى المتجر الرئيسي ←
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // جلب محتويات متجر المحل
  const [categoriesRaw, branchesRaw, productsRaw, slidesRaw] = await Promise.all([
    prisma.shopStoreCategory.findMany({
      where: { shopId, active: true },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreBranch.findMany({
      where: { shopId, active: true },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreProduct.findMany({
      where: { shopId, active: true },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreSlide.findMany({
      where: { shopId, active: true },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
  ]);

  const shop = serializePrisma(shopRaw);
  const regions = serializePrisma(regionsRaw);
  const categories = serializePrisma(categoriesRaw);
  const branches = serializePrisma(branchesRaw);
  const products = serializePrisma(productsRaw);
  const slides = serializePrisma(slidesRaw);

  return (
    <ShopStoreView
      shop={shop}
      categories={categories}
      branches={branches}
      products={products}
      slides={slides}
      regions={regions}
    />
  );
}
