export default function StoreLoading() {
  return (
    <div className="space-y-6 py-8" dir="rtl">
      <div className="h-10 w-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      <div className="h-48 md:h-64 rounded-[2.5rem] bg-slate-100 dark:bg-slate-800 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="aspect-[4/5] rounded-[2rem] bg-slate-100 dark:bg-slate-800 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
