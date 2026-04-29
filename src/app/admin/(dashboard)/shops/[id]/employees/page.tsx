import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { EmployeesList } from "./employees-list";
import { AddEmployeePanel } from "./add-employee-panel";

export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: any) {
  try {
    // 1. معالجة الـ Params بشكل آمن لإصدارات Next.js الحديثة
    const params = await props.params;
    const shopId = String(params?.id || "");

    if (!shopId) return notFound();

    // 2. جلب البيانات من قاعدة البيانات
    const shopData = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { region: true },
    });

    if (!shopData) return notFound();

    const employeesData = await prisma.employee.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
    });

    const baseUrl = getPublicAppUrl();

    // 3. تحويل البيانات إلى نصوص بسيطة جداً (Clean Serialization)
    // هذا الجزء يمنع خطأ "Server Components render error"
    const employeesRows = employeesData.map((e) => {
      let orderPortalUrl = "";
      try {
        orderPortalUrl = buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl);
      } catch (err) {
        orderPortalUrl = "";
      }
      return {
        id: String(e.id),
        name: String(e.name || ""),
        phone: String(e.phone || ""),
        orderPortalUrl: String(orderPortalUrl),
      };
    });

    // تنظيف بيانات المحل
    const cleanShop = {
      id: String(shopData.id),
      name: String(shopData.name || ""),
      locationUrl: String(shopData.locationUrl || ""),
      regionName: String(shopData.region?.name || "غير محددة")
    };

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className={ad.muted}>
            <Link href="/admin/shops" className={ad.link}>
              ← العودة لقائمة المحلات
            </Link>
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">النظام نشط</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 p-6 text-white shadow-lg">
          <div className="relative z-10">
            <h1 className="text-2xl font-black sm:text-3xl">موظفو المحل (أصحاب الروابط)</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sky-100 text-sm">
              <span className="flex items-center gap-1">
                <span className="opacity-60">المحل:</span>
                <span className="font-bold text-white">{cleanShop.name}</span>
              </span>
              <span className="hidden sm:inline opacity-30">|</span>
              <span className="flex items-center gap-1">
                <span className="opacity-60">المنطقة:</span>
                <span className="font-bold text-white">{cleanShop.regionName}</span>
              </span>
            </div>
          </div>
          {/* خلفية جمالية */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl"></div>
        </div>

        {/* لوحة إضافة موظف جديد */}
        <div className="bg-white rounded-2xl border border-sky-100 shadow-sm overflow-hidden">
          <AddEmployeePanel shopId={cleanShop.id} />
        </div>

        {/* قائمة الموظفين والأزرار */}
        <section className={ad.section}>
          <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
            <h2 className={ad.h2}>إدارة العملاء والروابط</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-slate-600 text-xs font-bold">
              <span>العدد الكلي:</span>
              <span className="text-sky-700">{employeesRows.length}</span>
            </div>
          </div>

          <div className="mt-3">
            <EmployeesList
              shopId={cleanShop.id}
              shopName={cleanShop.name}
              locationUrl={cleanShop.locationUrl}
              employees={JSON.parse(JSON.stringify(employeesRows))}
            />
          </div>
        </section>
      </div>
    );

  } catch (err: any) {
    // في حال حدوث خطأ غير متوقع، نعرضه بوضوح بدلاً من انهيار الصفحة
    return (
      <div className="p-8 border-2 border-rose-200 bg-rose-50 rounded-2xl text-rose-800 shadow-xl max-w-2xl mx-auto mt-10">
        <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
          <span>⚠️</span> تعذّر تحميل الصفحة
        </h1>
        <div className="bg-white/50 p-4 rounded-lg font-mono text-sm border border-rose-100 mb-6">
          {err.message || "حدث خطأ غير معروف في معالجة البيانات."}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
        >
          إعادة تحميل الصفحة
        </button>
      </div>
    );
  }
}
