import Link from "next/link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

import { StaffPortalMenuClient } from "./staff-portal-menu-client";

export default async function StaffPortalPage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;

  const emp = await prisma.staffEmployee.findUnique({ where: { id: v.staffEmployeeId } });
  if (!emp || !emp.active) return <div className="p-8 text-center font-bold">الحساب غير مفعّل.</div>;

  const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

  // Serialization fix for Next.js 15
  function deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return obj.toString();
    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    if (typeof obj === "object") {
      const newObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = deepSanitize(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  const sanitizedEmp = deepSanitize(emp);

  return (
    <div className="kse-app-bg min-h-screen px-4 py-10 text-slate-800" dir="rtl">
      <div className="kse-app-inner mx-auto max-w-md">
        <div className="kse-glass-dark rounded-3xl border border-sky-200 p-8 text-center shadow-xl">
          <p className="text-xs font-black uppercase tracking-widest text-sky-800/60">أبو الأكبر للتوصيل</p>
          <h1 className="mt-4 text-2xl font-black text-slate-900">بوابة الموظف</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">أهلاً بك، <span className="text-sky-900">{emp.name}</span></p>
          
          <StaffPortalMenuClient emp={sanitizedEmp} authQ={authQ} />
        </div>
      </div>
    </div>
  );
}