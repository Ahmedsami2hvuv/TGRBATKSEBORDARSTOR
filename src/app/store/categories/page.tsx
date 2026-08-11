import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CategoriesPage() {
  const categories = await prisma.storeCategory.findMany({
    where: { active: true },
    orderBy: { sequence: "desc" },
  });

  return (
    <div className="pt-2 pb-10">
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        {categories.map((category: any) => (
          <Link key={category.id} href={`/store/c/${category.id}`} className="flex flex-col items-center group">
            <div className="w-full aspect-square bg-[#22c55e] rounded-2xl flex items-center justify-center overflow-hidden mb-2 shadow-sm transition-transform group-hover:scale-105 border border-[#16a34a]">
              {category.photoUrl ? (
                <img src={category.photoUrl} alt={category.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl text-white font-bold">{category.name.charAt(0)}</span>
              )}
            </div>
            <span className="text-[11px] md:text-sm font-black text-slate-800 text-center leading-tight">{category.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
