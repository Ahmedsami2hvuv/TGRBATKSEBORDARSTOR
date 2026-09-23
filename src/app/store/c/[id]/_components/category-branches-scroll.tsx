"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function CategoryBranchesScroll({ branches, categoryId, productCount }: { branches: any[], categoryId: string, productCount: number }) {
  const searchParams = useSearchParams();
  const activeBranchIdFromUrl = searchParams.get("b");
  
  // استخدام حالة محلية لتوفير استجابة فورية (Optimistic UI)
  const [optimisticBranch, setOptimisticBranch] = useState<string | null>(activeBranchIdFromUrl);

  // تحديث الحالة المحلية إذا تغير الرابط فعلياً (بعد انتهاء التحميل)
  useEffect(() => {
    setOptimisticBranch(activeBranchIdFromUrl);
  }, [activeBranchIdFromUrl]);

  const activeBranchId = optimisticBranch;
  const isPending = optimisticBranch !== activeBranchIdFromUrl;

  return (
    <div className="flex flex-col gap-2 relative">
      {branches.length > 3 && (
        <div className="absolute top-0 left-2 z-10 flex items-center justify-end w-full pointer-events-none opacity-60">
           <span className="text-[10px] text-slate-400 font-bold bg-white/80 px-2 py-0.5 rounded-full shadow-sm animate-pulse">اسحب للمزيد 👈</span>
        </div>
      )}
      <div className="flex items-start gap-4 overflow-x-auto pb-3 pt-4 hide-scrollbar px-2 accelerate-gpu" style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}>
      <Link 
        href={`/store/c/${categoryId}`} 
        onClick={() => setOptimisticBranch(null)}
        className="shrink-0 flex flex-col items-center gap-1.5"
      >
        <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border-2 transition-all ${!activeBranchId ? 'border-green-500 bg-green-50 shadow-lg scale-105 ring-2 ring-green-500/20' : 'border-slate-200 bg-slate-50 opacity-90 hover:opacity-100 shadow-sm'}`}>
          <span className={`text-sm sm:text-base font-black ${!activeBranchId ? 'text-green-600' : 'text-slate-700'}`}>الكل</span>
        </div>
        <span className={`text-xs sm:text-sm font-bold text-center ${!activeBranchId ? 'text-green-600 font-extrabold' : 'text-slate-500'}`}>عرض الجميع</span>
      </Link>
      
      {branches.map((b) => {
        const isActive = activeBranchId === b.id;
        return (
          <Link 
            key={b.id} 
            href={`/store/c/${categoryId}?b=${b.id}`} 
            onClick={() => setOptimisticBranch(b.id)}
            className="shrink-0 flex flex-col items-center gap-1.5"
          >
             <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 transition-all ${isActive ? 'border-green-500 shadow-lg scale-105 ring-2 ring-green-500/20' : 'border-slate-200 opacity-90 hover:opacity-100 shadow-sm'}`}>
                {b.photoUrl ? (
                  <img src={b.photoUrl} alt={b.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center text-base font-bold text-slate-600">{b.name.charAt(0)}</div>
                )}
             </div>
             <span className={`text-xs sm:text-sm font-bold line-clamp-1 w-20 sm:w-24 text-center ${isActive ? 'text-green-600 font-extrabold' : 'text-slate-700'}`}>{b.name}</span>
          </Link>
        )
      })}
      </div>
      
      {/* رأس المنتجات مع مؤشر التحميل */}
      <div className="flex items-center justify-between mt-4 border-t border-slate-100 pt-4 px-2">
        <h2 className="text-lg md:text-xl font-black flex items-center gap-3 text-slate-900">
          المنتجات
          {isPending && (
            <span className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg animate-pulse">
              <span className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></span>
              جاري التحميل...
            </span>
          )}
        </h2>
        <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500">
           {productCount} منتج
        </span>
      </div>
    </div>
  );
}
