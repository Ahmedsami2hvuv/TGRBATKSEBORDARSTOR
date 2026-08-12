export default function StoreLoading() {
  return (
    <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="relative w-24 h-24 mb-4">
        {/* دوائر متحركة */}
        <div className="absolute inset-0 border-4 border-green-100 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-green-500 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          🛍️
        </div>
      </div>
      <h3 className="text-lg font-black text-slate-800 mb-1">جاري التحميل...</h3>
      <p className="text-sm text-slate-500 font-medium">يرجى الانتظار لحظات</p>
    </div>
  );
}
