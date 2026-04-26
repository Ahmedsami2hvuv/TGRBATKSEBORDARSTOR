export default function Loading() {
  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-xl"></div>
      </div>

      {/* Buttons Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-100">
        <div className="w-full md:w-96 h-12 bg-slate-50 animate-pulse rounded-2xl"></div>
        <div className="flex gap-2 w-full md:w-auto">
             <div className="h-12 w-40 bg-violet-100 animate-pulse rounded-2xl"></div>
             <div className="h-12 w-32 bg-slate-900/10 animate-pulse rounded-2xl"></div>
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-[2.5rem] border border-slate-100 space-y-4">
             <div className="aspect-square bg-slate-50 animate-pulse rounded-[2rem]"></div>
             <div className="h-5 w-3/4 mx-auto bg-slate-100 animate-pulse rounded-full"></div>
             <div className="h-3 w-1/2 mx-auto bg-slate-50 animate-pulse rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
