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
      className="mb-2.5 rounded-2xl p-1.5 sm:p-2.5 select-none"
      dir="rtl"
    >
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 w-full">
        {/* 1. بطاقة الصادر (الزمردية الملكية المذهبة) */}
        <Link
          href={hrefWalletLedger("sader")}
          className="relative flex flex-col items-center justify-between rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 text-center shadow-md border-2 border-[#C9A86A]/70 hover:border-[#F5D77F] transition-all active:scale-95 bg-no-repeat bg-[length:100%_100%] overflow-hidden group min-h-[64px] sm:min-h-[82px]"
          style={{
            backgroundImage: "url('/images/order-luxury/card-sader.webp')",
            boxShadow: "0 4px 15px rgba(10,61,46,0.4), inset 0 0 12px rgba(201,168,106,0.25)",
          }}
          title="الصادر: ما سلّمته للعميل عند تم الاستلام"
        >
          <div className="flex items-center gap-1 z-10">
            <span className="text-xs sm:text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">🌿</span>
            <span className="text-[10px] sm:text-xs font-black text-[#F5D77F] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight">
              الصادر
            </span>
          </div>
          <span className="z-10 mt-0.5 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(sumPickupOutDinar)}
          </span>
          <span className="text-[8px] sm:text-[9px] font-bold text-[#A7F3D0] opacity-80 z-10">
            سجل الصادر ←
          </span>
        </Link>

        {/* 2. بطاقة الوارد (الياقوتية الملكية المذهبة) */}
        <Link
          href={hrefWalletLedger("ward")}
          className="relative flex flex-col items-center justify-between rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 text-center shadow-md border-2 border-[#C9A86A]/70 hover:border-[#F5D77F] transition-all active:scale-95 bg-no-repeat bg-[length:100%_100%] overflow-hidden group min-h-[64px] sm:min-h-[82px]"
          style={{
            backgroundImage: "url('/images/order-luxury/card-ward.webp')",
            boxShadow: "0 4px 15px rgba(159,18,57,0.4), inset 0 0 12px rgba(201,168,106,0.25)",
          }}
          title="الوارد: ما استلمته من الزبون عند تم التسليم"
        >
          <div className="flex items-center gap-1 z-10">
            <span className="text-xs sm:text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">💎</span>
            <span className="text-[10px] sm:text-xs font-black text-[#F5D77F] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight">
              الوارد
            </span>
          </div>
          <span className="z-10 mt-0.5 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(sumDeliveryInDinar)}
          </span>
          <span className="text-[8px] sm:text-[9px] font-bold text-[#FECDD3] opacity-80 z-10">
            سجل الوارد ←
          </span>
        </Link>

        {/* 3. بطاقة المتبقي (الياقوت الأزرق الملكي المذهب) */}
        <Link
          href={hrefWalletLedger("all")}
          className="relative flex flex-col items-center justify-between rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 text-center shadow-md border-2 border-[#C9A86A]/70 hover:border-[#F5D77F] transition-all active:scale-95 bg-no-repeat bg-[length:100%_100%] overflow-hidden group min-h-[64px] sm:min-h-[82px]"
          style={{
            backgroundImage: "url('/images/order-luxury/card-remaining.webp')",
            boxShadow: "0 4px 15px rgba(30,58,138,0.4), inset 0 0 12px rgba(201,168,106,0.25)",
          }}
          title="المتبقي: صافي الأموال بعد خصم الصادر من الوارد"
        >
          <div className="flex items-center gap-1 z-10">
            <span className="text-xs sm:text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">⚖️</span>
            <span className="text-[10px] sm:text-xs font-black text-[#F5D77F] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight">
              المتبقي
            </span>
          </div>
          <span className="z-10 mt-0.5 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
            {formatDinarAsAlfWithUnit(remainingNetDinar)}
          </span>
          <span className="text-[8px] sm:text-[9px] font-bold text-[#BFDBFE] opacity-80 z-10">
            المحفظة ←
          </span>
        </Link>

        {/* 4. بطاقة الأرباح (الذهبية الملكية المضيئة) */}
        <div
          className="relative flex flex-col items-center justify-between rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 text-center shadow-md border-2 border-[#F5D77F] transition-all bg-no-repeat bg-[length:100%_100%] overflow-hidden min-h-[64px] sm:min-h-[82px]"
          style={{
            backgroundImage: "url('/images/order-luxury/card-earnings.webp')",
            boxShadow: "0 4px 15px rgba(180,83,9,0.4), inset 0 0 15px rgba(245,215,127,0.35)",
          }}
          title={
            courierVehicleType === "bike"
              ? "أرباح التوصيل (نصف التوصيل لكل طلب مُسلَّم)"
              : "أرباح التوصيل (ثلثي كلفة التوصيل لكل طلب مُسلَّم)"
          }
        >
          <div className="flex items-center gap-1 z-10">
            <span className="text-xs sm:text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">👑</span>
            <span className="text-[10px] sm:text-xs font-black text-[#0A1A18] drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] tracking-tight">
              أرباحي
            </span>
          </div>
          <span className="z-10 mt-0.5 block text-xs sm:text-sm md:text-base font-black font-mono tabular-nums leading-none text-[#0A1A18] drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
            {formatDinarAsAlfWithUnit(sumEarningsDinar)}
          </span>
          <span className="text-[8px] sm:text-[9px] font-black text-[#5B3E06] z-10">
            أرباح التوصيل
          </span>
        </div>
      </div>
    </section>
  );
}
