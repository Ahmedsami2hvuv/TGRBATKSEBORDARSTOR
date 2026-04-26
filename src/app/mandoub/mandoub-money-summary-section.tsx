import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export function MandoubMoneySummarySection({
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
      className="mb-2 rounded-xl border border-slate-200/90 bg-white px-2 py-2 shadow-sm backdrop-blur-sm sm:px-3 dark:bg-[#131418] dark:border-slate-800"
    >
      {!hideTitle ? (
        <h2 className="mb-1.5 px-0.5 text-[11px] font-bold text-slate-600 sm:text-xs dark:text-slate-400">ملخص الأموال</h2>
      ) : null}
      {!hideResetText && totalsBaseline ? (
        <p className="mb-2 rounded-md border border-slate-200/80 bg-slate-50/90 px-1.5 py-1 text-[9px] font-medium leading-snug text-slate-600 sm:text-[10px] dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400">
          منذ آخر <strong className="text-slate-800 dark:text-slate-200">تصفير</strong>:{" "}
          <span className="tabular-nums">
            {totalsBaseline.toLocaleString("ar-IQ-u-nu-latn", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </p>
      ) : null}
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:overflow-visible sm:pb-0">
        <Link
          href={hrefWalletLedger("ward")}
          className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border-2 border-red-500 bg-red-50 px-1.5 py-1.5 text-center shadow-sm ring-red-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2 dark:bg-[#2d0a0a] dark:border-red-900"
          title="ما استلمته من الزبون عند تم التسليم — عرض معاملات الوارد"
        >
          <span className="text-[9px] font-bold leading-tight text-red-900 sm:text-[10px] dark:text-red-400">الوارد</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-red-800 sm:text-base dark:text-red-200">
            {formatDinarAsAlfWithUnit(sumDeliveryInDinar)}
          </span>
        </Link>
        <Link
          href={hrefWalletLedger("sader")}
          className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border-2 border-emerald-600 bg-emerald-50 px-1.5 py-1.5 text-center shadow-sm ring-emerald-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2 dark:bg-[#062016] dark:border-emerald-900"
          title="ما سلّمته للعميل عند تم الاستلام — عرض معاملات الصادر"
        >
          <span className="text-[9px] font-bold leading-tight text-emerald-900 sm:text-[10px] dark:text-emerald-400">الصادر</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-emerald-800 sm:text-base dark:text-emerald-200">
            {formatDinarAsAlfWithUnit(sumPickupOutDinar)}
          </span>
        </Link>
        <Link
          href={hrefWalletLedger("all")}
          className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border-2 border-blue-600 bg-blue-50 px-1.5 py-1.5 text-center shadow-sm ring-blue-300/30 transition hover:ring-2 sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2 dark:bg-[#0a192f] dark:border-blue-900"
          title="وارد − صادر — سجل كامل في المحفظة"
        >
          <span className="text-[9px] font-bold leading-tight text-blue-900 sm:text-[10px] dark:text-blue-400">المتبقي</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-blue-800 sm:text-base dark:text-blue-200">
            {formatDinarAsAlfWithUnit(remainingNetDinar)}
          </span>
        </Link>
        <div
          className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border border-amber-300 bg-amber-50 px-1.5 py-1.5 text-center shadow-sm sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2 dark:bg-[#201906] dark:border-amber-900"
          title={
            courierVehicleType === "bike"
              ? "نصف التوصيل لكل طلب مُسلَّم"
              : "ثلثي كلفة التوصيل لكل طلب مُسلَّم"
          }
        >
          <span className="text-[9px] font-bold leading-tight text-amber-950 sm:text-[10px] dark:text-amber-500">أرباحي</span>
          <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-amber-900 sm:text-base dark:text-amber-400">
            {formatDinarAsAlfWithUnit(sumEarningsDinar)}
          </span>
        </div>
        {showAdminBox && adminTotalDinar !== undefined ? (
          <div
            className="flex min-w-[4.75rem] max-w-[25%] flex-1 shrink-0 flex-col rounded-lg border-2 border-violet-400 bg-violet-50 px-1.5 py-1.5 text-center shadow-sm sm:min-w-0 sm:max-w-none sm:px-2 sm:py-2 dark:bg-[#1a0a2f] dark:border-violet-900"
            title="إجمالي مستحقات الإدارة — لا يتأثر بالتصفير"
          >
            <span className="text-[9px] font-bold leading-tight text-violet-900 sm:text-[10px] dark:text-violet-400">الإدارة</span>
            <span className="mt-0.5 block text-sm font-black tabular-nums leading-none text-violet-800 sm:text-base dark:text-violet-300">
              {formatDinarAsAlfWithUnit(adminTotalDinar)}
            </span>
            <span className="mt-0.5 text-[7px] leading-tight text-violet-500 sm:text-[8px] dark:text-violet-600">لا يتصفر</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
