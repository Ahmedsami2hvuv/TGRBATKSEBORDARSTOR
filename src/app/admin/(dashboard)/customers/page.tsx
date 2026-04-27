import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportCustomersButton } from "./import-customers-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || "";

  const profilesCount = await prisma.customerPhoneProfile.count();

  // جلب البروفايلات مع إحصائيات الطلبات المرتبطة بالرقم
  const profiles = await prisma.customerPhoneProfile.findMany({
    where: q ? {
      OR: [
        { phone: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { landmark: { contains: q, mode: 'insensitive' } },
        { region: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : undefined,
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      region: { select: { name: true } },
    }
  });

  // جلب إحصائيات الطلبات لكل رقم هاتف في القائمة الحالية
  const phones = profiles.map(p => p.phone);
  const orderStats = await prisma.order.groupBy({
    by: ['customerPhone'],
    where: { customerPhone: { in: phones } },
    _count: { _all: true },
    _sum: { totalAmount: true }
  });

  const statsMap = new Map(orderStats.map(s => [s.customerPhone, s]));

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <p className={ad.muted}>
          <Link href="/admin" className={ad.link}>← الرئيسية</Link>
        </p>
        <div className="flex justify-between items-end">
           <div>
              <h1 className="text-3xl font-black text-gray-800">بيانات الزبائن</h1>
              <p className="text-gray-500 text-sm">يتم عرض الزبائن الذين لديهم مواقع مسجلة، إجمالي {profilesCount.toLocaleString()} سجل مطابق.</p>
           </div>
           <ImportCustomersButton />
        </div>
      </div>

      <div className="flex gap-2 items-center bg-white p-4 rounded-2xl shadow-sm border border-blue-50">
          <Link href="/admin/customers/add" className="bg-cyan-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-cyan-600 transition-all text-sm">
            إضافة زبون مرجعي
          </Link>
          <form className="flex-1 flex gap-2">
              <input
                name="q"
                defaultValue={q}
                placeholder="بحث في كافة الزبائن رقم الهاتف، المنطقة أو..."
                className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none text-right"
              />
              <button className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md">بحث</button>
          </form>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {profiles.map(p => {
          const stats = statsMap.get(p.phone);
          return (
            <div key={p.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex justify-between items-start">
                <div className="flex gap-2">
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-bold border border-blue-100">
                      الطلبات: {stats?._count?._all || 0}
                   </div>
                   <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg text-[10px] font-bold border border-purple-100">
                      مجموع الأسعار: {Number(stats?._sum?.totalAmount || 0).toLocaleString()}
                   </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <span className="text-lg font-black text-gray-800 tracking-tighter">{p.phone}</span>
                   <span className="bg-gray-100 text-gray-600 px-3 py-0.5 rounded text-[10px] font-bold border">
                      {p.region?.name || 'غير محدد'}
                   </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-gray-500 text-xs leading-relaxed italic">
                  {p.notes || "لا توجد ملاحظات مسجلة لهذا العنوان"}
                </p>
                {p.landmark && (
                  <p className="text-[10px] text-blue-500 font-bold mt-1">📍 {p.landmark}</p>
                )}
              </div>

              {p.locationUrl && (
                <a
                  href={p.locationUrl}
                  target="_blank"
                  className="absolute left-4 bottom-4 bg-gray-100 p-2 rounded-full hover:bg-blue-100 transition-colors group-hover:scale-110"
                  title="فتح الموقع"
                >
                  📍
                </a>
              )}

              <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          );
        })}

        {profiles.length === 0 && (
          <div className="bg-white p-20 text-center rounded-3xl border-2 border-dashed border-gray-200">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-400 italic">لا يوجد نتائج تطابق بحثك أو القاعدة فارغة</h3>
            <p className="text-sm text-gray-300">استخدم زر الاستيراد أعلاه لجلب البيانات</p>
          </div>
        )}
      </div>
    </div>
  );
}
