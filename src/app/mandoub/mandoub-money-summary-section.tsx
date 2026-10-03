import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export async function MandoubMoneySummarySection({
  totalsBaseline,
  sumDeliveryInDinar,
  sumPickupOutDinar,
  remainingNetDinar,
  sumEarningsDinar,
  adminTotalDinar,
  courierVehicleType,
  hrefWalletLedger,
  hideTitle = false,
  hideResetText = false,
  showAdminBox = false,
}: {
  totalsBaseline: Date | null;
  sumDeliveryInDinar: number;
  sumPickupOutDinar: number;
  remainingNetDinar: number;
  sumEarningsDinar: number;
  adminTotalDinar?: number;
  courierVehicleType: string | null;
  hrefWalletLedger: (ledger: "ward" | "sader" | "all") => string;
  hideTitle?: boolean;
  hideResetText?: boolean;
  showAdminBox?: boolean;
}) {
  return (
    <section
      aria-label="ملخص الأموال"
      className="mb-2.5 px-0.5 select-none"
      dir="rtl"
    >
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 w-full">
        {/* 1. بطاقة الصادر (هوية وصلي - أزرق ملكي سماوي) */}
        <Link
          href={hrefWalletLedger("sader")}
          className="relative flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-center border-2 border-[#38BDF8] bg-gradient-to-b from-[#0284C7] via-[#0369A1] to-[#075985] text-white shadow-[0_4px_15px_rgba(2,132,199,0.3)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer min-h-[58px] sm:min-h-[68px]"
          style={{
            boxShadow: "0 4px 15px rgba(2,132,199,0.25), inset 0 0 10px rgba(56,189,248,0.2)",
          }}
          title="الصادر: ما سلّمته للعميل عند تم الاستلام"
        >
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm">📤</span>
            <span className="text-[11px] sm:text-xs font-black text-[#BAE6FD] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              الصادر
            </span>
          </div>
          <span className="mt-1 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(sumPickupOutDinar)}
          </span>
        </Link>

        {/* 2. بطاقة الوارد (هوية وصلي - أزرق نيلي متألق) */}
        <Link
          href={hrefWalletLedger("ward")}
          className="relative flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-center border-2 border-[#60A5FA] bg-gradient-to-b from-[#1D4ED8] via-[#1E40AF] to-[#172554] text-white shadow-[0_4px_15px_rgba(29,78,216,0.3)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer min-h-[58px] sm:min-h-[68px]"
          style={{
            boxShadow: "0 4px 15px rgba(29,78,216,0.25), inset 0 0 10px rgba(96,165,250,0.2)",
          }}
          title="الوارد: ما استلمته من الزبون عند تم التسليم"
        >
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm">📥</span>
            <span className="text-[11px] sm:text-xs font-black text-[#BFDBFE] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              الوارد
            </span>
          </div>
          <span className="mt-1 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(sumDeliveryInDinar)}
          </span>
        </Link>

        {/* 3. بطاقة المتبقي (هوية وصلي - كحلي داكن فاخر) */}
        <Link
          href={hrefWalletLedger("all")}
          className="relative flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-center border-2 border-[#38BDF8] bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white shadow-[0_4px_15px_rgba(15,23,42,0.35)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer min-h-[58px] sm:min-h-[68px]"
          style={{
            boxShadow: "0 4px 15px rgba(15,23,42,0.35), inset 0 0 10px rgba(56,189,248,0.15)",
          }}
          title="المتبقي: صافي الأموال بعد خصم الصادر من الوارد"
        >
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm">⚖️</span>
            <span className="text-[11px] sm:text-xs font-black text-[#38BDF8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              المتبقي
            </span>
          </div>
          <span className="mt-1 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-[#F8FAFC] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(remainingNetDinar)}
          </span>
        </Link>

        {/* 4. بطاقة أرباحي (هوية وصلي - أزرق مع أصفر ذهبي ساطع) */}
        <div
          className="relative flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-center border-2 border-[#FDE047] bg-gradient-to-b from-[#0369A1] via-[#075985] to-[#082F49] text-white shadow-[0_4px_15px_rgba(253,224,71,0.25)] min-h-[58px] sm:min-h-[68px]"
          style={{
            boxShadow: "0 4px 15px rgba(253,224,71,0.2), inset 0 0 12px rgba(253,224,71,0.2)",
          }}
          title="أرباحي المحتسبة"
        >
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm">⚡</span>
            <span className="text-[11px] sm:text-xs font-black text-[#FDE047] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              أرباحي
            </span>
          </div>
          <span className="mt-1 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-[#FDE047] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(sumEarningsDinar)}
          </span>
        </div>
      </div>
    </section>
  );
}
