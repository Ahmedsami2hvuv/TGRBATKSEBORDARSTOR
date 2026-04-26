import Link from "next/link";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { whatsappMeUrl } from "@/lib/whatsapp";

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
      return "مُرسلة بالنظام";
    case "archived":
      return "مؤرشفة";
    default:
      return status;
  }
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default async function StaffSubmittedDraftsPage({ searchParams }: Props) {
  try {
    const sp = searchParams;
    const v = verifyStaffEmployeePortalQuery(sp.se, sp.exp, sp.s);
    if (!v.ok) {
      return <div className="p-8 text-center font-bold text-rose-600">الرابط غير صالح.</div>;
    }

    // التحقق من الموظف وجلب المسودات بالتوازي لتسريع الاستجابة
    const staff = await prisma.staffEmployee.findUnique({
      where: { id: v.staffEmployeeId },
      select: { id: true, name: true, active: true, portalToken: true },
    });

    if (!staff || !staff.active || staff.portalToken !== v.token) {
      return <div className="p-8 text-center font-bold text-rose-600">الحساب غير مفعّل أو الرابط غير صالح.</div>;
    }

    let drafts = [];
    try {
      // استخدام استعلام أسرع مع تحديد الحقول بدقة
      drafts = await prisma.companyPreparerShoppingDraft.findMany({
        where: {
          OR: [
            { preparerId: staff.id }, // إذا كان هو المجهز
            {
              data: {
                path: ["fromStaffEmployeeId"],
                equals: staff.id,
              },
            }
          ]
        },
        orderBy: { createdAt: "desc" },
        take: 20, // تقليل العدد أكثر لسرعة التحميل الأولي
        select: {
          id: true,
          status: true,
          titleLine: true,
          customerPhone: true,
          customerName: true,
          orderTime: true,
          createdAt: true,
          preparer: { select: { name: true } },
        },
      });
    } catch (error) {
      console.error("staff portal submitted query failed", error);
      drafts = [];
    }

    const authQ = new URLSearchParams({ se: sp.se ?? "", exp: sp.exp ?? "", s: sp.s ?? "" }).toString();

    return (
      <div className="kse-app-bg min-h-screen px-4 py-8 pb-16 text-slate-800" dir="rtl">
        <div className="kse-app-inner mx-auto max-w-2xl">
          <div className="mb-3 text-sm">
            <Link href={`/staff/portal?${authQ}`} className="font-bold text-sky-700 hover:underline">
              ← الرجوع إلى بوابة الموظف
            </Link>
          </div>

          <header className="kse-glass-dark rounded-2xl border border-sky-200 p-5">
            <h1 className="text-xl font-black text-slate-900">الطلبات المرفوعة للتجهيز</h1>
            <p className="mt-1 text-sm text-slate-600">
              الموظف: <span className="font-black text-sky-900">{staff.name}</span>
            </p>
          </header>

          {drafts.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center text-sm text-amber-950 font-bold">
              لا توجد طلبات تجهيز مرفوعة حالياً.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {drafts.map((d) => {
                const href = `/staff/portal/submitted/${d.id}?${authQ}`;
                const canEdit = d.status !== "sent" && d.status !== "archived";
                return (
                  <div key={d.id} className="kse-glass-dark rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900">{d.titleLine || "—"}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-xs text-slate-500 font-mono" dir="ltr">
                            {(d.customerPhone || "—").trim()}
                          </p>
                          {d.customerPhone && (
                            <a
                              href={whatsappMeUrl(String(d.customerPhone || ""))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                              title="تواصل عبر الواتساب"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          المجهّز: <span className="font-bold text-slate-800">{d.preparer?.name || "غير معروف"}</span>
                          {"  "}—{"  "}
                          الحالة: <span className={`font-bold px-2 py-0.5 rounded ${d.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{translateDraftStatus(d.status)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <Link
                          href={href}
                          className={`rounded-xl px-4 py-2 text-xs font-black transition-all active:scale-95 flex items-center gap-1 ${
                            canEdit
                              ? "bg-sky-600 text-white hover:bg-sky-700 shadow-md"
                              : "bg-slate-200 text-slate-600 border border-slate-300"
                          }`}
                        >
                          {canEdit ? "فتح / تعديل" : "عرض التفاصيل"}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error("staff portal submitted list page failed", error);
    return (
      <div className="kse-app-bg min-h-screen px-4 py-8 pb-16 text-slate-800" dir="rtl">
        <div className="kse-app-inner mx-auto max-w-2xl">
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-8 text-center">
            <h1 className="text-xl font-black text-rose-700">تعذّر عرض الطلبات المرفوعة</h1>
            <p className="mt-2 text-sm text-slate-600">حدث خطأ غير متوقع أثناء تحميل الصفحة. حاول التحديث أو العودة لاحقاً.</p>
          </div>
        </div>
      </div>
    );
  }
}
