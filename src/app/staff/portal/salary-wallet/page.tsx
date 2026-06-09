import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { checkAndApplyMonthlySalary } from "@/lib/staff-salary";
import Link from "next/link";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons } from "@/lib/icon-settings";
import { serializePrisma } from "@/lib/serialize-prisma";
import { SalaryWalletClient } from "./salary-wallet-client";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";

export const dynamic = "force-dynamic";

function translateDraftStatus(status: string): string {
  switch (status) {
    case "draft":
      return "مسودة";
    case "priced":
      return "مُسعّرة";
    case "sent":
      return "مُرسلة";
    case "archived":
      return "مرفوضة/مؤرشفة";
    default:
      return status;
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case "sent": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "priced": return "bg-sky-100 text-sky-800 border-sky-200";
    case "archived": return "bg-slate-100 text-slate-800 border-slate-200";
    default: return "bg-amber-100 text-amber-800 border-amber-200";
  }
}

export default async function StaffSalaryWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ se?: string; exp?: string; s?: string }>;
}) {
  const { se, exp, s } = await searchParams;
  const v = verifyStaffEmployeePortalQuery(se || "", exp || "", s || "");

  if (!v.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 shadow-xl border border-rose-100 max-w-sm">
          <p className="text-rose-600 font-black text-lg">عذراً، الرابط غير صالح أو انتهت صلاحيته.</p>
          <p className="text-xs text-slate-400 mt-2">يرجى طلب رابط دخول جديد من الإدارة.</p>
        </div>
      </div>
    );
  }

  // 1. تطبيق تحديث الراتب التلقائي للشهر الجديد إن وجد
  await checkAndApplyMonthlySalary(v.staffEmployeeId);

  // 2. جلب معلومات الموظف مع المعاملات
  const staff = await prisma.staffEmployee.findUnique({
    where: { id: v.staffEmployeeId },
    include: {
      staffTransactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!staff || !staff.active) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 shadow-xl border border-slate-100 max-w-sm">
          <p className="text-red-600 font-black text-lg">الحساب غير موجود أو غير مفعل.</p>
        </div>
      </div>
    );
  }

  const icons = await getGlobalIcons();
  const authQ = `se=${se}&exp=${exp}&s=${s}`;

  // حساب إجمالي أرباح المبيعات (العمولات التي استلمها بيده في هذا الشهر)
  // لتسهيل الحسبة، سنقوم بجمع العمولات للـ receive_profit
  const totalReceivedProfits = staff.staffTransactions
    .filter(t => t.type === "receive_profit")
    .reduce((acc, t) => acc + Number(t.profit), 0);

  // جلب الطلبات التي رفعها هذا الموظف ولم يتم تسوية أرباحها بعد، وحالتها "تم التسليم"
  const orders = await prisma.order.findMany({
    where: {
      preparerShoppingJson: {
        path: ["staffId"],
        equals: staff.id,
      },
      status: "delivered",
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingOrders = orders.filter((o) => {
    const json = o.preparerShoppingJson as any;
    return json && json.staffProfit && !json.profitSettled;
  });

  // جلب الطلبات المرفوعة (المسودات وطلبات الوجهتين) لعرضها داخل المحفظة
  const [drafts, doubleOrders] = await Promise.all([
    prisma.companyPreparerShoppingDraft.findMany({
      where: {
        OR: [
          { preparerId: staff.id },
          { data: { path: ["fromStaffEmployeeId"], equals: staff.id } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        preparer: { select: { name: true } },
        customerRegion: { select: { name: true } },
      }
    }),
    prisma.order.findMany({
      where: {
        submissionSource: "staff_portal",
        preparerShoppingJson: { path: ["staffId"], equals: staff.id }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        customerRegion: { select: { name: true } },
        secondCustomerRegion: { select: { name: true } },
      }
    })
  ]);

  const draftRows = drafts.map((d) => {
    const draftData = (d.data as any) || {};
    return {
      id: d.id,
      orderNumber: "---",
      status: d.status,
      type: "تجهيز تسوق",
      sellerPhone: d.customerPhone || "—",
      sellerRegion: d.customerRegion?.name || "—",
      profit: 0,
      profitSettled: false,
      createdAt: d.createdAt.toISOString(),
      summary: d.titleLine || d.rawListText || "طلب تجهيز",
    };
  });

  const orderRows = doubleOrders.map((o) => {
    const json = o.preparerShoppingJson as any;
    return {
      id: o.id,
      orderNumber: `#${o.orderNumber}`,
      status: o.status,
      type: o.orderType || "طلب وجهتين",
      sellerPhone: o.customerPhone || "—",
      buyerPhone: o.secondCustomerPhone || "—",
      sellerRegion: o.customerRegion?.name || "—",
      buyerRegion: o.secondCustomerRegion?.name || "—",
      profit: Number(json?.staffProfit || 0),
      profitSettled: !!json?.profitSettled,
      createdAt: o.createdAt.toISOString(),
      summary: o.summary || "",
    };
  });

  const cardRows = [...draftRows, ...orderRows].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const serializedStaff = serializePrisma(staff);
  const serializedIcons = serializePrisma(icons);
  const serializedPendingOrders = serializePrisma(pendingOrders);
  const serializedSubmittedRows = serializePrisma(cardRows);

  return (
    <main className="min-h-screen bg-slate-50/50 px-4 py-8 pb-24 font-sans text-slate-800" dir="rtl">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <Link
            href={`/staff/portal?${authQ}`}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-600 active:scale-95 transition-all"
          >
            <DynamicIcon iconKey="ui_arrow_right" config={icons} className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-black text-slate-900">المحفظة والرواتب</h1>
          <div className="w-10"></div>
        </header>

        {/* الكلاينت كومبوننت لتشغيل المعاملات التفاعلية والواتساب */}
        <SalaryWalletClient 
          staff={serializedStaff} 
          icons={serializedIcons} 
          authQ={authQ} 
          se={se || ""}
          exp={exp || ""}
          s={s || ""}
          totalReceivedProfits={totalReceivedProfits}
          pendingOrders={serializedPendingOrders}
          submittedRows={serializedSubmittedRows}
        />
      </div>
    </main>
  );
}
