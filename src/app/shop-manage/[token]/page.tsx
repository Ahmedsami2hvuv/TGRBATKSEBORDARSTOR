import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StoreManager } from "@/components/shop-manager/store-manager";
import { serializePrisma } from "@/lib/serialize-prisma";
import { ensureShopStoreTablesIfMissing } from "@/lib/db-self-heal-shop-store";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const shop = await prisma.shop.findFirst({
      where: {
        OR: [{ storeToken: token }, { id: token }],
      },
      select: { name: true },
    });
    return {
      title: shop ? `إدارة متجر ${shop.name} | وصلي` : "إدارة المتجر",
    };
  } catch {
    return { title: "إدارة المتجر | وصلي" };
  }
}

export default async function ShopManageByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // البحث عن المحل عبر التوكن المشفر أو عبر الـ ID
  const shopRaw = await prisma.shop.findFirst({
    where: {
      OR: [{ storeToken: token }, { id: token }],
    },
    include: {
      region: true,
    },
  });

  if (!shopRaw) {
    notFound();
  }

  const shopId = shopRaw.id;

  // جلب محتويات المتجر
  const [categoriesRaw, branchesRaw, productsRaw, slidesRaw] = await Promise.all([
    prisma.shopStoreCategory.findMany({
      where: { shopId },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreBranch.findMany({
      where: { shopId },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreProduct.findMany({
      where: { shopId },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreSlide.findMany({
      where: { shopId },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
  ]);

  const shop = serializePrisma(shopRaw);
  const categories = serializePrisma(categoriesRaw);
  const branches = serializePrisma(branchesRaw);
  const products = serializePrisma(productsRaw);
  const slides = serializePrisma(slidesRaw);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <StoreManager
          shop={shop}
          categories={categories}
          branches={branches}
          products={products}
          slides={slides}
        />
      </div>
    </div>
  );
}
