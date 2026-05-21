import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { StaffEmployeesManager } from "./staff-employees-manager";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildStaffEmployeePortalUrl } from "@/lib/staff-employee-portal-link";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

import { serializePrisma } from "@/lib/serialize-prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الموظفين — أبو الأكبر للتوصيل",
};

export default async function AdminEmployeesHubPage() {
  const [employeesRaw, iconsRaw] = await Promise.all([
    prisma.staffEmployee.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    getGlobalIcons()
  ]);

  const icons = serializePrisma(iconsRaw);
  const baseUrl = getPublicAppUrl();
  const rows = employeesRaw.map((e) => ({
    id: e.id,
    name: e.name,
    phone: e.phone,
    active: e.active,
    canSubmitOrders: e.canSubmitOrders,
    canViewArchived: e.canViewArchived,
    canManageStore: e.canManageStore,
    createdAt: e.createdAt,
    portalUrl: buildStaffEmployeePortalUrl(e.id, e.portalToken, baseUrl),
  }));

  return (
    <div className="space-y-6">
      <p className={ad.muted}>
        <Link href="/abo1stor3hlaa2kbr8-47" className={`${ad.link} flex items-center gap-1`}>
          <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="w-3 h-3" />
          الرئيسية
        </Link>
      </p>

      <header className={ad.section}>
        <h1 className={ad.h1}>الموظفين</h1>
        <p className="mt-2 inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700">
          نسخة الواجهة: v0d09b87
        </p>
        <p className={`mt-1 ${ad.lead}`}>
          هذا القسم خاص بموظفي الإدارة/الشركة ككيان مستقل. أنشئ موظفاً ثم افتح صفحته لإدارة حساباته.
        </p>
      </header>

      <section className={ad.section}>
        <StaffEmployeesManager initialEmployees={serializePrisma(rows)} icons={icons} />
      </section>
    </div>
  );
}

