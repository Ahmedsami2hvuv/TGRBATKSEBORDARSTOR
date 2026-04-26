import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { StaffCategoryListClient } from "./staff-category-list-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StaffCategoriesPage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const emp = await prisma.staffEmployee.findUnique({ where: { id: v.staffEmployeeId } });
  if (!emp || !emp.active || !emp.canManageStore) {
    return <div className="p-8 text-center font-bold text-rose-600">ليس لديك صلاحية لإدارة المتجر.</div>;
  }

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();
  const categories = await prisma.storeCategory.findMany({
    orderBy: { sequence: "asc" },
  });

  return (
    <div className="kse-app-bg min-h-screen px-4 py-10" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/staff/portal/store?${authQ}`} className="text-sky-600 font-bold mb-1 inline-block text-sm">← العودة لإدارة المتجر</Link>
            <h1 className="text-2xl font-black text-slate-900">أقسام المتجر</h1>
          </div>
        </div>
        <StaffCategoryListClient initialCategories={categories} authQ={authQ} />
      </div>
    </div>
  );
}
