import Link from "next/link";
import type { StaffEmployeePortalVerifyReason } from "@/lib/staff-employee-portal-link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { StaffPreparationClient } from "./staff-preparation-client";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

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

  const [staff, rawPreparers, storeSuppliers, icons] = await Promise.all([
    prisma.staffEmployee.findUnique({
      where: { id: v.staffEmployeeId },
      select: { id: true, name: true, active: true, portalToken: true },
    }),
    prisma.companyPreparer.findMany({
      where: {
        active: true,
        availableForAssignment: true,
      },
      select: { id: true, name: true, notes: true, availableForAssignment: true },
      orderBy: { name: "asc" },
    }),
    prisma.storeSupplier.findMany({
      where: {
        active: true,
      },
      select: { id: true, name: true, phone: true, active: true },
      orderBy: { name: "asc" },
    }),
    getGlobalIcons(),
  ]);

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

  // دمج المجهزين والموردين المتاحين فقط بدون عمليات كتابة متزامنة
  const combinedList: Array<{ id: string; name: string; available: boolean; isSupplier: boolean }> = [];
  const addedIds = new Set<string>();

  for (const p of rawPreparers) {
    if (!addedIds.has(p.id) && p.availableForAssignment !== false) {
      addedIds.add(p.id);
      combinedList.push({
        id: p.id,
        name: p.name,
        available: true,
        isSupplier: Boolean(p.notes?.includes("[SUPPLIER]")),
      });
    }
  }

  for (const s of storeSuppliers) {
    if (!addedIds.has(s.id) && s.active !== false) {
      addedIds.add(s.id);
      combinedList.push({
        id: s.id,
        name: s.name,
        available: true,
        isSupplier: true,
      });
    }
  }

  combinedList.sort((a, b) => a.name.localeCompare(b.name, "ar"));

  // دالة التطهير العميقة لضمان توافق Next.js 15
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

  const auth = { se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" };
  const authQ = new URLSearchParams(auth).toString();

  // Serialization fix for Next.js 15
  const sanitizedStaff = deepSanitize(staff);
  const sanitizedPreparers = deepSanitize(combinedList);

  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 pb-16 text-slate-800">
      <div className="kse-app-inner mx-auto max-w-2xl">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/staff/portal?${authQ}`}
            className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100 gap-2"
          >
            <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="w-4 h-4" />
            رجوع
          </Link>
          <Link
            href={`/staff/portal/submitted?${authQ}`}
            className="inline-flex items-center justify-center rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-900 shadow-sm transition hover:bg-violet-100 gap-2"
          >
            <DynamicIcon iconKey="ui_tasks" config={icons} fallback="📑" className="w-4 h-4" />
            الطلبات المرفوعة
          </Link>
        </div>

        <StaffPreparationClient
          staffName={sanitizedStaff.name}
          auth={auth}
          preparers={sanitizedPreparers}
          icons={icons}
        />
      </div>
    </div>
  );
}
