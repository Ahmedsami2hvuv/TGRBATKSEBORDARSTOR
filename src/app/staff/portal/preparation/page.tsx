import Link from "next/link";
import type { StaffEmployeePortalVerifyReason } from "@/lib/staff-employee-portal-link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { StaffPreparationClient } from "./staff-preparation-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ se?: string; exp?: string; s?: string }>;
};

function invalidMessage(reason: StaffEmployeePortalVerifyReason): string {
  switch (reason) {
    case "missing":
      return "الرابط غير مكتمل. تأكد من نسخه كاملاً.";
    case "bad_signature":
      return "الرابط غير صالح. اطلب رابطاً جديداً من الإدارة.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل.";
  }
}

export default async function StaffPreparationPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة التجهيز</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    select: { id: true, name: true, active: true, portalToken: true },
  });

  if (!staff || !staff.active || staff.portalToken !== v.token) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة التجهيز</p>
            <p className="mt-2 text-sm text-slate-600">الحساب غير مفعّل أو الرابط غير صالح.</p>
          </div>
        </div>
      </div>
    );
  }

  const preparers = await prisma.companyPreparer.findMany({
    where: {
      active: true,
      notes: { not: { contains: "[SUPPLIER]" } },
    },
    select: { id: true, name: true, availableForAssignment: true },
    orderBy: { name: "asc" },
  });

  const auth = { se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" };
  const authQ = new URLSearchParams(auth).toString();

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-16 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-2xl">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/staff/portal?${authQ}`}
            className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
          >
            ← رجوع
          </Link>
          <Link
            href={`/staff/portal/submitted?${authQ}`}
            className="inline-flex items-center justify-center rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-900 shadow-sm transition hover:bg-violet-100"
          >
            الطلبات المرفوعة
          </Link>
        </div>

        <StaffPreparationClient
          staffName={staff.name}
          auth={auth}
          preparers={preparers.map((p) => ({
            id: p.id,
            name: p.name,
            available: p.availableForAssignment,
          }))}
        />
      </div>
    </div>
  );
}
