import Link from "next/link";
import type { StaffEmployeePortalVerifyReason } from "@/lib/staff-employee-portal-link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { StaffDoubleOrderClient } from "./staff-double-order-client";
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

export default async function StaffDoubleOrderPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
  if (!v.ok) {
    return (
      <div className="kse-app-bg flex min-h-screen flex-col px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">تعذّر فتح صفحة الطلب</p>
            <p className="mt-2 text-sm text-slate-600">{invalidMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  const [staff, icons] = await Promise.all([
    prisma.staffEmployee.findUnique({
      where: { id: v.staffEmployeeId },
      select: { id: true, name: true, active: true },
    }),
    getGlobalIcons(),
  ]);

  if (!staff || !staff.active) {
     return <div className="p-8 text-center font-bold">الحساب غير مفعّل.</div>;
  }

  const auth = { se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" };
  const authQ = new URLSearchParams(auth).toString();

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
        </div>

        <div className="kse-glass-dark rounded-3xl border border-sky-200 p-6 shadow-xl">
            <h1 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                <DynamicIcon iconKey="ui_map" config={icons} className="w-6 h-6 text-sky-600" fallback={<span>📍</span>} />
                رفع طلب ذو وجهتين
            </h1>
            <StaffDoubleOrderClient
                auth={auth}
                icons={icons}
            />
        </div>
      </div>
    </div>
  );
}
