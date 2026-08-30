import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Metadata } from "next";
import { getDefaultStoreMetadata } from "@/lib/store-meta";

export const metadata: Metadata = getDefaultStoreMetadata(
  "جميع الأقسام | خصيب ستور — أبو الأكبر للتوصيل",
  "تصفح جميع أقسام وفئات متجر أبو الأكبر للتوصيل وتسوق كل ما تحتاجه بسهولة."
);

export default async function CategoriesPage() {
  const categories = await prisma.storeCategory.findMany({
    where: { active: true },
    orderBy: { sequence: "desc" },
  });

  return (
    <div className="pt-2 pb-10">
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        {/* زر المفضلة الثابت كأول قسم */}
        <Link href="/store/favorites" className="flex flex-col items-center group">
          <div className="w-full aspect-square bg-rose-500 rounded-2xl flex items-center justify-center overflow-hidden mb-2 shadow-sm transition-transform group-hover:scale-105 border border-rose-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white fill-white" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-[11px] md:text-sm font-black text-rose-600 text-center leading-tight">المفضلة</span>
        </Link>
        
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
