"use client";

export function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-100 dark:bg-slate-800"></div>
      <div className="p-3 md:p-6 space-y-3">
        <div className="h-4 md:h-6 bg-slate-100 dark:bg-slate-800 rounded w-3/4 mx-auto"></div>
        <div className="h-3 md:h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2 mx-auto"></div>
        <div className="h-8 md:h-10 bg-slate-100 dark:bg-slate-800 rounded-xl mt-3"></div>
      </div>
    </div>
  );
}

export function BranchCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-3 md:p-5 border border-slate-100 dark:border-slate-800 shadow-md animate-pulse">
      <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4"></div>
      <div className="h-4 md:h-6 bg-slate-100 dark:bg-slate-800 rounded w-3/4 mx-auto"></div>
    </div>
  );
}