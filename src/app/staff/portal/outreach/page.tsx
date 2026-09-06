import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import Link from "next/link";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons } from "@/lib/icon-settings";
import { serializePrisma } from "@/lib/serialize-prisma";
import { StaffOutreachClient } from "./staff-outreach-client";
import { PullToRefresh } from "@/components/pull-to-refresh";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "مهمة مراسلة الزبائن وتخزين الأرقام — أبو الأكبر للتوصيل",
};

export default async function StaffOutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ se?: string; exp?: string; s?: string }> | { se?: string; exp?: string; s?: string };
}) {
  try {
    const sp = await Promise.resolve(searchParams);
    const se = sp?.se || "";
    const exp = sp?.exp || "";
    const s = sp?.s || "";

    const v = verifyStaffEmployeePortalQuery(se, exp, s);

    if (!v.ok) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4 text-center bg-slate-50" dir="rtl">
          <div className="rounded-3xl bg-white p-8 shadow-xl border border-rose-100 max-w-sm">
            <p className="text-rose-600 font-black text-lg">عذراً، الرابط غير صالح أو انتهت صلاحيته.</p>
            <p className="text-xs text-slate-400 mt-2">يرجى فتح الصفحة من خلال بوابة الموظف الرسمية.</p>
          </div>
        </div>
      );
    }

    // التأكد التلقائي من وجود الجداول في قاعدة البيانات
    try {
      const { ensureOutreachTablesExist } = await import("@/lib/db-self-heal-outreach");
      await ensureOutreachTablesExist();
    } catch (e) {
      console.error("Self heal table error:", e);
    }

    const [emp, iconsRaw] = await Promise.all([
      prisma.staffEmployee.findUnique({
        where: { id: v.staffEmployeeId },
        select: {
          id: true,
          name: true,
          phone: true,
          active: true,
        },
      }),
      getGlobalIcons().catch(() => null),
    ]);

    if (!emp || !emp.active) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4 text-center bg-slate-50" dir="rtl">
          <div className="rounded-3xl bg-white p-8 shadow-xl border border-amber-100 max-w-sm">
            <p className="text-amber-600 font-black text-lg">الحساب غير مفعّل أو تم إيقافه.</p>
            <p className="text-xs text-slate-400 mt-2">يرجى مراجعة الإدارة.</p>
          </div>
        </div>
      );
    }

    const icons = serializePrisma(iconsRaw);
    const authQ = new URLSearchParams({
      se: se,
      exp: exp,
      s: s,
    }).toString();

    return (
      <div className="kse-app-bg min-h-screen px-3 py-6 text-slate-800" dir="rtl">
        <PullToRefresh />
        <div className="kse-app-inner mx-auto max-w-2xl">
          {/* شريط التنقل العلوي */}
          <div className="mb-4 flex items-center justify-between">
            <Link
              href={`/staff/portal?${authQ}`}
              className="flex items-center gap-1.5 rounded-2xl bg-white/80 px-4 py-2 text-xs font-black text-slate-700 shadow-sm border border-slate-200 backdrop-blur hover:bg-white active:scale-95 transition"
            >
              <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="w-4 h-4" />
              <span>العودة للرئيسية</span>
            </Link>

            <div className="text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-black text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {emp.name}
              </span>
            </div>
          </div>

          {/* المكون التفاعلي الرئيسي */}
          <StaffOutreachClient
            staffId={emp.id}
            token={exp}
            sig={s}
            authQ={authQ}
            icons={icons}
          />
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center bg-slate-50" dir="rtl">
        <div className="rounded-3xl bg-white p-8 shadow-xl border border-rose-100 max-w-sm">
          <p className="text-rose-600 font-black text-lg">حدث خطأ أثناء تحميل الصفحة</p>
          <p className="text-xs text-slate-500 mt-2">{error?.message || "يرجى إعادة المحاولة"}</p>
        </div>
      </div>
    );
  }
}
