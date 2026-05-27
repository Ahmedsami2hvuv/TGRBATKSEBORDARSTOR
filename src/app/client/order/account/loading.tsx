export default function Loading() {
  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 animate-pulse text-slate-800">
      <div className="mx-auto max-w-lg space-y-5">
        {/* Header Skeleton */}
        <div className="kse-glass-dark rounded-2xl border border-slate-100 p-6 text-center shadow-sm">
          <div className="mx-auto h-3 w-20 rounded bg-slate-200/50"></div>
          <div className="mx-auto mt-4 h-6 w-48 rounded bg-slate-200/60"></div>
          <div className="mx-auto mt-2 h-4 w-32 rounded bg-slate-100/50"></div>
          <div className="mx-auto mt-4 h-16 w-16 rounded-2xl bg-slate-200/40"></div>
          <div className="mx-auto mt-4 h-5 w-24 rounded bg-slate-200/50"></div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <div className="h-12 rounded-xl bg-slate-200/30"></div>
            <div className="h-12 rounded-xl bg-slate-200/30"></div>
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="kse-glass-dark rounded-2xl border border-slate-100 p-4 text-center">
              <div className="mx-auto h-8 w-12 rounded bg-slate-200/50"></div>
              <div className="mx-auto mt-2 h-3 w-16 rounded bg-slate-100/50"></div>
            </div>
          ))}
        </div>

        {/* Recent Orders Skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-32 rounded bg-slate-200/50"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white/80 p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-5 w-16 rounded bg-slate-100"></div>
                <div className="h-5 w-20 rounded-full bg-slate-50"></div>
              </div>
              <div className="h-4 w-full rounded bg-slate-50"></div>
              <div className="h-3 w-2/3 rounded bg-slate-50"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
