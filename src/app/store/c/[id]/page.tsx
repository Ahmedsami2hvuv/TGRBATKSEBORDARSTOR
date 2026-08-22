import React from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CustomProductRequest } from "@/components/custom-product-request";
import { CategoryBranchesScroll } from "./_components/category-branches-scroll";
import { ProductCard } from "../../product-card";
import { ProductListInfinite } from "./_components/product-list-infinite";

export const revalidate = 3600; // تفعيل الكاش لـ 3600 ثانية لتسريع التصفح

// دالة تطهير بيانات فائقة الأمان لـ Next.js 15 لضمان تحويل كافة الكائنات المعقدة إلى بسيطة
function safeJson(data: any) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || typeof value.toNumber === 'function')) {
        return Number(value.toString());
    }
    return value;
  }));
}

export default async function CategoryPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ b?: string }> }) {
  // انتظر الـ params أولاً (مطلوب في Next.js 15)
  const params = await props.params;
  const searchParams = await props.searchParams;
  const categoryId = params?.id;
  const activeBranchId = searchParams?.b;

  if (!categoryId) return <div className="p-10 text-center font-bold">معرف القسم مفقود</div>;

  try {
    const { ensureHidePricesColumns } = await import("@/lib/db-self-heal-hide-prices");
    await ensureHidePricesColumns();

    const settingsRaw = await prisma.globalSettings.findUnique({ where: { id: "system" } }).catch(() => null);

    // جلب البيانات الأساسية
    const categoryRaw = await prisma.storeCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, photoUrl: true, profitMargin: true, hidePrices: true }
    });

    if (!categoryRaw) {
        return (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100" dir="rtl">
            <h2 className="text-xl font-bold text-slate-900">القسم المطلوب غير موجود</h2>
            <Link href="/store" prefetch={false} className="text-green-600 underline mt-4 block font-bold">العودة للمتجر الرئيسي</Link>
          </div>
        );
    }

    const branchesRaw = await prisma.storeBranch.findMany({
      where: { categoryId, active: true, parentBranchId: null },
      orderBy: { sequence: "desc" },
    });

    // جلب المنتجات (إما كل المنتجات في القسم، أو منتجات الفرع المحدد)
    const productsWhereClause = activeBranchId 
      ? { branchId: activeBranchId, active: true }
      : { branch: { categoryId }, active: true };

    const productsRaw = await prisma.storeProduct.findMany({
      where: productsWhereClause,
      orderBy: { sequence: "asc" },
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

    // تطهير البيانات بالكامل قبل استخدامها
    const category = safeJson(categoryRaw);
    const branches = safeJson(branchesRaw);
    const settings = safeJson(settingsRaw);

    const globalMargin = settings?.profitMargin || 0;
    const categoryMargin = category.profitMargin || 0;

    // تجهيز أسعار المنتجات
    const products = safeJson(productsRaw).map((p: any) => {
      const supplierMargin = p.supplier?.profitMargin || 0;
      const branchMargin = p.branch?.profitMargin || 0;
      const effectiveMargin = supplierMargin || branchMargin || categoryMargin || globalMargin;

      let salePrice = p.salePrice || 0;
      const purchasePrice = p.purchasePrice || 0;

      if (salePrice <= 0 && purchasePrice > 0) {
        const addedMargin = effectiveMargin <= 1 ? (purchasePrice * effectiveMargin) : effectiveMargin;
        salePrice = purchasePrice + addedMargin;
      }

      const variants = (p.variants || []).map((v: any) => {
        let vSalePrice = v.salePrice || 0;
        const vPurchasePrice = v.purchasePrice || 0;
        if (vSalePrice <= 0 && vPurchasePrice > 0) {
          const vAddedMargin = effectiveMargin <= 1 ? (vPurchasePrice * effectiveMargin) : effectiveMargin;
          vSalePrice = vPurchasePrice + vAddedMargin;
        }
        return {
          id: String(v.id),
          name: v.name,
          salePrice: vSalePrice,
          purchasePrice: vPurchasePrice,
        };
      });

      return {
        id: String(p.id),
        name: p.name,
        description: p.description || "",
        salePrice,
        purchasePrice,
        photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
        hasVariants: !!p.hasVariants,
        variantType: p.variantType || "النوع",
        variants,
        supplierId: p.supplierId || null,
        hidePrices: p.hidePrices,
        branch: p.branch,
        category: p.category || p.branch?.category || category,
      };
    });

    return (
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-700" dir="rtl">
        {/* Header Section */}
        <header className="space-y-4 pt-2">
          {branches && branches.length > 0 ? (
            <React.Suspense fallback={<div className="h-16 bg-slate-50 animate-pulse rounded-2xl" />}>
              <CategoryBranchesScroll branches={branches} categoryId={categoryId} productCount={products.length} />
            </React.Suspense>
          ) : (
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg md:text-xl font-black flex items-center gap-2 text-slate-900">المنتجات</h2>
              <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500">{products.length} منتج</span>
            </div>
          )}
        </header>

        {/* Products Grid with Infinite Scroll */}
        <section className="space-y-4">
          <ProductListInfinite products={products} />
        </section>
      </div>
    );
  } catch (error) {
    console.error("[CategoryPage Render Error]:", error);
    return (
      <div className="p-20 text-center bg-white rounded-3xl border border-rose-100 shadow-xl" dir="rtl">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-black text-slate-900">عذراً، حدث خطأ أثناء تحميل القسم</h2>
        <p className="text-sm text-slate-500 mt-2">نعمل على معالجة المشكلة الآن، يرجى تحديث الصفحة بعد قليل.</p>
        <a href="" className="mt-6 px-8 py-3 bg-green-600 text-white rounded-2xl font-black shadow-lg hover:bg-green-700 transition-all inline-block">إعادة المحاولة</a>
      </div>
    );
  }
}
