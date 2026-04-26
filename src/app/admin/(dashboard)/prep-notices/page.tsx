import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { prisma } from "@/lib/prisma";
import { PrepNoticeForm } from "./prep-notice-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إشعارات تجهيز المجهزين — أبو الأكبر للتوصيل",
};

export default async function AdminPrepNoticesPage() {
  const [preparers, recent] = await Promise.all([
    prisma.companyPreparer.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.companyPreparerPrepNotice.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { preparer: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin/preparers" className={ad.link}>
          المجهزين
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>إشعارات تجهيز المجهزين</h1>
        <p className={`mt-2 max-w-3xl ${ad.lead}`}>
          أنشئ طلب تجهيز أو تعليماً للمجهزين المختارين — يظهر لهم <strong className="text-slate-800">شريط تنبيه</strong> فوق
          زر «تجهيز الطلبات» حتى يخفّوه بعد القراءة.
        </p>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>إنشاء إشعار جديد</h2>
        <div className="mt-4 max-w-xl">
          <PrepNoticeForm preparers={preparers} />
        </div>
      </section>

      <section className={ad.section}>
        <h2 className={ad.h2}>آخر الإشعارات</h2>
        <ul className={`mt-3 ${ad.listDivide}`}>
          {recent.length === 0 ? (
            <li className="py-3 text-sm text-slate-500">لا توجد إشعارات بعد.</li>
          ) : (
            recent.map((n) => (
              <li key={n.id} className="py-3">
                <p className={ad.listTitle}>{n.title}</p>
                <p className="text-xs text-slate-500">
                  {n.preparer.name} — {n.createdAt.toLocaleString("ar-IQ-u-nu-latn")}{" "}
                  {n.dismissedAt ? (
                    <span className="text-emerald-700">(تم الإخفاء من عند المجهز)</span>
                  ) : (
                    <span className="text-amber-700">(لم يُخفَ بعد)</span>
                  )}
                </p>
                {n.body.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
