export default function Loading() {
  return (
    <div className="kse-app-bg min-h-screen px-4 py-8 animate-pulse text-slate-800">
      <div className="mx-auto max-w-lg space-y-5">

        {/* Header Skeleton */}
        <div className="kse-glass-dark rounded-3xl border border-sky-100 p-6 text-center shadow-sm">
          <div className="mx-auto h-4 w-24 rounded bg-sky-100/50"></div>
          <div className="mx-auto mt-4 h-24 w-24 rounded-3xl bg-sky-200/30"></div>
          <div className="mt-5 space-y-3 flex flex-col items-center">
            <div className="h-8 w-48 rounded-lg bg-slate-200/50"></div>
            <div className="h-4 w-32 rounded-lg bg-slate-100/50"></div>
          </div>
          <div className="mt-6 mx-auto h-12 w-full max-w-[320px] rounded-2xl bg-emerald-100/30"></div>
        </div>

        {/* Form Fields Skeleton */}
        <div className="space-y-4 px-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 rounded bg-slate-100"></div>
              <div className="h-12 w-full rounded-xl bg-white border border-slate-100"></div>
            </div>
          ))}
        </div>

        {/* Price Card Skeleton */}
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-24 rounded bg-slate-200/50"></div>
            <div className="h-4 w-12 rounded bg-slate-200/50"></div>
          </div>
          <div className="h-1 pt-2 border-t border-slate-200/20 flex justify-between">
            <div className="h-6 w-20 rounded bg-emerald-100/50"></div>
            <div className="h-6 w-16 rounded bg-emerald-100/50"></div>
          </div>
        </div>

        {/* Button Skeleton */}
        <div className="h-14 w-full rounded-2xl bg-emerald-200/50"></div>
      </div>
    </div>
  );
}
