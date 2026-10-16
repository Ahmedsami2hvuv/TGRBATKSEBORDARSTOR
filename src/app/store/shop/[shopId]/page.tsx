import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ShopStoreView } from "./shop-store-view";
import { serializePrisma } from "@/lib/serialize-prisma";
import { Metadata } from "next";
import Link from "next/link";
import { ensureShopStoreTablesIfMissing } from "@/lib/db-self-heal-shop-store";
import { getShopStoreMetadata } from "@/lib/store-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopId: string }>;
}): Promise<Metadata> {
  const { shopId } = await params;
  return getShopStoreMetadata(shopId);
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
          <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
              <path d="M2 7h20" />
            </svg>
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

  // استخدام الـ ID الحقيقي للمحل لجلب الأقسام والمنتجات
  const realShopId = shopRaw.id;

  // جلب محتويات متجر المحل
  const [categoriesRaw, branchesRaw, productsRaw, slidesRaw] = await Promise.all([
    prisma.shopStoreCategory.findMany({
      where: { shopId: realShopId, active: true },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreBranch.findMany({
      where: { shopId: realShopId, active: true },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreProduct.findMany({
      where: { shopId: realShopId, active: true },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreSlide.findMany({
      where: { shopId: realShopId, active: true },
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
