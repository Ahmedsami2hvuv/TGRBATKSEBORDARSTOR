export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FDF8EE] px-4 py-6 pb-24 text-slate-800 animate-pulse" dir="rtl">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Nav Skeleton */}
        <div className="flex justify-between">
          <div className="h-9 w-32 rounded-2xl bg-slate-200/60"></div>
          <div className="h-9 w-28 rounded-2xl bg-slate-200/60"></div>
        </div>

        {/* 4 Stats Grid Skeleton */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border-2 border-[#C9A86A]/30 bg-white p-3 text-center">
              <div className="mx-auto h-7 w-10 rounded bg-slate-200/70"></div>
              <div className="mx-auto mt-1.5 h-3 w-14 rounded bg-slate-100"></div>
            </div>
          ))}
        </div>

        {/* Debt Block Skeleton */}
        <div className="rounded-3xl border-2 border-[#C9A86A]/40 bg-white p-6 space-y-4">
          <div className="flex justify-between">
            <div className="h-4 w-36 rounded bg-slate-200/60"></div>
            <div className="h-4 w-20 rounded bg-slate-100"></div>
          </div>
          <div className="h-28 rounded-2xl bg-slate-100/70"></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-12 rounded-xl bg-slate-100"></div>
            <div className="h-12 rounded-xl bg-slate-100"></div>
          </div>
        </div>

        {/* Transactions List Skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-36 rounded bg-slate-200/60"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-24 rounded bg-slate-200/50"></div>
                <div className="h-4 w-16 rounded bg-slate-200/50"></div>
              </div>
              <div className="h-3 w-full rounded bg-slate-100"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
