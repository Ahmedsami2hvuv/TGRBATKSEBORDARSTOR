import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildEmployeeOrderPortalUrl } from "@/lib/employee-order-portal-link";
import { buildShopStaffOrderShareMessage, whatsappMeUrl } from "@/lib/whatsapp";
import { deleteEmployee } from "./actions";

export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: any) {
  const params = await props.params;
  const shopId = String(params?.id || "");

  if (!shopId) return notFound();

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { region: true },
  });

  if (!shop) return notFound();

  const employees = await prisma.employee.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  const baseUrl = getPublicAppUrl();

  return (
    <div className="space-y-8 p-4 max-w-5xl mx-auto">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <Link href="/admin/shops" className="text-sky-600 font-bold hover:underline">
          ← العودة للمحلات
        </Link>
        <div className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-1 rounded border border-emerald-200 font-bold uppercase">
          System Stable
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-black italic">أصحاب الروابط</h1>
          <p className="mt-2 text-slate-400 flex items-center gap-2 text-lg">
            <span>المحل:</span>
            <span className="text-white font-bold underline decoration-sky-500">{shop.name}</span>
            <span className="opacity-30">|</span>
            <span className="text-sky-400">{shop.region?.name || "بدون منطقة"}</span>
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 blur-[100px] rounded-full"></div>
      </div>

      {/* نموذج إضافة موظف (مباشر وبسيط) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="bg-sky-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">+</span>
          إضافة موظف جديد للمحل
        </h3>
        <form action="/api/admin/employees/add" method="POST" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input type="hidden" name="shopId" value={shopId} />
          <input
            name="name"
            placeholder="اسم الموظف"
            required
            className="bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-sky-500 transition-all"
          />
          <input
            name="phone"
            placeholder="رقم الواتساب (مثال: 077...)"
            required
            className="bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-sky-500 transition-all font-mono"
          />
          <button type="submit" className="bg-sky-600 text-white font-bold rounded-xl p-3 hover:bg-sky-700 shadow-lg shadow-sky-100 transition-all">
            إضافة الحساب
          </button>
        </form>
      </div>

      {/* قائمة الموظفين (عرض مباشر بدون مكونات خارجية) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800 italic">قائمة الحسابات النشطة ({employees.length})</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {employees.map((e) => {
            let portalUrl = "";
            let waLink = "#";
            try {
              portalUrl = buildEmployeeOrderPortalUrl(e.id, e.orderPortalToken, baseUrl);
              const msg = buildShopStaffOrderShareMessage({
                shopName: shop.name,
                locationUrl: shop.locationUrl || "",
                employeeName: e.name,
                orderPortalUrl: portalUrl
              });
              waLink = whatsappMeUrl(e.phone, msg);
            } catch(err) {}

            return (
              <div key={e.id} className="p-6 hover:bg-slate-50/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h4 className="text-xl font-bold text-slate-900">{e.name}</h4>
                  <p className="text-slate-500 font-mono text-sm tracking-tighter mt-1">{e.phone}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={waLink}
                      className="bg-emerald-600 text-white text-[11px] font-bold px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2 shadow-sm"
                    >
                      <span>💬</span> إرسال الرابط (واتساب)
                    </a>
                    <a
                      href={portalUrl}
                      target="_blank"
                      className="bg-sky-100 text-sky-700 text-[11px] font-bold px-4 py-2 rounded-lg hover:bg-sky-200 flex items-center gap-2"
                    >
                      <span>🔗</span> فتح الرابط المباشر
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t md:border-0 pt-4 md:pt-0">
                  <Link
                    href={`/admin/shops/${shopId}/employees/${e.id}/edit`}
                    className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-950 transition-all"
                  >
                    تعديل
                  </Link>

                  {/* زر الحذف باستخدام Form Action مباشر */}
                  <form action={deleteEmployee} onSubmit={(ev) => !confirm("هل أنت متأكد من حذف هذا الحساب؟") && ev.preventDefault()}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="shopId" value={shopId} />
                    <button className="bg-rose-50 text-rose-600 text-xs font-bold px-4 py-2 rounded-lg hover:bg-rose-100 transition-all border border-rose-100">
                      حذف
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {employees.length === 0 && (
            <div className="p-20 text-center text-slate-400 italic">
              لا يوجد موظفون مسجلون لهذا المحل حتى الآن.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
