import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportCustomersButton } from "./import-customers-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || "";

  const customersCount = await prisma.customerPhoneProfile.count();

  const profiles = await prisma.customerPhoneProfile.findMany({
    where: q ? {
      OR: [
        { phone: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { landmark: { contains: q, mode: 'insensitive' } }
      ]
    } : undefined,
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: { region: { select: { name: true } } }
  });

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>← الرئيسية</Link>
      </p>

      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-blue-100">
        <div>
          <h1 className={ad.h1}>بيانات الزبائن (البروفايلات)</h1>
          <p className="text-sm font-bold text-blue-600">إجمالي المسجلين في القاعدة: {customersCount.toLocaleString()}</p>
        </div>
        <ImportCustomersButton />
      </div>

      <div className="bg-white rounded-2xl shadow-md border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700 italic">قائمة هواتف الزبائن المسجلة</h3>
            <form className="flex gap-2">
                <input name="q" defaultValue={q} placeholder="بحث بالهاتف أو الملاحظات..." className="text-sm border rounded-xl px-4 py-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none" />
                <button className="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-bold">بحث</button>
            </form>
        </div>

        <div className="overflow-x-auto text-right">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-600 font-bold border-b">
              <tr>
                <th className="p-4">الهاتف</th>
                <th className="p-4">المنطقة</th>
                <th className="p-4">العنوان / الملاحظات</th>
                <th className="p-4 text-center">الموقع</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {profiles.map(p => (
                <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                  <td className="p-4 font-bold text-blue-700">{p.phone}</td>
                  <td className="p-4"><span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">{p.region?.name || 'عام'}</span></td>
                  <td className="p-4 text-gray-600">
                    <div className="font-medium text-gray-800">{p.notes}</div>
                    <div className="text-xs text-gray-400">{p.landmark}</div>
                  </td>
                  <td className="p-4 text-center">
                    {p.locationUrl ? (
                      <a href={p.locationUrl} target="_blank" className="text-blue-500 hover:underline">📍 الخريطة</a>
                    ) : '---'}
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr><td colSpan={4} className="p-20 text-center text-gray-400 font-bold italic">لا يوجد بيانات حالياً. ابدأ السحب من الأزرار أعلاه.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
