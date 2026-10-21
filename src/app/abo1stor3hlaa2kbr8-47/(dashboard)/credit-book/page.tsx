import { getPartners } from "./actions";
import { CreditBookClient } from "./credit-book-client";
import { getCurrentSessionIsAccountant } from "@/lib/admin-session";
import { BookOpen, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CreditBookPage() {
  const [initialPartners, isAccountant] = await Promise.all([
    getPartners(),
    getCurrentSessionIsAccountant()
  ]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6" dir="rtl">
      {/* ترويسة الصفحة الفاخرة بثيم وصلي */}
      <div className="mb-5 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-[#D0DDFB] rounded-[22px] p-4 sm:p-5 shadow-[0_4px_16px_rgba(11,46,140,0.06)] relative overflow-hidden">
        {/* لمعة خلفية جمالية بلون وصلي */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-b from-[#0B2E8C]/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-[16px] bg-[#0B2E8C] flex items-center justify-center text-[#FFC107] shadow-[0_3px_10px_rgba(11,46,140,0.22)] shrink-0">
            <BookOpen className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#0B2E8C] tracking-tight">
                دفتر الديون العام
              </h1>
              <span className="inline-flex items-center gap-1 bg-[#F0F4FF] text-[#1E4DB7] text-[11px] font-black px-2.5 py-0.5 rounded-full border border-[#D0DDFB]">
                <Sparkles className="w-3 h-3 text-[#FFC107]" />
                <span>نظام وصلي المالي</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs sm:text-[13px] font-bold text-[#1E4DB7]/75">
              إدارة شاملة لحسابات ومستحقات المناديب، المجهزين، المحلات، الموردين والزبائن.
            </p>
          </div>
        </div>
      </div>

      <CreditBookClient initialPartners={initialPartners} isAccountant={isAccountant} />
    </div>
  );
}
