import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { StaffProductListClient } from "./staff-product-list-client";

export const dynamic = "force-dynamic";

export default async function StaffProductListPage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const emp = await prisma.staffEmployee.findUnique({ where: { id: v.staffEmployeeId } });
  if (!emp || !emp.active || !emp.canManageStore) {
    return <div className="p-8 text-center font-bold text-rose-600">ليس لديك صلاحية.</div>;
  }

  const managedBranchIds = emp.branchIds || [];

  const [products, branches, suppliers] = await Promise.all([
    prisma.storeProduct.findMany({
      where: {
        branchId: { in: managedBranchIds }
      },
      include: {
        branch: { include: { category: true } },
        variants: { orderBy: { sequence: "asc" } },
        supplier: true
      },
      orderBy: [{ branchId: "asc" }, { sequence: "asc" }]
    }),
    prisma.storeBranch.findMany({
      where: {
        id: { in: managedBranchIds }
      },
      include: { category: true },
      orderBy: { sequence: "asc" }
    }),
    prisma.storeSupplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    })
  ]);

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  return (
    <div className="kse-app-bg min-h-screen px-4 py-10 text-slate-800" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/staff/portal/store?${authQ}`} className="text-sky-600 font-bold mb-2 inline-block">← العودة للإدارة</Link>
            <h1 className="text-3xl font-black text-slate-900">إدارة المنتجات</h1>
          </div>
        </div>

        <Suspense fallback={<div className="p-20 text-center font-bold text-slate-400">جاري تحميل البيانات...</div>}>
          <StaffProductListClient
            initialProducts={products}
            branches={branches}
            suppliers={suppliers}
            authQ={authQ}
          />
        </Suspense>
      </div>
    </div>
  );
}

import { Suspense } from "react";
