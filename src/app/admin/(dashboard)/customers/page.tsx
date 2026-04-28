import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportCustomersButton } from "./import-customers-button";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0; // منع الكاش نهائياً

export default async function AdminCustomersPage({ searchParams }: { searchParams: { q?: string, page?: string } }) {
  const q = searchParams.q || "";
  const page = parseInt(searchParams.page || "1") || 1;
  const take = 100;
  const skip = (page - 1) * take;

  const whereClause = q ? {
    OR: [
      { phone: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
      { landmark: { contains: q, mode: 'insensitive' } },
      { region: { name: { contains: q, mode: 'insensitive' } } }
    ]
  } : undefined;

  const profilesCount = await prisma.customerPhoneProfile.count();
  const filteredCount = await prisma.customerPhoneProfile.count({ where: whereClause as any });
  const totalPages = Math.ceil(filteredCount / take);

  // جلب البروفايلات مع إحصائيات الطلبات المرتبطة بالرقم
  const profiles = await prisma.customerPhoneProfile.findMany({
    where: whereClause as any,
    take,
    skip,
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
              <div className="flex gap-2 items-center">
                <p className="text-gray-500 text-sm">إجمالي الزبائن في القاعدة: <span className="text-blue-600 font-bold">{profilesCount.toLocaleString()}</span></p>
                <span className="text-gray-300">|</span>
                <p className="text-gray-500 text-sm">المعروض حالياً: <span className="text-green-600 font-bold">{profiles.length} (صفحة {page} من {totalPages || 1})</span></p>
              </div>
           </div>
           <ImportCustomersButton />
        </div>
      </div>

      <div className="flex gap-2 items-center bg-white p-4 rounded-2xl shadow-sm border border-blue-50">
          <Link href="/admin/customers/add" className="bg-cyan-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-cyan-600 transition-all text-sm">
            إضافة زبون مرجعي
          </Link>
          <form className="flex-1 flex gap-2" action="/admin/customers">
              <input
                name="q"
                defaultValue={q}
                placeholder="بحث في كافة الزبائن رقم الهاتف، المنطقة أو..."
                className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none text-right"
              />
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md">بحث</button>
          </form>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {profiles.map(p => {
          const stats = statsMap.get(p.phone);
          return (
            <Link
              key={p.id}
              href={`/admin/customers/info?phone=${p.phone}&id=${p.id}`}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
            >
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
                <p className="text-gray-500 text-xs leading-relaxed italic line-clamp-2">
                  {p.notes || "لا توجد ملاحظات مسجلة لهذا العنوان"}
                </p>
                {p.landmark && (
                  <p className="text-[10px] text-blue-500 font-bold mt-1">📍 {p.landmark}</p>
                )}
              </div>

              {p.photoUrl && (
                <div className="flex gap-1 mt-1">
                   <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded border border-green-100 font-bold">📷 توجد صورة باب</span>
                </div>
              )}

              {p.locationUrl && (
                <div className="absolute left-4 bottom-4 bg-gray-100 p-2 rounded-full hover:bg-blue-100 transition-colors group-hover:scale-110">
                  📍
                </div>
              )}

              <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </Link>
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

      {/* أزرار التنقل بين الصفحات */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          {page < totalPages ? (
            <Link href={`/admin/customers?q=${q}&page=${page + 1}`} className="px-5 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-bold text-sm shadow-sm transition-all">
              التالي
            </Link>
          ) : (
            <span className="px-5 py-2 bg-gray-50 border border-gray-100 rounded-xl text-gray-400 font-bold text-sm cursor-not-allowed">التالي</span>
          )}

          <span className="text-sm font-bold text-gray-600 px-4">
            صفحة {page} من {totalPages}
          </span>

          {page > 1 ? (
            <Link href={`/admin/customers?q=${q}&page=${page - 1}`} className="px-5 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-bold text-sm shadow-sm transition-all">
              السابق
            </Link>
          ) : (
            <span className="px-5 py-2 bg-gray-50 border border-gray-100 rounded-xl text-gray-400 font-bold text-sm cursor-not-allowed">السابق</span>
          )}
        </div>
      )}
    </div>
  );
}
