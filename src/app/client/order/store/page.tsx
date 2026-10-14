import { verifyEmployeeOrderPortalQuery } from "@/lib/employee-order-portal-link";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ensureShopStoreTablesIfMissing } from "@/lib/db-self-heal-shop-store";
import { StoreManager } from "@/components/shop-manager/store-manager";
import { ArrowRight, Store, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إدارة متجر المحل — وصلي",
};

type Props = {
  searchParams: Promise<{ e?: string; exp?: string; s?: string }>;
};

export default async function ClientShopStorePage(props: Props) {
  const sp = await props.searchParams;

  // التحقق من صلاحية رابط بوابة العميل
  const v = verifyEmployeeOrderPortalQuery(sp.e, sp.exp, sp.s);

  if (!v.ok) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16 text-slate-800" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-rose-700 mb-2">تعذّر فتح صفحة المتجر</h2>
          <p className="text-sm text-slate-600 mb-6">الرابط غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد.</p>
        </div>
      </div>
    );
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: v.employeeId },
      include: {
        shop: true,
      },
    });

    if (!employee || !employee.shop) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16 text-slate-800" dir="rtl">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-xl text-center">
            <h2 className="text-xl font-black text-rose-700 mb-2">بيانات المحل غير موجودة</h2>
            <p className="text-sm text-slate-600">تعذر العثور على المحل المرتبط بهذا الحساب.</p>
          </div>
        </div>
      );
    }

    if (employee.orderPortalToken !== v.token) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-16 text-slate-800" dir="rtl">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-amber-200 shadow-xl text-center">
            <h2 className="text-xl font-black text-amber-700 mb-2">الرابط غير صالح</h2>
            <p className="text-sm text-slate-600">تم تجديد رابط الحساب، يرجى استخدام أحدث رابط.</p>
          </div>
        </div>
      );
    }

    const shop = employee.shop;

    // الشرط الصارم رقم 3: إذا لم يكن المتجر مفعلاً للمحل من قبل الإدارة
    if (!shop.storeEnabled) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-16 text-slate-800" dir="rtl">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-blue-100 shadow-2xl text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center mx-auto text-blue-700 shadow-inner">
              <Store className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">متجر {shop.name} غير مفعّل</h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                ميزة المتجر الإلكتروني الخاص غير مفعلة لمحلك حالياً. يمكنك التواصل مع إدارة وصلي لتفعيل متجرك واستقبال طلبات الزبائن مباشرة.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href={`/client/order?e=${sp.e}&exp=${sp.exp}&s=${sp.s}`}
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-[#0B2E8C] text-white font-bold hover:bg-[#082269] transition shadow-lg shadow-blue-900/20 active:scale-95 text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة لصفحة الطلبات</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // جلب بيانات المتجر: الأقسام، الفروع، المنتجات، والبانرات
    const [categories, branches, products, slides] = await Promise.all([
      (prisma as any).shopStoreCategory.findMany({
        where: { shopId: shop.id },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
      }).catch(() => []),
      (prisma as any).shopStoreBranch.findMany({
        where: { shopId: shop.id },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
      }).catch(() => []),
      (prisma as any).shopStoreProduct.findMany({
        where: { shopId: shop.id },
        orderBy: [{ sequence: "asc" }, { createdAt: "desc" }],
      }).catch(() => []),
      (prisma as any).shopStoreSlide.findMany({
        where: { shopId: shop.id },
        orderBy: [{ sequence: "asc" }, { createdAt: "desc" }],
      }).catch(() => []),
    ]);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
        {/* شريط ملاحة علوي للعودة لحساب العميل */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <Link
              href={`/client/order?e=${sp.e}&exp=${sp.exp}&s=${sp.s}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة لرفع الطلبات</span>
            </Link>

            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium">مرحباً</span>{" "}
              <span className="text-xs font-bold text-slate-800">{employee.name}</span>
            </div>
          </div>
        </div>

        {/* جسم الصفحة الرئيسي الذي يحتوي على مدير المتجر الكامل */}
        <main className="max-w-5xl mx-auto p-4 md:p-6">
          <StoreManager
            shop={shop}
            categories={categories}
            branches={branches}
            products={products}
            slides={slides}
          />
        </main>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <h1 className="text-xl font-bold text-rose-600">حدث خطأ في تحميل المتجر</h1>
        <p className="mt-2 text-slate-600 text-sm">نعتذر، يرجى المحاولة لاحقاً.</p>
        <pre className="mt-4 p-4 bg-slate-100 rounded-xl text-xs overflow-auto text-left inline-block max-w-lg">
          {error?.message}
        </pre>
      </div>
    );
  }
}
