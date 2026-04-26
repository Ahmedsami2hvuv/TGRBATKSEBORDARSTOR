import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";

export const dynamic = "force-dynamic";

export default async function StaffBranchAdminPage({
  params,
  searchParams
}: {
  params: Promise<{ branchId: string }>,
  searchParams: Promise<any>
}) {
  const { branchId } = await params;
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const emp = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    include: { managedBranches: { where: { id: branchId } } }
  });

  if (!emp || !emp.active || !emp.canManageStore || emp.managedBranches.length === 0) {
    return <div className="p-8 text-center font-bold text-rose-600">ليس لديك صلاحية لإدارة هذا الفرع.</div>;
  }

  const branch = emp.managedBranches[0];

  // جلب المنتجات التابعة لهذا الفرع
  const products = await prisma.storeProduct.findMany({
    where: { branchId: branch.id },
    orderBy: { sequence: "asc" },
    include: { variants: true }
  });

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <Link href={`/staff/portal/store?${authQ}`} className="text-sm font-bold text-purple-600 hover:underline">
            ← العودة للأفرع
          </Link>
          <div className="mt-4 flex items-center justify-between">
            <h1 className="text-2xl font-black text-slate-900">{branch.name}</h1>
          </div>
        </header>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3">
            <Link
              href={`/staff/portal/store/branches/${branch.id}/products/new?${authQ}`}
              className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 text-center border-2 border-dashed border-emerald-200 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50"
            >
              <div className="mb-2 rounded-full bg-emerald-100 p-3 text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-lg font-black text-emerald-900">إضافة منتج جديد للفرع</span>
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            <h2 className="text-lg font-black text-slate-900 px-1">المنتجات الحالية ({products.length})</h2>
            {products.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                  لا توجد منتجات مضافة في هذا الفرع بعد.
                </div>
            ) : (
                products.map(p => (
                   <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        {p.photoUrls?.[0] && (
                          <img src={p.photoUrls[0]} alt="" className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
                        )}
                        <div>
                          <h3 className="font-bold text-slate-800">{p.name}</h3>
                          <p className="text-xs text-slate-500">
                            {p.hasVariants ? `${p.variants.length} خيارات` : `${Number(p.salePrice).toLocaleString()} د.ع`}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/staff/portal/store/products?${authQ}&search=${encodeURIComponent(p.name)}`}
                        className="text-xs font-black text-sky-600 px-4 py-2 bg-sky-50 rounded-xl hover:bg-sky-100"
                      >
                        تعديل
                      </Link>
                   </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}