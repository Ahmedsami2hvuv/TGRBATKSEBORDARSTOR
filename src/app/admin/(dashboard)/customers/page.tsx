import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportCustomersButton } from "./import-customers-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q || "";

  const customersCount = await prisma.customer.count();

  // جلب الزبائن للعرض (آخر 50 تم إضافتهم أو حسب البحث)
  const customers = await prisma.customer.findMany({
    where: q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } }
      ]
    } : undefined,
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: { shop: { select: { name: true } } }
  });

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>← الرئيسية</Link>
      </p>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
        <div>
          <h1 className={ad.h1}>بيانات الزبائن</h1>
          <p className="text-sm font-bold text-blue-600">إجمالي المسجلين: {customersCount.toLocaleString()}</p>
        </div>
        <ImportCustomersButton />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">آخر الزبائن المضافين</h3>
            <form className="flex gap-2">
                <input name="q" defaultValue={q} placeholder="بحث بالاسم أو الرقم..." className="text-sm border rounded-lg px-3 py-1" />
                <button className="bg-gray-800 text-white text-xs px-3 py-1 rounded-lg">بحث</button>
            </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-100 text-gray-600 font-bold">
              <tr>
                <th className="p-3">الاسم</th>
                <th className="p-3">الهاتف</th>
                <th className="p-3">المحل</th>
                <th className="p-3">المنطقة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-blue-50 transition-colors">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-gray-600">{c.phone}</td>
                  <td className="p-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{c.shop?.name || 'بدون'}</span></td>
                  <td className="p-3 text-gray-500">{c.customerLandmark || '---'}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-gray-400">لا يوجد زبائن حالياً. استخدم أزرار السحب أعلاه.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
