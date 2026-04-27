import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ImportButton } from "./import-button";

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
        <ImportButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regions.map((region) => {
          // تصحيح السعر برمجياً أثناء العرض: إذا كان 3000 يظهر 3
          let displayPrice = Number(region.deliveryPrice);
          if (displayPrice >= 1000) {
            displayPrice = displayPrice / 1000;
          }

          return (
            <div key={region.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800">{region.name}</h3>
              <p className="text-sm text-gray-500">سعر التوصيل: {displayPrice} د.ع</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
