import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { CustomerOrdersBulkTable } from "../orders/customer-orders-bulk-table";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { normalizeAdminShopName } from "@/lib/admin-order-from-admin-constants";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "معلومات الزبون — أبو الأكبر للتوصيل",
};

/** في الرابط: طلبات بدون حقل منطقة في الطلبية */
const NO_REGION_SLUG = "no-region";

type OrderDoorFallback = {
  customerDoorPhotoUrl: string | null;
  createdAt: Date;
};

/** أحدث صورة باب من طلبيات هذه المنطقة فقط (حقل الطلبية — لا نخلط مع صورة من سجل `Customer` العام). */
function pickLatestDoorRawUrl(orders: OrderDoorFallback[]): string | null {
  const sorted = [...orders].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  for (const o of sorted) {
    const fromOrder = o.customerDoorPhotoUrl?.trim();
    if (fromOrder) return fromOrder;
  }
  return null;
}

type Props = {
  searchParams: Promise<{ phone?: string; regionId?: string; q?: string }>;
};

function buildInfoHref(phone: string, regionId?: string | null) {
  const p = encodeURIComponent(phone);
  if (regionId === null || regionId === undefined) {
    return `/admin/customers/info?phone=${p}`;
  }
  const r =
    regionId === NO_REGION_SLUG
      ? NO_REGION_SLUG
      : encodeURIComponent(regionId);
  return `/admin/customers/info?phone=${p}&regionId=${r}`;
}

