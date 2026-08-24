import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getPublicAppUrl } from "@/lib/app-url";
import { buildDelegatePortalUrl } from "@/lib/delegate-link";
import { buildCourierShareMessage, whatsappAppUrl } from "@/lib/whatsapp";
import { CourierForm } from "./courier-form";
import { CourierCard } from "./courier-card";
import { HiddenCouriersSection } from "./hidden-couriers-section";

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

        {/* قائمة المندوبين المتاحين للإسناد */}
        <section className={ad.section}>
          <h2 className={ad.h2}>المندوبون الظاهرون في قوائم الإسناد ({visibleCouriers.length})</h2>
          {visibleCouriers.length === 0 ? (
            <p className={`mt-3 ${ad.muted}`}>لا يوجد مندوبون ظاهرون في الإسناد حالياً.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {visibleCouriers.map((c: any) => {
                const mandoubUrl = buildDelegatePortalUrl(c.id, baseUrl);
                return (
                  <CourierCard
                    key={c.id}
                    courier={c}
                    mandoubUrl={mandoubUrl}
                    icons={icons}
                    secretAdminPath={SECRET_ADMIN_PATH}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* قائمة المندوبين المخفيين من قوائم الإسناد في قسم مستقل بداخل زر فتح وإغلاق */}
        <HiddenCouriersSection count={hiddenCouriers.length} icons={icons}>
          {hiddenCouriers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 italic">لا يوجد مندوبون مخفيون من قوائم الإسناد حالياً.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {hiddenCouriers.map((c: any) => {
                const mandoubUrl = buildDelegatePortalUrl(c.id, baseUrl);
                return (
                  <CourierCard
                    key={c.id}
                    courier={c}
                    mandoubUrl={mandoubUrl}
                    icons={icons}
                    secretAdminPath={SECRET_ADMIN_PATH}
                  />
                );
              })}
            </div>
          )}
        </HiddenCouriersSection>


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
