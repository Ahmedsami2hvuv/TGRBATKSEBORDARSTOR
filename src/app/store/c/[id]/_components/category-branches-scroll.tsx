"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function CategoryBranchesScroll({ branches, categoryId }: { branches: any[], categoryId: string }) {
  const searchParams = useSearchParams();
  const activeBranchId = searchParams.get("b");

  return (
    <div className="flex items-center gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x px-4 -mx-4">
      <Link href={`/store/c/${categoryId}`} prefetch={false} className="snap-start shrink-0 flex flex-col items-center gap-1 mt-1">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${!activeBranchId ? 'border-green-500 bg-green-50 shadow-md scale-105' : 'border-slate-100 bg-slate-50 opacity-80 hover:opacity-100'}`}>
          <span className={`text-xs font-black ${!activeBranchId ? 'text-green-600' : 'text-slate-600'}`}>الكل</span>
        </div>
      </Link>
      
      {branches.map((b) => {
        const isActive = activeBranchId === b.id;
        return (
          <Link key={b.id} href={`/store/c/${categoryId}?b=${b.id}`} prefetch={false} className="snap-start shrink-0 flex flex-col items-center gap-1 mt-1">
             <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${isActive ? 'border-green-500 shadow-md scale-105' : 'border-slate-100 opacity-80 hover:opacity-100'}`}>
                {b.photoUrl ? (
                  <img src={b.photoUrl} alt={b.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{b.name.charAt(0)}</div>
                )}
             </div>
             <span className={`text-[10px] md:text-xs font-bold line-clamp-1 w-16 text-center ${isActive ? 'text-green-600' : 'text-slate-500'}`}>{b.name}</span>
          </Link>
        )
      })}
    </div>
  );
}
