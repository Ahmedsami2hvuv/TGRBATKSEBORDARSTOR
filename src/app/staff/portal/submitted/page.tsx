import Link from "next/link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { StaffSubmittedClient } from "./staff-submitted-client";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { se?: string; exp?: string; s?: string };
};

function translateDraftStatus(status: string): string {
  switch (status) {
    case "draft":
      return "مسودة";
    case "priced":
      return "مُسعّرة";
    case "sent":
      return "مُرسلة";
    case "archived":
      return "مؤرشفة";
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

export default async function StaffSubmittedDraftsPage({ searchParams }: Props) {
  try {
    const sp = searchParams;
    const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
    if (!v.ok) {
      return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;
    }

    const staff = await prisma.staffEmployee.findUnique({
      where: { id: v.staffEmployeeId },
      select: { id: true, name: true, active: true, portalToken: true },
    });

    if (!staff || !staff.active || staff.portalToken !== v.token) {
      return <div className="p-8 text-center font-bold text-rose-600">الحساب غير مفعّل أو الرابط غير صالح.</div>;
    }

    const drafts = await prisma.companyPreparerShoppingDraft.findMany({
      where: {
        OR: [
          { preparerId: staff.id },
          {
            data: {
              path: ["fromStaffEmployeeId"],
              equals: staff.id,
            },
          }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        preparer: { select: { name: true } },
        customerRegion: { select: { name: true } },
      }
    });

    const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

    // Nuclear Sanitization for Next.js 15 Serialization Safety
    function deepSanitize(obj: any): any {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === "bigint") return obj.toString();
      if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") return obj;
      if (obj instanceof Date) return obj.toISOString();
      if (Array.isArray(obj)) return obj.map(deepSanitize);
      if (typeof obj === "object") {
        // Handle Decimal.js / Prisma Decimal
        if (obj.d && obj.s && obj.e !== undefined) return Number(obj.toString());
        const newObj: any = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = deepSanitize(obj[key]);
        }
        return newObj;
      }
      return obj;
    }

    const tableRows: MandoubRow[] = drafts.map((d) => {
      const draftData = (d.data as any) || {};
      return {
        id: d.id,
        shortId: "---",
        orderStatus: d.status,
        shopName: d.titleLine || "تجهيز تسوق",
        shopNameHighlightClass: "text-slate-900 font-black",
        regionLine: d.customerRegion?.name || "—",
        orderType: "تجهيز",
        priceStr: "—",
        delStr: "—",
        customerPhone: d.customerPhone || "—",
        timeLine: formatBaghdadDateTime(d.createdAt, { dateStyle: "short", timeStyle: "short" }),
        statusAr: translateDraftStatus(d.status),
        statusClass: `text-[10px] px-2 py-0.5 rounded-full border ${getStatusClass(d.status)}`,
        prepaidAll: false,
        reversePickup: false,
        hasCustomerLocation: !!d.customerLocationUrl,
        hasCourierUploadedLocation: false,
        hasMoneyDeletedBadge: false,
        wardMismatchType: "none",
        saderMismatchType: "none",
        noWardRecorded: true,
        noSaderRecorded: true,
        createdAt: d.createdAt,
        // بيانات الوصول السريع الموحدة
        audioUrl: draftData.audioUrl || null,
        summary: d.rawListText,
        shopPhone: "",
        alternatePhone: "",
        secondCustomerPhone: "",
        shopLocationUrl: "",
        customerLocationUrl: d.customerLocationUrl,
        secondCustomerLocationUrl: "",
        shopDoorPhotoUrl: "",
        customerDoorPhotoUrl: d.customerDoorPhotoUrl,
        routeMode: "single",
        preparerAudioUrl: draftData.preparerAudioUrl || null,
        adminAudioUrl: null,
      };
    });

    const sanitizedRows = deepSanitize(tableRows);

    return (
      <div className="kse-app-bg min-h-screen px-2 py-4 pb-16 text-slate-800 sm:px-4 sm:py-8" dir="rtl">
        <div className="kse-app-inner mx-auto max-w-4xl">
          <div className="mb-3 text-sm">
            <Link href={`/staff/portal?${authQ}`} className="font-bold text-sky-700 hover:underline">
              ← الرجوع إلى بوابة الموظف
            </Link>
          </div>

          <header className="kse-glass-dark mb-4 rounded-2xl border border-sky-200 p-4 shadow-sm">
            <h1 className="text-xl font-black text-slate-900">الطلبات المرفوعة للتجهيز</h1>
            <p className="mt-1 text-sm text-slate-600">
              الموظف: <span className="font-black text-sky-900">{staff.name}</span>
            </p>
          </header>

          {tableRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 py-12 text-center">
              <p className="text-sm font-bold text-slate-400">لا توجد طلبات مرفوعة حالياً.</p>
            </div>
          ) : (
            <section className="kse-glass-dark overflow-hidden border border-slate-200 shadow-sm">
               <StaffSubmittedClient rows={sanitizedRows} authQ={authQ} />
            </section>
          )}
        </div>
      </div>
    );

  } catch (error) {
    console.error("staff portal submitted list page failed", error);
    return (
      <div className="kse-app-bg min-h-screen px-4 py-8 text-slate-800" dir="rtl">
        <div className="kse-app-inner mx-auto max-w-2xl">
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-8 text-center">
            <h1 className="text-xl font-black text-rose-700">حدث خطأ أثناء تحميل البيانات</h1>
          </div>
        </div>
      </div>
    );
  }
}
