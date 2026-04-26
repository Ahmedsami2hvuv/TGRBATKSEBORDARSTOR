import Link from "next/link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { CategoryForm } from "./category-form";

export const dynamic = "force-dynamic";

export default async function NewStaffCategoryPage({
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
  const authParams = { se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900" dir="rtl">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <Link
            href={`/staff/portal/store/branches/${branchId}?${new URLSearchParams(authParams).toString()}`}
            className="text-sm font-bold text-purple-600 hover:underline"
          >
            ← العودة للفرع
          </Link>
          <h1 className="mt-4 text-2xl font-black text-slate-900">إضافة قسم جديد</h1>
          <p className="text-sm font-bold text-slate-500">{branch.name}</p>
        </header>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <CategoryForm branchId={branchId} authParams={authParams} />
        </div>
      </div>
    </div>
  );
}
