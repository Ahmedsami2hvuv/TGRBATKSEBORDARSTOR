import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportCustomersButton } from "./import-customers-button";
import Link from "next/link";

import { CustomerSearchInput } from "./customer-search-input";
export const dynamic = "force-dynamic";
export const revalidate = 0; // منع الكاش نهائياً

export default async function AdminCustomersPage(props: { searchParams: Promise<{ q?: string, page?: string }> }) {
  const searchParams = await props.searchParams;
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
          <div className="flex-1 flex gap-2">
              <CustomerSearchInput defaultValue={q} />
              <button type="button" className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md">بحث</button>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {profiles.map((p, index) => {
          const stats = statsMap.get(p.phone);
          const seqNumber = filteredCount - skip - index;
          
          return (
            <Link
              key={p.id}
              href={`/admin/customers/info?phone=${p.phone}&id=${p.id}`}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-2 items-center">
                   <div className="bg-gray-800 text-white px-2 py-1 rounded-lg text-xs font-black shadow-sm">
                      #{seqNumber.toLocaleString()}
                   </div>
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
        <div className="flex justify-center items-center gap-2 pt-4 flex-wrap">
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            const isActive = page === p;
            return (
              <Link 
                key={p} 
                href={`/admin/customers?q=${q}&page=${p}`} 
                className={`w-10 h-10 flex justify-center items-center rounded-xl font-bold text-sm shadow-sm transition-all border ${
                  isActive 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
