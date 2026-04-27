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
      <div className="flex justify-between items-center">
        <div>
          <h1 className={ad.h1}>المناطق</h1>
          <p className={`mt-1 ${ad.lead}`}>إدارة مناطق التوصيل وأسعارها.</p>
        </div>
        <ImportRegionsButton />
      </div>

      {/* عرض القائمة مع ميزة البحث والتعديل */}
      <RegionsList initialRegions={regions} />
    </div>
  );
}
