import Link from "next/link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StaffStorePage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const emp = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    include: { managedBranches: true }
  });

  if (!emp || !emp.active || !emp.canManageStore) {
    return <div className="p-8 text-center font-bold">ليس لديك صلاحية لإدارة المتجر.</div>;
  }

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">إدارة المتجر</h1>
            <p className="text-sm font-bold text-slate-500">اختر الفرع للبدء في الإدارة</p>
          </div>
          <Link
            href={`/staff/portal?${authQ}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            ← العودة
          </Link>
        </header>

        <div className="grid gap-4">
          {emp.managedBranches.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
              <p className="text-lg font-black text-slate-400">لا توجد أفرع مخصصة لك حالياً.</p>
              <p className="mt-2 text-sm text-slate-400 text-pretty">يرجى مراجعة الإدارة لتعيين أفرع تحت إشرافك.</p>
            </div>
          ) : (
            emp.managedBranches.map((branch) => (
              <Link
                key={branch.id}
                href={`/staff/portal/store/branches/${branch.id}?${authQ}`}
                className="group flex items-center justify-between rounded-2xl border-2 border-white bg-white p-5 shadow-sm transition hover:border-purple-400 hover:shadow-md"
              >
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-700">{branch.name}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">إدارة المنتجات والأقسام</p>
                </div>
                <div className="rounded-full bg-slate-100 p-2 text-slate-400 transition group-hover:bg-purple-100 group-hover:text-purple-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}