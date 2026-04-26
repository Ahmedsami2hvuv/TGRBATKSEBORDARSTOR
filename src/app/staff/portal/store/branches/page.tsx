import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { StaffBranchListClient } from "./staff-branch-list-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StaffBranchesPage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const emp = await prisma.staffEmployee.findUnique({ where: { id: v.staffEmployeeId } });
  if (!emp || !emp.active || !emp.canManageStore) {
    return <div className="p-8 text-center font-bold text-rose-600">ليس لديك صلاحية لإدارة المتجر.</div>;
  }

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();
  const categoryId = sp.categoryId;

  const [branchesRaw, categoriesRaw, preparersRaw] = await Promise.all([
    prisma.storeBranch.findMany({
      where: categoryId ? { categoryId: categoryId } : {},
      include: {
        category: true,
        parentBranch: true,
        authorizedPreparer: true,
        _count: { select: { products: true } }
      },
      orderBy: { sequence: "asc" },
    }),
    prisma.storeCategory.findMany({
      orderBy: { sequence: "asc" },
    }),
    prisma.companyPreparer.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const branches = JSON.parse(JSON.stringify(branchesRaw));
  const categories = JSON.parse(JSON.stringify(categoriesRaw));
  const preparers = JSON.parse(JSON.stringify(preparersRaw));

  const selectedCategory = categoryId ? categories.find((c: any) => c.id === categoryId) : null;

  return (
    <div className="kse-app-bg min-h-screen px-4 py-10" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/staff/portal/store?${authQ}`} className="text-sky-600 font-bold mb-1 inline-block text-sm">← العودة لإدارة المتجر</Link>
            <h1 className="text-2xl font-black text-slate-900">
              {selectedCategory ? `أفرع قسم: ${selectedCategory.name}` : "كل الأفرع"}
            </h1>
          </div>
          {categoryId && (
            <Link
              href={`/staff/portal/store/branches?${authQ}`}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
            >
              عرض كل الأقسام
            </Link>
          )}
        </div>

        <StaffBranchListClient
          initialBranches={branches}
          categories={categories}
          preparers={preparers}
          defaultCategoryId={categoryId}
          authQ={authQ}
        />
      </div>
    </div>
  );
}
