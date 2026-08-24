import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildDelegatePortalUrl } from "@/lib/delegate-link";
import { buildCourierShareMessage, whatsappAppUrl } from "@/lib/whatsapp";
import { CourierForm } from "./courier-form";
import { CourierDeleteForm } from "./courier-delete-form";
import { CourierResetButton } from "./courier-reset-button";
import { CourierChatToggle } from "./courier-chat-toggle";
import { CourierHideToggle } from "./courier-hide-toggle";

import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المندوبين — أبو الأكبر للتوصيل",
};

import { serializePrisma } from "@/lib/serialize-prisma";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default async function AdminCouriersPage() {
  try {
    const [couriersRaw, iconsRaw] = await Promise.all([
      prisma.courier.findMany({
        include: {
          _count: {
            select: {
              orders: true,
              moneyEvents: true,
              miscWalletEntries: true,
              walletTransfersOut: true,
              walletTransfersIn: true,
            },
          },
          orders: {
            take: 1,
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true, createdAt: true },
          },
          moneyEvents: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          },
          miscWalletEntries: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          },
        },
      }),
      getGlobalIcons(),
    ]);

    const couriersProcessed = couriersRaw.map((c) => {
      const totalActivities =
        c._count.orders +
        c._count.moneyEvents +
        c._count.miscWalletEntries +
        c._count.walletTransfersOut +
        c._count.walletTransfersIn;

      const dates = [
        c.orders[0]?.updatedAt,
        c.orders[0]?.createdAt,
        c.moneyEvents[0]?.createdAt,
        c.miscWalletEntries[0]?.createdAt,
      ]
        .filter(Boolean)
        .map((d) => new Date(d!).getTime());

      const latestActivityTime = totalActivities > 0 && dates.length > 0 ? Math.max(...dates) : 0;

      return {
        ...c,
        hasActivity: totalActivities > 0,
        totalActivities,
        latestActivityTime,
      };
    });

    couriersProcessed.sort((a, b) => {
      if (a.hasActivity && !b.hasActivity) return -1;
      if (!a.hasActivity && b.hasActivity) return 1;
      if (a.hasActivity && b.hasActivity) {
        return b.latestActivityTime - a.latestActivityTime;
      }
      return a.name.localeCompare(b.name, "ar");
    });

    const couriers = serializePrisma(couriersProcessed);
    const icons = serializePrisma(iconsRaw);
    const baseUrl = getPublicAppUrl();

    const visibleCouriers = couriers.filter((c: any) => !c.hiddenFromReports);
    const hiddenCouriers = couriers.filter((c: any) => c.hiddenFromReports);

    return (
      <div className="space-y-8">
        <p className={ad.muted}>
          <Link href={SECRET_ADMIN_PATH} className={`${ad.link} flex items-center gap-1`}>
            <DynamicIcon config={icons} iconKey="ui_home" fallback="←" className="w-4 h-4" />
            الرئيسية
          </Link>
        </p>
        <div>
          <h1 className={ad.h1}>المندوبين</h1>
          <p className="mt-2">
            <Link href={`${SECRET_ADMIN_PATH}/couriers/map`} className={`${ad.link} flex items-center gap-2`}>
              <DynamicIcon config={icons} iconKey="ui_map" fallback="🗺️" className="w-5 h-5" />
              خريطة مواقع المندوبين والمجهزين
            </Link>
          </p>
          <p className={`mt-1 ${ad.lead}`}>
            <strong className="text-amber-800">مندوب التوصيل</strong> كيان مستقل في قاعدة
            البيانات — لا يُخلط مع{" "}
            <Link href={`${SECRET_ADMIN_PATH}/shops`} className={ad.link}>
              موظفي المحلات
            </Link>{" "}
            الذين يرفعون طلبات الزبائن فقط. يظهر المندوب في{" "}
            <Link href={`${SECRET_ADMIN_PATH}/orders/pending`} className={ad.link}>
              الطلبات الجديدة
            </Link>{" "}
            عند الإسناد والتوجيه.
          </p>
        </div>

        <section className={ad.section}>
          <h2 className={ad.h2}>إضافة مندوب</h2>
          <p className={`mt-1 text-sm ${ad.muted}`}>
            أو استخدم{" "}
            <Link href={`${SECRET_ADMIN_PATH}/couriers/new`} className={ad.link}>
              صفحة مفصولة
            </Link>
            .
          </p>
          <div className="mt-4">
            <CourierForm />
          </div>
        </section>

        {/* قائمة المندوبين المتاحين للتوجيه والإسناد */}
        <section className={ad.section}>
          <h2 className={ad.h2}>المندوبون المتاحون في التوجيه ({visibleCouriers.length})</h2>
          {visibleCouriers.length === 0 ? (
            <p className={`mt-3 ${ad.muted}`}>لا يوجد مندوبون متاحون للتوجيه حالياً.</p>
          ) : (
            <ul className={`${ad.listDivide} mt-3`}>
              {visibleCouriers.map((c: any) => {
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={ad.listTitle}>{c.name}</p>
                        {c.hasActivity ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                            نشط ({c.totalActivities} حركة)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20">
                            بدون حركات
                          </span>
                        )}
                        {c.blocked && (
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
                            محظور
                          </span>
                        )}
                      </div>
                      <p className={`${ad.listMuted} tabular-nums mt-0.5`}>{c.phone}</p>
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
                        <CourierChatToggle courierId={c.id} initialDisabled={c.chatDisabled} icons={icons} />
                        <CourierHideToggle courierId={c.id} initialHidden={c.hiddenFromReports} icons={icons} />
                        <CourierResetButton courierId={c.id} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`${SECRET_ADMIN_PATH}/couriers/${c.id}/edit`}
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

        {/* قائمة المندوبين المخفيين من التوجيه والإسناد في قسم مستقل */}
        <section className={`${ad.section} border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className={`${ad.h2} flex items-center gap-2 text-amber-800 dark:text-amber-400`}>
              <DynamicIcon config={icons} iconKey="ui_eye_off" fallback="🙈" className="w-5 h-5" />
              المندوبون المخفيون من التوجيه ({hiddenCouriers.length})
            </h2>
          </div>
          <p className={`mt-1 text-sm ${ad.muted}`}>
            هؤلاء المندوبون مخفيون من قائمة التوجيه عند إسناد الطلبات. يمكنك التبديل وإعادتهم للتوجيه بالضغط على &quot;إظهار في التوجيه&quot;.
          </p>

          {hiddenCouriers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 italic">لا يوجد مندوبون مخفيون من التوجيه حالياً.</p>
          ) : (
            <ul className={`${ad.listDivide} mt-4`}>
              {hiddenCouriers.map((c: any) => {
                const mandoubUrl = buildDelegatePortalUrl(c.id, baseUrl);
                const shareText = buildCourierShareMessage({
                  courierName: c.name,
                  delegatePortalUrl: mandoubUrl,
                });
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4 border-slate-200/60 dark:border-slate-800/60"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`${ad.listTitle} text-slate-700 dark:text-slate-300`}>{c.name}</p>
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/30">
                          مخفي من التوجيه
                        </span>
                        {c.blocked && (
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
                            محظور
                          </span>
                        )}
                      </div>
                      <p className={`${ad.listMuted} tabular-nums mt-0.5`}>{c.phone}</p>
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
                        <CourierChatToggle courierId={c.id} initialDisabled={c.chatDisabled} icons={icons} />
                        <CourierHideToggle courierId={c.id} initialHidden={c.hiddenFromReports} icons={icons} />
                        <CourierResetButton courierId={c.id} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`${SECRET_ADMIN_PATH}/couriers/${c.id}/edit`}
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

  } catch (err: any) {

    return (
      <div className="p-8 space-y-4 bg-red-50 text-red-900 min-h-screen" dir="ltr">
        <h1 className="text-2xl font-bold">Runtime Error in AdminCouriersPage</h1>
        <p>عطل في جلب بيانات المندوبين:</p>
        <pre className="bg-slate-900 text-red-400 p-4 rounded overflow-auto whitespace-pre-wrap text-sm">
          {err.stack || err.message || String(err)}
        </pre>
      </div>
    );
  }
}
