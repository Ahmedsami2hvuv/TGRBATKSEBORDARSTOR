/** تلوين بلوكات الطلب حسب الحالة (مصدر موحّد: قائمة التتبع + صفحة تفاصيل الطلب) */
export function getRouteBadgeStyle(status: string): string {
  switch (status) {
    case "new":
    case "pending":
      return "bg-gradient-to-l from-sky-500 to-sky-400 text-white shadow-[0_2px_8px_rgba(14,165,233,0.25)]";
    case "assigned":
      return "bg-gradient-to-l from-rose-600 to-red-500 text-white shadow-[0_2px_8px_rgba(225,29,72,0.25)]";
    case "delivering":
      return "bg-gradient-to-l from-[#FFC107] to-amber-400 text-[#0B2E8C] font-black shadow-[0_2px_8px_rgba(245,158,11,0.25)]";
    case "delivered":
      return "bg-gradient-to-l from-[#0B2E8C] to-[#1E4DB7] text-white shadow-[0_2px_8px_rgba(11,46,140,0.2)]";
    case "cancelled":
      return "bg-gradient-to-l from-slate-600 to-slate-500 text-white shadow-[0_2px_8px_rgba(100,116,139,0.2)]";
    default:
      return "bg-gradient-to-l from-[#0B2E8C] to-[#1E4DB7] text-white shadow-[0_2px_8px_rgba(11,46,140,0.2)]";
  }
}
