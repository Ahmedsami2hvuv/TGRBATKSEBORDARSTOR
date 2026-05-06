import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildDelegatePortalUrl } from "@/lib/delegate-link";
import { buildCourierShareMessage, whatsappAppUrl } from "@/lib/whatsapp";
import { CourierForm } from "./courier-form";
import { CourierDeleteForm } from "./courier-delete-form";
import { CourierResetButton } from "./courier-reset-button";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المندوبين — أبو الأكبر للتوصيل",
};

export default async function AdminCouriersPage() {
  const [couriers, icons] = await Promise.all([
    prisma.courier.findMany({
      orderBy: { name: "asc" },
    }),
    getGlobalIcons(),
  ]);

  const baseUrl = getPublicAppUrl();

  return (
    <div className="space-y-8">
      <p className={ad.muted}>
        <Link href="/admin" className={`${ad.link} flex items-center gap-1`}>
          <DynamicIcon config={icons} iconKey="ui_home" fallback="←" className="w-4 h-4" />
          الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>المندوبين</h1>
        <p className="mt-2">
          <Link href="/admin/couriers/map" className={`${ad.link} flex items-center gap-2`}>
            <DynamicIcon config={icons} iconKey="ui_map" fallback="🗺️" className="w-5 h-5" />
            خريطة مواقع المندوبين (آخر موقع مُبلّغ)
          </Link>
        </p>
        <p className={`mt-1 ${ad.lead}`}>
          <strong className="text-amber-800">مندوب التوصيل</strong> كيان مستقل في قاعدة
          البيانات — لا يُخلط مع{" "}
          <Link href="/admin/shops" className={ad.link}>
            موظفي المحلات
          </Link>{" "}
          الذين يرفعون طلبات الزبائن فقط. يظهر المندوب في{" "}
          <Link href="/admin/orders/pending" className={ad.link}>
            الطلبات الجديدة
          </Link>{" "}
          عند الإسناد.
        </p>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>إضافة مندوب</h2>
        <p className={`mt-1 text-sm ${ad.muted}`}>
          أو استخدم{" "}
          <Link href="/admin/couriers/new" className={ad.link}>
            صفحة مفصولة
          </Link>
          .
        </p>
        <div className="mt-4">
          <CourierForm />
        </div>
      </section>

      <section className={ad.section}>
        <h2 className={ad.h2}>القائمة</h2>
        {couriers.length === 0 ? (
          <p className={`mt-3 ${ad.muted}`}>لا يوجد مندوبون بعد.</p>
        ) : (
          <ul className={`${ad.listDivide} mt-3`}>
            {couriers.map((c) => {
              const mandoubUrl = buildDelegatePortalUrl(c.id, baseUrl);
              const shareText = buildCourierShareMessage({
                courierName: c.name,
                delegatePortalUrl: mandoubUrl,
              });
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-4"
                >
                  <div>
                    <p className={ad.listTitle}>{c.name}</p>
                    <p className={`${ad.listMuted} tabular-nums`}>{c.phone}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={whatsappAppUrl(c.phone, shareText)}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-md ring-1 ring-amber-300/50 transition hover:from-amber-300 hover:to-amber-400"
                      >
                        <DynamicIcon config={icons} iconKey="ui_whatsapp" fallback="💬" className="w-4 h-4" />
                        واتساب: رابط لوحة المندوب
                      </a>
                      <a
                        href={mandoubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-500/60 bg-sky-950/50 px-3 py-1.5 text-xs font-bold text-sky-100"
                      >
                        <DynamicIcon config={icons} iconKey="ui_external_link" fallback="↗" className="w-4 h-4" />
                        معاينة اللوحة
                      </a>
                      <CourierResetButton courierId={c.id} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/admin/couriers/${c.id}/edit`}
                      className={`text-sm ${ad.link} flex items-center gap-1`}
                    >
                      <DynamicIcon config={icons} iconKey="ui_edit" fallback="تعديل" className="w-4 h-4" />
                      تعديل
                    </Link>
                    <CourierDeleteForm id={c.id} name={c.name} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
