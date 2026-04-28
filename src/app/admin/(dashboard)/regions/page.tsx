import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportRegionsButton } from "./import-button";
import { RegionsList } from "./regions-list";

export const dynamic = "force-dynamic";

export default async function RegionsPage() {
  const regions = await prisma.region.findMany({
    orderBy: { name: "asc" },
  });

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
        <ImportRegionsButton />
      </div>

      {/* عرض القائمة مع ميزة البحث والتعديل */}
      <RegionsList initialRegions={regions} />
    </div>
  );
}
