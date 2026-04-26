import Link from "next/link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StaffPortalPage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const emp = await prisma.staffEmployee.findUnique({ where: { id: v.staffEmployeeId } });
  if (!emp || !emp.active) return <div className="p-8 text-center font-bold">الحساب غير مفعّل.</div>;

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  return (
    <div className="kse-app-bg min-h-screen px-4 py-10 text-slate-800" dir="rtl">
      <div className="kse-app-inner mx-auto max-w-md">
        <div className="kse-glass-dark rounded-3xl border border-sky-200 p-8 text-center shadow-xl">
          <p className="text-xs font-black uppercase tracking-widest text-sky-800/60">أبو الأكبر للتوصيل</p>
          <h1 className="mt-4 text-2xl font-black text-slate-900">بوابة الموظف</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">أهلاً بك، <span className="text-sky-900">{emp.name}</span></p>
          
          <div className="mt-8 grid gap-3">
            {emp.canSubmitOrders && (
              <>
                <Link
                  href={`/staff/portal/preparation?${authQ}`}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 py-4 text-sm font-black text-white shadow-lg transition active:scale-95"
                >
                  🚀 إنشاء طلب تجهيز ذكي (تحليل)
                </Link>

                <Link
                  href={`/staff/portal/submitted?${authQ}`}
                  className="w-full rounded-2xl border-2 border-sky-400 bg-white py-4 text-sm font-black text-sky-900 shadow-sm transition hover:bg-sky-50 active:scale-95"
                >
                  📑 الطلبات المرفوعة حالياً
                </Link>
              </>
            )}

            {emp.canViewArchived && (
              <Link
                href={`/staff/portal/archived?${authQ}`}
                className="w-full rounded-2xl border-2 border-slate-300 bg-slate-50 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95"
              >
                📦 الأرشيف (الطلبات القديمة)
              </Link>
            )}

            {emp.canManageStore && (
              <Link
                href={`/staff/portal/store?${authQ}`}
                className="w-full rounded-2xl border-2 border-purple-400 bg-white py-4 text-sm font-black text-purple-900 shadow-sm transition hover:bg-purple-50 active:scale-95"
              >
                🏪 إدارة المتجر (الأقسام والمنتجات)
              </Link>
            )}

            {!emp.canSubmitOrders && !emp.canViewArchived && !emp.canManageStore && (
              <p className="p-4 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl">
                ليس لديك أي صلاحيات نشطة حالياً. يرجى مراجعة المسؤول.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}