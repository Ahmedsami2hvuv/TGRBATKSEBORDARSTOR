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
      aria-label="ملخص الأموال الملكي"
      className="mb-2.5 px-0.5 select-none"
      dir="rtl"
    >
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 w-full">
        {/* 1. بطاقة الصادر (الزمردية الملكية المذهبة) */}
        <Link
          href={hrefWalletLedger("sader")}
          className="relative flex flex-col items-center justify-between rounded-2xl py-2 px-1 text-center border-2 border-[#C9A86A] bg-gradient-to-b from-[#0F4D3A] via-[#0A3D2E] to-[#062016] text-white shadow-[0_4px_15px_rgba(10,61,46,0.35)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer min-h-[66px] sm:min-h-[76px]"
          style={{
            boxShadow: "0 4px 15px rgba(10,61,46,0.35), inset 0 0 10px rgba(201,168,106,0.15)",
          }}
          title="الصادر: ما سلّمته للعميل عند تم الاستلام"
        >
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm">🌿</span>
            <span className="text-[11px] sm:text-xs font-black text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              الصادر
            </span>
          </div>
          <span className="my-0.5 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(sumPickupOutDinar)}
          </span>
          <span className="text-[8px] sm:text-[9.5px] font-bold text-[#A7F3D0]/80 leading-none">
            كشف الصادر
          </span>
        </Link>

        {/* 2. بطاقة الوارد (الياقوتية العنابية المذهبة) */}
        <Link
          href={hrefWalletLedger("ward")}
          className="relative flex flex-col items-center justify-between rounded-2xl py-2 px-1 text-center border-2 border-[#C9A86A] bg-gradient-to-b from-[#5B1010] via-[#4A0D0D] to-[#2D0606] text-white shadow-[0_4px_15px_rgba(91,16,16,0.35)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer min-h-[66px] sm:min-h-[76px]"
          style={{
            boxShadow: "0 4px 15px rgba(91,16,16,0.35), inset 0 0 10px rgba(201,168,106,0.15)",
          }}
          title="الوارد: ما استلمته من الزبون عند تم التسليم"
        >
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm">💎</span>
            <span className="text-[11px] sm:text-xs font-black text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              الوارد
            </span>
          </div>
          <span className="my-0.5 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(sumDeliveryInDinar)}
          </span>
          <span className="text-[8px] sm:text-[9.5px] font-bold text-[#FECDD3]/80 leading-none">
            كشف الوارد
          </span>
        </Link>

        {/* 3. بطاقة المتبقي (الياقوت الأزرق الملكي المذهب) */}
        <Link
          href={hrefWalletLedger("all")}
          className="relative flex flex-col items-center justify-between rounded-2xl py-2 px-1 text-center border-2 border-[#C9A86A] bg-gradient-to-b from-[#0F2D4D] via-[#0A223D] to-[#061526] text-white shadow-[0_4px_15px_rgba(15,45,77,0.35)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer min-h-[66px] sm:min-h-[76px]"
          style={{
            boxShadow: "0 4px 15px rgba(15,45,77,0.35), inset 0 0 10px rgba(201,168,106,0.15)",
          }}
          title="المتبقي: صافي الأموال بعد خصم الصادر من الوارد"
        >
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm">⚖️</span>
            <span className="text-[11px] sm:text-xs font-black text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              المتبقي
            </span>
          </div>
          <span className="my-0.5 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(remainingNetDinar)}
          </span>
          <span className="text-[8px] sm:text-[9.5px] font-bold text-[#BFDBFE]/80 leading-none">
            سجل المحفظة
          </span>
        </Link>

        {/* 4. بطاقة الأرباح (الذهبية الكهرمانية اللامعة) */}
        <div
          className="relative flex flex-col items-center justify-between rounded-2xl py-2 px-1 text-center border-2 border-[#F5D77F] bg-gradient-to-b from-[#784A0D] via-[#5C3708] to-[#362004] text-white shadow-[0_4px_15px_rgba(120,74,13,0.35)] min-h-[66px] sm:min-h-[76px]"
          style={{
            boxShadow: "0 4px 15px rgba(120,74,13,0.35), inset 0 0 12px rgba(245,215,127,0.25)",
          }}
          title={
            courierVehicleType === "bike"
              ? "أرباح التوصيل (نصف التوصيل لكل طلب مُسلَّم)"
              : "أرباح التوصيل (ثلثي كلفة التوصيل لكل طلب مُسلَّم)"
          }
        >
          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm">👑</span>
            <span className="text-[11px] sm:text-xs font-black text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              أرباحي
            </span>
          </div>
          <span className="my-0.5 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-[#F5D77F] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(sumEarningsDinar)}
          </span>
          <span className="text-[8px] sm:text-[9.5px] font-bold text-[#FDE68A]/80 leading-none">
            أرباح التوصيل
          </span>
        </div>
      </div>
    </section>
  );
}
