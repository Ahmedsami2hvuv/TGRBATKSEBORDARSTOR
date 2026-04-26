export default function Loading() {
  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
          <div className="h-4 w-64 bg-slate-100 animate-pulse rounded-lg"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-slate-100 animate-pulse rounded-xl"></div>
          <div className="h-10 w-32 bg-slate-200 animate-pulse rounded-xl"></div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="h-12 flex-1 bg-white border-2 border-slate-100 animate-pulse rounded-2xl"></div>
        <div className="h-12 w-24 bg-slate-900 animate-pulse rounded-2xl"></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="bg-white rounded-[2.5rem] border-2 border-transparent shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden">
            <div className="aspect-square bg-slate-100 animate-pulse"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 w-full bg-slate-100 animate-pulse rounded"></div>
              <div className="h-4 w-2/3 bg-slate-100 animate-pulse rounded"></div>
              <div className="flex flex-col gap-1">
                <div className="h-3 w-1/2 bg-emerald-50 animate-pulse rounded"></div>
                <div className="h-2 w-1/3 bg-slate-50 animate-pulse rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