export default async function CustomerInfoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const phone = (sp.phone ?? "").trim();
  if (!phone) {
    redirect("/admin/customers");
  }

  const regionIdParam = (sp.regionId ?? "").trim();
  const q = (sp.q ?? "").trim().toLowerCase();
  const phoneNorm = normalizeIraqMobileLocal11(phone) ?? phone;

  // 0. Fetch global icons
  const icons = await getGlobalIcons();

  // 1. جلب البيانات المرجعية (سريع جداً)
  const profiles = phoneNorm
    ? await prisma.customerPhoneProfile.findMany({
        where: { phone: phoneNorm },
        include: { region: { select: { id: true, name: true } } },
      })
    : [];

  // 2. جلب إحصائيات المناطق (سريع جداً باستخدام groupBy)
  const orderStats = await prisma.order.groupBy({
    by: ['customerRegionId'],
    where: { customerPhone: phone },
    _count: { id: true }
  });

  // 3. جلب عدد الطلبات الكلي (سريع)
  const totalOrderCount = await prisma.order.count({
    where: { customerPhone: phone }
  });

  // 4. جلب المندوبين (فقط عند الحاجة)
  const couriers =
    regionIdParam !== ""
      ? await prisma.courier.findMany({
          where: courierAssignableWhere,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

  // 5. جلب الطلبات للمنطقة المختارة فقط (تحميل كسلان)
  let ordersFiltered: any[] | null = null;
  if (regionIdParam !== "") {
    ordersFiltered = await prisma.order.findMany({
      where: {
        customerPhone: phone,
        customerRegionId: regionIdParam === NO_REGION_SLUG ? null : regionIdParam,
      },
      orderBy: [{ createdAt: "desc" }, { orderNumber: "desc" }],
      include: {
        shop: true,
        courier: true,
        customer: {
          select: {
            customerLocationUrl: true,
            name: true,
            customerDoorPhotoUrl: true,
            alternatePhone: true,
          },
        },
        customerRegion: { select: { id: true, name: true } },
      },
      take: 50, // عرض آخر 50 طلب لتسريع الصفحة، يمكن زيادة هذا الرقم أو إضافة ترقيم لاحقاً
    });
  }

  // بناء خريطة المناطق والأسماء
  const regionCounts = new Map<string | null, { name: string; count: number }>();

  // تجميع كافة معرفات المناطق من الإحصائيات والبروفايلات
  const ridFromStats = orderStats.map(s => s.customerRegionId);
  const ridFromProfiles = profiles.map(p => p.regionId);
  const allRegionIds = Array.from(new Set([...ridFromStats, ...ridFromProfiles])).filter(id => id !== null) as string[];

  // جلب الأسماء للمناطق التي لا تملك بروفايل مرجعي
  const knownProfileRegionIds = new Set(profiles.map(p => p.regionId));
  const missingRegionIds = allRegionIds.filter(id => !knownProfileRegionIds.has(id));

  const additionalRegions = missingRegionIds.length > 0
    ? await prisma.region.findMany({
        where: { id: { in: missingRegionIds } },
        select: { id: true, name: true }
      })
    : [];

  const regionNamesMap = new Map<string | null, string>();
  regionNamesMap.set(null, "بدون منطقة");
  profiles.forEach(p => regionNamesMap.set(p.regionId, p.region.name));
  additionalRegions.forEach(r => regionNamesMap.set(r.id, r.name));

  // ملء الإحصائيات
  for (const s of orderStats) {
    regionCounts.set(s.customerRegionId, {
      name: regionNamesMap.get(s.customerRegionId) || "منطقة غير معروفة",
      count: s._count.id
    });
  }
  for (const p of profiles) {
    if (!regionCounts.has(p.regionId)) {
      regionCounts.set(p.regionId, { name: p.region.name, count: 0 });
    }
  }

  const regionEntries = Array.from(regionCounts.entries()).sort((a, b) => {
    if (a[0] === null && b[0] !== null) return 1;
    if (a[0] !== null && b[0] === null) return -1;
    return a[1].name.localeCompare(b[1].name, "ar");
  }).filter(([rid, meta]) => {
    if (!q) return true;
    const blob = `${meta.name} ${rid ?? "no-region"} ${meta.count}`.toLowerCase();
    return blob.includes(q);
  });

  const profileForRegion =
    regionIdParam &&
    regionIdParam !== NO_REGION_SLUG &&
    phoneNorm
      ? profiles.find((p) => p.regionId === regionIdParam) ?? null
      : null;

  const regionMeta =
    regionIdParam === ""
      ? null
      : regionIdParam === NO_REGION_SLUG
        ? { name: "بدون منطقة" }
        : { name: regionNamesMap.get(regionIdParam) || "منطقة غير معروفة" };

  const tableRows =
    regionIdParam !== "" && ordersFiltered
      ? ordersFiltered.map((o) => {
          const missingLoc = !hasCustomerLocationUrl(o.customerLocationUrl, o.customer?.customerLocationUrl);
          return {
            id: o.id,
            orderNumber: o.orderNumber,
            createdAtLabel: o.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
            shopName: normalizeAdminShopName(o.shop.name),
            status: o.status,
            missingLoc,
            totalLabel:
              o.totalAmount != null ? formatDinarAsAlf(o.totalAmount) : "—",
            courierName: o.courier?.name?.trim() || "",
          };
        }).filter((row) => {
          if (!q) return true;
          const blob = `${row.orderNumber} ${row.shopName} ${row.status} ${row.totalLabel} ${row.courierName}`.toLowerCase();
          return blob.includes(q);
        })
      : [];

  const doorPhotoSrc =
    regionIdParam === ""
      ? null
      : (() => {
          const fromProfile = resolvePublicAssetSrc(profileForRegion?.photoUrl);
          if (fromProfile) return fromProfile;
          const raw = pickLatestDoorRawUrl(ordersFiltered ?? []);
          return resolvePublicAssetSrc(raw);
        })();

  const latestOrderInRegion =
    regionIdParam !== "" && ordersFiltered && ordersFiltered.length > 0
      ? ordersFiltered[0]
      : null;

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/customers" className={ad.link}>
          <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="inline-block w-3 h-3 me-1" />
          بيانات الزبائن
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin" className={ad.link}>
          الرئيسية
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>معلومات الزبون</h1>
        <p className={`mt-1 ${ad.lead}`}>
          الهاتف:{" "}
          <strong className="font-mono tabular-nums text-sky-900">{phone}</strong>
          {phoneNorm !== phone ? (
            <>
              {" "}
              <span className="text-slate-500">
                (موحّد للمرجعية:{" "}
                <span className="font-mono tabular-nums">{phoneNorm}</span>)
              </span>
            </>
          ) : null}
        </p>
      </div>

      <section className={`${ad.section} space-y-2`}>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="phone" value={phone} />
          {regionIdParam ? <input type="hidden" name="regionId" value={regionIdParam} /> : null}
          <label className="min-w-[min(100%,340px)] flex-1">
            <span className={ad.label}>بحث داخل صفحة الزبون</span>
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="منطقة، رقم طلب، محل، مندوب…"
              className={`${ad.input} mt-1`}
            />
          </label>
          <button type="submit" className={ad.btnDark + " flex items-center gap-2"}>
            <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-4 h-4" />
            بحث
          </button>
        </form>
      </section>

      {regionIdParam === "" ? (
        <>
          <div className={`${ad.section} space-y-3`}>
            <h2 className={ad.h2}>المناطق</h2>
            <p className="text-sm text-slate-700">
              عدد المناطق المرتبطة بهذا الرقم:{" "}
              <strong className="text-sky-900 tabular-nums">{regionCounts.size}</strong>
            </p>
            {regionEntries.length === 0 ? (
              <p className="text-slate-600">
                لا توجد منطقة مسجّلة لهذا الرقم.
              </p>
            ) : (
              <ul className="space-y-2">
                {regionEntries.map(([rid, { name, count }]) => {
                  const href = buildInfoHref(
                    phone,
                    rid === null ? NO_REGION_SLUG : rid,
                  );
                  return (
                    <li key={rid ?? "null"}>
                      <Link
                        href={href}
                        className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-2.5 text-sm font-bold text-sky-950 transition hover:bg-sky-100"
                      >
                        <span>{name}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-sky-800 tabular-nums">
                          {count} طلبية
                        </span>
                        <span className="text-xs font-semibold text-sky-700">
                          عرض التفاصيل والطلبات
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={`${ad.section} space-y-2`}>
            <p className="text-sm text-slate-700">
              إجمالي الطلبات المسجّلة لهذا الرقم:{" "}
              <strong className="tabular-nums text-sky-900">{totalOrderCount}</strong>
            </p>
            <p className="text-sm">
              <Link
                href={`/admin/customers/orders?phone=${encodeURIComponent(phone)}`}
                className={ad.link}
              >
                عرض جميع طلبات هذا الرقم بالترتيب الزمني
              </Link>
            </p>
          </div>
        </>
      ) : (
        <>
          <p>
            <Link
              href={buildInfoHref(phone)}
              className={`inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 gap-2`}
            >
              <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="w-4 h-4" />
              العودة لقائمة المناطق
            </Link>
          </p>

          <div className={`${ad.section} space-y-2`}>
            <h2 className={ad.h2}>
              {regionMeta?.name || "منطقة غير معروفة"}
              {regionIdParam !== NO_REGION_SLUG ? (
                <span className="ms-2 text-sm font-normal text-slate-500">
                  (تفاصيل مرجعية + طلبيات هذه المنطقة)
                </span>
              ) : (
                <span className="ms-2 text-sm font-normal text-slate-500">
                  (طلبات بدون حقل منطقة في الطلبية)
                </span>
              )}
            </h2>
          </div>

          {regionIdParam !== NO_REGION_SLUG && profileForRegion ? (
            <div className={`${ad.section} space-y-4`}>
              <h3 className={ad.h3}>البيانات المخزّنة (مرجع رقم + منطقة)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <DynamicIcon iconKey="ui_location" config={icons} fallback="📍" className="w-3 h-3" />
                    اللوكيشن
                  </p>
                  {profileForRegion.locationUrl?.trim() ? (
                    <a
                      href={profileForRegion.locationUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${ad.link} break-all text-sm font-semibold flex items-center gap-1`}
                    >
                      <DynamicIcon iconKey="ui_external_link" config={icons} fallback="🔗" className="w-3.5 h-3.5" />
                      فتح الرابط
                    </a>
                  ) : (
                    <p className="text-sm text-slate-600">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <DynamicIcon iconKey="ui_map" config={icons} fallback="📍" className="w-3 h-3" />
                    أقرب نقطة دالة
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {profileForRegion.landmark?.trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <DynamicIcon iconKey="ui_call" config={icons} fallback="📞" className="w-3 h-3" />
                    رقم ثانٍ
                  </p>
                  <p className="font-mono text-sm tabular-nums">
                    {profileForRegion.alternatePhone?.trim() || "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <DynamicIcon iconKey="ui_note" config={icons} fallback="📝" className="w-3 h-3" />
                    ملاحظات
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {profileForRegion.notes?.trim() || "—"}
                  </p>
                </div>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <DynamicIcon iconKey="ui_camera" config={icons} fallback="📷" className="w-3 h-3" />
                      صورة باب
                    </p>
                    {doorPhotoSrc ? (
                      <a
                        href={doorPhotoSrc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={doorPhotoSrc}
                          alt=""
                          className="max-h-48 max-w-xs rounded-xl border border-sky-200 object-contain"
                        />
                      </a>
                    ) : (
                      <p className="text-xs font-bold text-amber-700">
                        لا توجد صورة فعلية لهذا المرجع حالياً. شغّل "سحب الصور" ثم "تنظيف الروابط".
                      </p>
                    )}
                  </div>
              <p className="text-sm">
                <Link
                  href={`/admin/customers/profiles/${profileForRegion.id}/edit`}
                  className={ad.link + " flex items-center gap-1"}
                >
                  <DynamicIcon iconKey="ui_edit" config={icons} fallback="✎" className="w-3.5 h-3.5" />
                  تعديل هذا المرجع
                </Link>
              </p>
            </div>
          ) : null}

          {!profileForRegion && latestOrderInRegion ? (
            <div className={`${ad.section} space-y-4`}>
              <h3 className={ad.h3}>من آخر طلبية في هذه المنطقة</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <DynamicIcon iconKey="ui_location" config={icons} fallback="📍" className="w-3 h-3" />
                    اللوكيشن
                  </p>
                  {latestOrderInRegion.customerLocationUrl?.trim() ? (
                    <a
                      href={latestOrderInRegion.customerLocationUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${ad.link} break-all text-sm font-semibold flex items-center gap-1`}
                    >
                      <DynamicIcon iconKey="ui_external_link" config={icons} fallback="🔗" className="w-3.5 h-3.5" />
                      فتح الرابط
                    </a>
                  ) : (
                    <p className="text-sm text-slate-600">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <DynamicIcon iconKey="ui_map" config={icons} fallback="📍" className="w-3 h-3" />
                    أقرب نقطة دالة
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {latestOrderInRegion.customerLandmark?.trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <DynamicIcon iconKey="ui_call" config={icons} fallback="📞" className="w-3 h-3" />
                    رقم ثانٍ
                  </p>
                  <p className="font-mono text-sm tabular-nums">
                    {latestOrderInRegion.alternatePhone?.trim() || "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {doorPhotoSrc && !profileForRegion && (
             <div className={`${ad.section} space-y-2`}>
              <h3 className={ad.h3}><DynamicIcon iconKey="ui_camera" config={icons} fallback="📷" className="inline-block w-5 h-5 me-2" />صورة باب الزبون</h3>
              <a
                href={doorPhotoSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img
                  src={doorPhotoSrc}
                  alt=""
                  className="max-h-48 max-w-xs rounded-xl border border-sky-200 object-contain"
                />
              </a>
            </div>
          )}

          <div className="space-y-3">
            <h3 className={ad.h3}>
              طلبيات هذه المنطقة ({ordersFiltered?.length ?? 0})
              {ordersFiltered && ordersFiltered.length === 50 && (
                <span className="ms-2 text-xs font-normal text-slate-500">(يتم عرض أحدث 50 فقط)</span>
              )}
            </h3>
            {ordersFiltered && ordersFiltered.length === 0 ? (
              <p className="text-slate-600">لا توجد طلبات في هذه المنطقة.</p>
            ) : (
              <CustomerOrdersBulkTable orders={tableRows} couriers={couriers} icons={icons} />
            )}
          </div>
        </>
      )}

      <p className={`text-sm ${ad.muted}`}>
        للبحث الأوسع استخدم{" "}
        <Link href="/admin/orders/tracking" className={ad.link}>
          تتبع الطلبات
        </Link>
        .
      </p>
    </div>
  );
}
