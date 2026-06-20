import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { serializePrisma } from "@/lib/serialize-prisma";
import { StrongAlertClient } from "./strong-alert-client";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "التنبيه القوي 🚨 — أبو الأكبر للتوصيل",
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default async function AdminStrongAlertPage() {
  try {
    const [couriersRaw, preparersRaw, employeesRaw, iconsRaw] = await Promise.all([
      prisma.courier.findMany({
        where: { hiddenFromReports: false },
        orderBy: { name: "asc" },
      }),
      prisma.companyPreparer.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      prisma.staffEmployee.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      getGlobalIcons(),
    ]);

    const couriers = serializePrisma(couriersRaw);
    const preparers = serializePrisma(preparersRaw);
    const employees = serializePrisma(employeesRaw);
    const icons = serializePrisma(iconsRaw);

    return (
      <div className="space-y-6">
        <p className={ad.muted}>
          <Link href={SECRET_ADMIN_PATH} className={`${ad.link} flex items-center gap-1`}>
            <DynamicIcon config={icons} iconKey="ui_home" fallback="←" className="w-4 h-4" />
            الرئيسية
          </Link>
        </p>
        <div>
          <h1 className={`${ad.h1} text-red-600 flex items-center gap-2`}>
            <span>التنبيه القوي (الاستدعاء العاجل)</span>
            <span className="inline-block w-3.5 h-3.5 rounded-full bg-red-600 animate-ping"></span>
          </h1>
          <p className={`mt-2 ${ad.lead}`}>
            من خلال هذه الصفحة يمكنك إرسال تنبيه صوتي عالٍ جداً ومستمر مع اهتزاز قوي لهواتف المندوبين أو المجهزين أو الموظفين، لتنبيههم في حالة وجود أمر طارئ، حتى لو كانت هواتفهم مضبوطة على الوضع الصامت.
          </p>
        </div>

        <StrongAlertClient 
          couriers={couriers} 
          preparers={preparers} 
          employees={employees} 
        />
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-4 bg-red-950/20 border border-red-900 rounded-lg text-red-400">
        <p>حدث خطأ أثناء تحميل بيانات الصفحة:</p>
        <p className="mt-1 font-mono text-xs">{error.message}</p>
      </div>
    );
  }
}
