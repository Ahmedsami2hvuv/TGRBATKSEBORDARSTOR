import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportCustomersButton } from "./import-customers-button";
import Link from "next/link";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Client } from "pg";
import { resolvePublicAssetSrc } from "@/lib/image-url";

import { CustomerSearchInput } from "./customer-search-input";
export const dynamic = "force-dynamic";
export const revalidate = 0; // منع الكاش نهائياً

const OLD_DB_URL = "postgresql://postgres:jkDcspXZlicvzQvaffZAxBgischujWrX@caboose.proxy.rlwy.net:46307/railway";
type SourceFilter = "all" | "railway" | "orders" | "reference" | "blocked";

function buildCompactPagination(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const visible = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const compact: Array<number | "ellipsis"> = [];
  for (let i = 0; i < visible.length; i++) {
    const page = visible[i]!;
    if (i > 0) {
      const prev = visible[i - 1]!;
      if (page - prev > 1) compact.push("ellipsis");
    }
    compact.push(page);
  }
  return compact;
}

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default async function AdminCustomersPage(props: { searchParams: Promise<{ q?: string, page?: string, source?: string }> }) {
  const searchParams = await props.searchParams;
  const q = searchParams.q || "";
  const source = (searchParams.source || "all") as SourceFilter;
  const page = parseInt(searchParams.page || "1") || 1;
  const take = 100;
  
  const [allProfiles, icons, profilesCount] = await Promise.all([
    prisma.customerPhoneProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: { region: { select: { name: true } } },
    }),
    getGlobalIcons(),
    prisma.customerPhoneProfile.count(),
  ]);

  const blockedCount = allProfiles.filter(p => p.isBlocked).length;

  // مفاتيح (phone|region) + phones القادمة من ريلوي
  const railwayKeys = new Set<string>();
  const railwayPhones = new Set<string>();
  try {
    const oldClient = new Client({ connectionString: OLD_DB_URL, connectionTimeoutMillis: 12000 });
    await oldClient.connect();
    const oldRes = await oldClient.query(`
      SELECT phone, "regionId"
      FROM "CustomerPhoneProfile"
      WHERE phone IS NOT NULL AND "regionId" IS NOT NULL
    `);
    for (const row of oldRes.rows) {
      const oldPhone = String(row.phone).trim();
      const oldRegionId = String(row.regionId).trim();
      railwayKeys.add(`${oldPhone}|${oldRegionId}`);
      railwayPhones.add(oldPhone);
    }
    await oldClient.end();
  } catch (e) {
    console.warn("[AdminCustomersPage] Could not load old railway keys:", e);
  }

  // مفاتيح (phone|region) القادمة من الطلبات المحلية
  const orderGroup = await prisma.order.groupBy({
    by: ["customerPhone", "customerRegionId"],
    where: { customerPhone: { not: "" } },
  });
  const orderKeys = new Set<string>();
  for (const row of orderGroup) {
    if (!row.customerPhone || !row.customerRegionId) continue;
    orderKeys.add(`${row.customerPhone.trim()}|${row.customerRegionId.trim()}`);
  }

  const classifiedProfiles = allProfiles.map((p) => {
    const key = `${p.phone.trim()}|${p.regionId.trim()}`;
    let sourceKind: SourceFilter = "reference";
    if (railwayKeys.has(key) || railwayPhones.has(p.phone.trim())) sourceKind = "railway";
    else if (orderKeys.has(key)) sourceKind = "orders";
    return { ...p, sourceKind };
  });

  const searchFiltered = q
    ? classifiedProfiles.filter((p) => {
        const blob = `${p.phone} ${p.notes} ${p.landmark} ${p.region?.name || ""}`.toLowerCase();
        return blob.includes(q.toLowerCase());
      })
    : classifiedProfiles;

  const bySourceFiltered =
    source === "all" ? searchFiltered :
    source === "blocked" ? searchFiltered.filter((p) => p.isBlocked) :
    searchFiltered.filter((p) => p.sourceKind === source);

  const filteredCount = bySourceFiltered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / take));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const paginationItems = buildCompactPagination(pageSafe, totalPages);
  const skip = (pageSafe - 1) * take;
  const profiles = bySourceFiltered.slice(skip, skip + take);

  // جلب إحصائيات الطلبات لكل رقم هاتف في القائمة الحالية
  const phones = profiles.map(p => p.phone);
  const orderStats = await prisma.order.groupBy({
    by: ['customerPhone'],
    where: { customerPhone: { in: phones } },
    _count: { _all: true },
    _sum: { totalAmount: true }
  });

  const statsMap = new Map(orderStats.map(s => [s.customerPhone, s]));

  // تجميع الزبائن حسب رقم الهاتف
  const groupedProfiles = new Map<string, {
    phone: string;
    regions: {
      id: string;
      regionId: string;
      sourceKind: SourceFilter;
      name: string;
      notes: string;
      landmark: string;
      photoUrl: string;
      locationUrl: string;
    }[];
  }>();

  for (const p of profiles) {
    if (!groupedProfiles.has(p.phone)) {
      groupedProfiles.set(p.phone, { phone: p.phone, regions: [] });
    }
    groupedProfiles.get(p.phone)!.regions.push({
      id: p.id,
      regionId: p.regionId,
      sourceKind: (p as any).sourceKind,
      name: p.region?.name || 'غير محدد',
      notes: p.notes,
      landmark: p.landmark,
      photoUrl: p.photoUrl,
      locationUrl: p.locationUrl,
      isBlocked: p.isBlocked
    });
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-1">
        <p className={ad.muted}>
          <Link href={SECRET_ADMIN_PATH} className={ad.link}>
            <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="inline-block w-3 h-3 me-1" />
            الرئيسية
          </Link>
        </p>
        <div className="flex justify-between items-end">
           <div>
              <h1 className="text-3xl font-black text-gray-800">بيانات الزبائن</h1>
              <div className="flex gap-2 items-center">
                <p className="text-gray-500 text-sm">إجمالي الزبائن في القاعدة: <span className="text-blue-600 font-bold">{profilesCount.toLocaleString()}</span></p>
                <span className="text-gray-300">|</span>
                <p className="text-gray-500 text-sm">المعروض حالياً: <span className="text-green-600 font-bold">{profiles.length} (صفحة {pageSafe} من {totalPages})</span></p>
              </div>
           </div>
           <ImportCustomersButton icons={icons} />
        </div>
      </div>


      <div className="flex gap-2 items-center bg-white p-4 rounded-2xl shadow-sm border border-blue-50">
          <Link href={`${SECRET_ADMIN_PATH}/customers/add`} className="bg-cyan-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-cyan-600 transition-all text-sm flex items-center gap-2">
            <DynamicIcon iconKey="ui_plus" config={icons} fallback="+" className="w-4 h-4" />
            إضافة زبون مرجعي
          </Link>
          <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="q" value={q} />
            <select
              name="source"
              defaultValue={source}
              className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-xl text-sm font-bold"
            >
              <option value="all">كل المصادر</option>
              <option value="blocked">🔴 المحظورين ({blockedCount})</option>
              <option value="railway">قادمين من ريلوي</option>
              <option value="orders">قادمين من طلبات الموقع</option>
              <option value="reference">مضافين مرجعياً</option>
            </select>
            <button type="submit" className="bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold">
              فرز
            </button>
          </form>
          <div className="flex-1 flex gap-2 relative">
              <CustomerSearchInput defaultValue={q} source={source} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-5 h-5" />
              </div>
              <button type="button" className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2">
                <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-4 h-4" />
                بحث
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* أزرار التنقل بين الصفحات - أعلى النتائج */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-1 pb-3 flex-wrap">
            {pageSafe > 1 ? (
              <Link
                href={`${SECRET_ADMIN_PATH}/customers?q=${q}&source=${source}&page=${pageSafe - 1}`}
                className="min-w-[70px] h-10 px-3 flex justify-center items-center rounded-xl font-bold text-sm shadow-sm transition-all border bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
              >
                السابق
              </Link>
            ) : null}

            {paginationItems.map((item, idx) => {
              if (item === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-10 h-10 flex justify-center items-center text-gray-400 font-black"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                );
              }

              const isActive = pageSafe === item;
              return (
                <Link
                  key={item}
                  href={`${SECRET_ADMIN_PATH}/customers?q=${q}&source=${source}&page=${item}`}
                  className={`w-10 h-10 flex justify-center items-center rounded-xl font-bold text-sm shadow-sm transition-all border ${
                    isActive
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item}
                </Link>
              );
            })}

            {pageSafe < totalPages ? (
              <Link
                href={`${SECRET_ADMIN_PATH}/customers?q=${q}&source=${source}&page=${pageSafe + 1}`}
                className="min-w-[70px] h-10 px-3 flex justify-center items-center rounded-xl font-bold text-sm shadow-sm transition-all border bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
              >
                التالي
              </Link>
            ) : null}
          </div>
        )}

        {Array.from(groupedProfiles.values()).map((group, index) => {
          const stats = statsMap.get(group.phone);
          const seqNumber = filteredCount - skip - index; // Not exact anymore, but a good indicator
          
          return (
            <div
              key={group.phone}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-2 items-center flex-wrap">
                   <div className="bg-gray-800 text-white px-2 py-1 rounded-lg text-xs font-black shadow-sm">
                      #{seqNumber.toLocaleString()}
                   </div>
                   <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-bold border border-blue-100">
                      إجمالي الطلبات: {stats?._count?._all || 0}
                   </div>
                   <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg text-[10px] font-bold border border-purple-100">
                      مجموع الأسعار: {Number(stats?._sum?.totalAmount || 0).toLocaleString()}
                   </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <span className="text-xl font-black text-gray-800 tracking-tighter" dir="ltr">{group.phone}</span>
                </div>
              </div>

              <div className="mt-2">
                <p className="text-xs font-bold text-gray-500 mb-2">المناطق المسجلة للزبون (انقر للدخول لتفاصيل المنطقة):</p>
                <div className="flex flex-wrap gap-2">
                  {group.regions.map(r => (
                    <Link
                      key={r.id}
                      href={`${SECRET_ADMIN_PATH}/customers/info?phone=${group.phone}&regionId=${r.regionId}&source=${source}`}
                      className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition-all flex flex-col items-center min-w-[100px]"
                    >
                      <span className="font-bold text-sm text-gray-800">{r.name}</span>
                      <span className="text-[10px] font-bold text-slate-500 mt-1">
                        {r.sourceKind === "railway" ? "ريلوي" : r.sourceKind === "orders" ? "طلبات الموقع" : "مرجعي"}
                      </span>
                      {r.isBlocked && <span className="text-[10px] font-black text-red-600">🔴 محظور</span>}
                      <div className="flex gap-2 text-xs mt-1">
                         {resolvePublicAssetSrc(r.photoUrl) && <span title="توجد صورة باب قابلة للعرض"><DynamicIcon iconKey="ui_camera" config={icons} fallback="📷" className="w-3.5 h-3.5" /></span>}
                         {r.locationUrl && <span title="موقع GPS"><DynamicIcon iconKey="ui_location" config={icons} fallback="📍" className="w-3.5 h-3.5" /></span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {group.regions.length === 1 && group.regions[0].notes && (
                <div className="text-right mt-2 bg-yellow-50 p-2 rounded-lg text-xs text-yellow-800">
                  <span className="font-bold">ملاحظات: </span> {group.regions[0].notes}
                </div>
              )}
              {group.regions.length === 1 && group.regions[0].landmark && (
                <div className="text-right mt-1 text-[10px] text-blue-500 font-bold flex items-center gap-1">
                  <DynamicIcon iconKey="ui_location" config={icons} fallback="📍" className="w-3 h-3" /> {group.regions[0].landmark}
                </div>
              )}

              <div className="absolute top-0 right-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
          );
        })}

        {groupedProfiles.size === 0 && (
          <div className="bg-white p-20 text-center rounded-3xl border-2 border-dashed border-gray-200">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-400 italic">لا يوجد نتائج تطابق بحثك أو القاعدة فارغة</h3>
            <p className="text-sm text-gray-300">استخدم زر الاستيراد أعلاه لجلب البيانات</p>
          </div>
        )}
      </div>

    </div>
  );
}
