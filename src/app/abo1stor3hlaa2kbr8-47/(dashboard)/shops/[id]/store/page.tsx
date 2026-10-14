import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StoreManager } from "./store-manager";
import { serializePrisma } from "@/lib/serialize-prisma";
import { ensureShopStoreTablesIfMissing } from "@/lib/db-self-heal-shop-store";

export const dynamic = "force-dynamic";

export default async function ShopStorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // التأكد من وجود الجداول في قاعدة البيانات
  await ensureShopStoreTablesIfMissing();

  const shopRaw = await prisma.shop.findUnique({
    where: { id },
    include: {
      region: true,
    },
  });

  if (!shopRaw) {
    notFound();
  }

  // جلب أقسام وفروع ومنتجات وسلايدات متجر المحل
  const [categoriesRaw, branchesRaw, productsRaw, slidesRaw] = await Promise.all([
    prisma.shopStoreCategory.findMany({
      where: { shopId: id },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreBranch.findMany({
      where: { shopId: id },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreProduct.findMany({
      where: { shopId: id },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
    prisma.shopStoreSlide.findMany({
      where: { shopId: id },
      orderBy: { sequence: "asc" },
    }).catch(() => []),
  ]);

  const shop = serializePrisma(shopRaw);
  const categories = serializePrisma(categoriesRaw);
  const branches = serializePrisma(branchesRaw);
  const products = serializePrisma(productsRaw);
  const slides = serializePrisma(slidesRaw);

  return (
    <div className="max-w-6xl mx-auto px-2 py-4">
      <StoreManager
        shop={shop}
        categories={categories}
        branches={branches}
        products={products}
        slides={slides}
      />
    </div>
  );
}
