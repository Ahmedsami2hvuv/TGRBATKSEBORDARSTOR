import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportRegionsButton } from "./import-button";
import { RegionsList } from "./regions-list";
import { getGlobalIcons } from "@/lib/icon-settings";

export const dynamic = "force-dynamic";

import { serializePrisma } from "@/lib/serialize-prisma";

export default async function RegionsPage() {
  try {
    const [regionsRaw, iconsRaw] = await Promise.all([
      prisma.region.findMany({
        orderBy: { name: "asc" },
      }),
      getGlobalIcons()
    ]);

    const regions = serializePrisma(regionsRaw);
    const icons = serializePrisma(iconsRaw);

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <h1 className={ad.h1}>المناطق</h1>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-black border border-blue-200 shadow-sm">
                إجمالي المناطق: {regions.length}
              </span>
            </div>
            <p className={`mt-1 ${ad.lead}`}>إدارة مناطق التوصيل وأسعارها.</p>
          </div>
          <ImportRegionsButton icons={icons} />
        </div>

        {/* عرض القائمة مع ميزة البحث والتعديل */}
        <RegionsList initialRegions={regions} icons={icons} />
      </div>
    );
  } catch (err: any) {
    return (
      <div className="p-8 space-y-4 bg-red-50 text-red-900 min-h-screen" dir="ltr">
        <h1 className="text-2xl font-bold">Runtime Error in RegionsPage</h1>
        <p>عطل في جلب بيانات المناطق:</p>
        <pre className="bg-slate-900 text-red-400 p-4 rounded overflow-auto whitespace-pre-wrap text-sm">
          {err.stack || err.message || String(err)}
        </pre>
      </div>
    );
  }
}
