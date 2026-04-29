import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ShopEmployeesPage(props: any) {
  try {
    // 1. التشخيص الأولي للمعايير
    const params = await props.params;
    const shopId = params?.id;

    if (!shopId) {
      return (
        <div className="p-8 border-2 border-red-500 bg-red-50 text-red-800">
          <h1 className="font-bold">خطأ في الرابط</h1>
          <p>لم يتم العثور على معرّف المحل (ID) في الرابط.</p>
        </div>
      );
    }

    // 2. محاولة جلب بيانات المحل
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, region: { select: { name: true } } }
    });

    if (!shop) {
      return (
        <div className="p-8 border-2 border-amber-500 bg-amber-50 text-amber-800">
          <h1 className="font-bold">المحل غير موجود</h1>
          <p>المحل صاحب المعرّف ({shopId}) غير موجود في قاعدة البيانات.</p>
          <Link href="/admin/shops" className="underline mt-4 block">العودة للمحلات</Link>
        </div>
      );
    }

    // 3. جلب الموظفين
    const employees = await prisma.employee.findMany({
      where: { shopId },
      select: { id: true, name: true, phone: true }
    });

    // 4. عرض النتائج بشكل مبسط جداً للاختبار
    return (
      <div className="p-8 space-y-6 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-black text-slate-800">تشخيص صفحة الموظفين</h1>
          <p className="text-slate-500 text-sm">إذا ظهرت هذه الصفحة، فالمشكلة كانت في المكونات الرسومية.</p>
        </div>

        <div className="grid gap-4">
          <div className="p-4 bg-sky-50 rounded-lg">
            <span className="block text-xs font-bold text-sky-600 uppercase">اسم المحل</span>
            <span className="text-lg font-bold text-sky-900">{shop.name}</span>
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg">
            <span className="block text-xs font-bold text-emerald-600 uppercase">المنطقة</span>
            <span className="text-lg font-bold text-emerald-900">{shop.region?.name || "غير محددة"}</span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-bold text-slate-700">قائمة الموظفين المسجلين ({employees.length}):</h2>
          {employees.length === 0 ? (
            <p className="text-slate-400 italic">لا يوجد موظفون لهذا المحل.</p>
          ) : (
            <ul className="divide-y border rounded-lg overflow-hidden">
              {employees.map(e => (
                <li key={e.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-slate-500 tabular-nums">{e.phone}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-6">
          <Link href="/admin/shops" className="text-sky-600 hover:underline">
            ← العودة لقائمة المحلات
          </Link>
        </div>
      </div>
    );

  } catch (err: any) {
    // في حال حدث خطأ برمي التفاصيل مباشرة على الشاشة
    return (
      <div className="p-8 border-4 border-dashed border-rose-500 bg-rose-50 text-rose-900 overflow-auto">
        <h1 className="text-xl font-black mb-4 flex items-center gap-2">
          <span>❌</span> تعذّر تحميل البيانات (خطأ داخلي)
        </h1>
        <p className="font-bold mb-2">نوع الخطأ:</p>
        <div className="bg-white p-4 rounded border border-rose-200 font-mono text-sm whitespace-pre-wrap mb-4">
          {err.message || "خطأ غير معروف"}
        </div>
        <p className="font-bold mb-2">تتبع الخطأ (Stack Trace):</p>
        <div className="bg-slate-900 text-slate-300 p-4 rounded font-mono text-xs whitespace-pre-wrap h-64">
          {err.stack || "لا توجد تفاصيل إضافية."}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 bg-rose-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
}
