"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { BulkOrdersState } from "../bulk-actions";
import { bulkUpdateOrdersStatus } from "../bulk-actions";
import type { TrackingTableRow } from "./order-tracking-table-body";
import { UnifiedOrderListTable } from "@/components/unified-order-list-table";
import type { MandoubRow } from "@/app/mandoub/mandoub-order-table";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { mandoubShopNameVividClass } from "@/lib/order-status-style";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { formatBaghdadDateFriendly, getBaghdadDateString } from "@/lib/baghdad-time";
import { formatDinarAsAlf, dinarDecimalToAlfInputString, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  submitAdminPickupMoney,
  submitAdminDeliveryMoney,
  type MandoubCashState,
} from "@/app/mandoub/cash-actions";
import {
  moneySaderAmountInputClass,
  moneySaderRemainValueClass,
  moneySaderSummaryBoxClass,
  moneySaderTotalValueClass,
  moneyWardAmountInputClass,
  moneyWardRemainValueClass,
  moneyWardSummaryBoxClass,
  moneyWardTotalValueClass,
} from "@/lib/money-entry-ui";

const STATUS_UI: Record<string, { ar: string; dot: string }> = {
  pending: { ar: "جديد", dot: "bg-red-500 ring-2 ring-red-200/70" },
  assigned: { ar: "بانتظار المندوب", dot: "bg-red-500 ring-2 ring-red-200/70" },
  delivering: { ar: "عند المندوب", dot: "bg-amber-500 ring-2 ring-amber-200/80" },
  delivered: { ar: "تم التسليم", dot: "bg-emerald-500 ring-2 ring-emerald-200/80" },
  cancelled: { ar: "مرفوض", dot: "bg-slate-500 ring-2 ring-slate-200/80" },
  archived: { ar: "مؤرشف", dot: "bg-violet-500 ring-2 ring-violet-200/80" },
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

const QUICK_STATUS_VALUES = [
  { value: "all", label: "أي حالة" },
  { value: "pending", label: "جديد" },
  { value: "assigned", label: "بانتظار المندوب" },
  { value: "delivering", label: "عند المندوب" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "مرفوض" },
  { value: "archived", label: "مؤرشف" },
] as const;

function AdminPickupFormModal({
  orderId,
  orderNumber,
  courierName,
  nextPath,
  expectedAlfHint,
  remainingAlfHint,
  onSuccess,
  onClose,
}: {
  orderId: string;
  orderNumber: number;
  courierName?: string | null;
  nextPath: string;
  expectedAlfHint: string;
  remainingAlfHint: string;
  onSuccess: (msg: string) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [advanceStatus, setAdvanceStatus] = useState("delivering");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const advanceStatusRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const submitModeRef = useRef<HTMLInputElement>(null);

  const displayTargetAlf = remainingAlfHint || expectedAlfHint || "";

  async function handleFormSubmit(fd: FormData) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await submitAdminPickupMoney({}, fd);
      if (res.error) {
        setError(res.error);
        setPending(false);
      } else {
        const msg = courierName
          ? `تم استلام الطلب وتسجيل الصادر بالنيابة عن المندوب (${courierName}) بنجاح! ⚡`
          : "تم استلام الطلب وتسجيل الصادر للإدارة بنجاح! ⚡";
        onSuccess(msg);
      }
    } catch (e: any) {
      setError(e?.message || "حدث خطأ غير متوقع.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 text-right">
      <p className="font-bold text-emerald-950 text-sm">اكتب المبلغ الذي سلّمته للعميل أو انقر على الزر السريع:</p>
      
      <div className={moneySaderSummaryBoxClass}>
        <span>سعر الطلب: <span className={moneySaderTotalValueClass}>{expectedAlfHint || "—"}</span></span>
        <span>المتبقي للصادر: <span className={moneySaderRemainValueClass}>{remainingAlfHint || "—"}</span></span>
      </div>

      <form
        ref={formRef}
        action={handleFormSubmit}
        className="space-y-3"
      >
        <input ref={submitModeRef} type="hidden" name="mandoubMoneySubmitMode" value="" />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="next" value={nextPath} />
        <input ref={advanceStatusRef} type="hidden" name="advanceStatus" value={advanceStatus} />

        {/* سطر الإدخال: باليمين خانة مصغرة جداً يدوياً ، وباليسار زر مربع كبيييير جداً للنقر السريع المباشر */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* اليمين: خانة كتابة السعر يدوياً مصغرة ومضغوطة جداً */}
          <div className="w-28 sm:w-32 shrink-0 space-y-1">
            <label className="text-[10px] font-bold text-slate-500 block text-center truncate">سعر آخر يدوياً:</label>
            <input
              ref={amountRef}
              name="amountAlf"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={pending}
              className={`${moneySaderAmountInputClass} animate-placeholder w-full text-center text-xs h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold`}
              placeholder="اكتب السعر"
              inputMode="decimal"
              enterKeyHint="done"
            />
          </div>

          {/* اليسار: زر مربع كبيييييير جداً وضخم ملفت للنقر السريع بلمسة واحدة */}
          {displayTargetAlf && (
            <div className="relative flex-1 flex justify-end min-w-0">
              <span className="pointer-events-none absolute -top-3 -right-1 text-sm star-particle-1 z-10 select-none">✨</span>
              <span className="pointer-events-none absolute -bottom-2 left-1 text-sm star-particle-2 z-10 select-none">💫</span>

              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  if (amountRef.current) amountRef.current.value = displayTargetAlf;
                  if (submitModeRef.current) submitModeRef.current.value = "";
                  if (advanceStatusRef.current) advanceStatusRef.current.value = "delivering";
                  setAmount(displayTargetAlf);
                  setAdvanceStatus("delivering");
                  setTimeout(() => {
                    formRef.current?.requestSubmit();
                  }, 40);
                }}
                className="magical-money-block-green w-full max-w-[210px] h-20 flex items-center justify-center rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 p-2 font-black text-white shadow-xl active:scale-95 transition-all cursor-pointer select-none group disabled:opacity-50"
                title="اضغط لتأكيد وإرسال المبلغ وتغيير الحالة مباشرة"
              >
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl sm:text-5xl font-black drop-shadow-md tracking-tighter leading-none">
                    {displayTargetAlf}
                  </span>
                  <span className="text-xs sm:text-sm font-bold opacity-90 shrink-0 select-none">
                    ألف
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-black text-slate-800 block">سبب الاختلاف / ملاحظة (إن وجد):</label>
          <textarea
            ref={noteRef}
            name="mismatchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={pending}
            rows={2}
            className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-emerald-600 focus:outline-hidden"
            placeholder="اكتب الملاحظة هنا إن كان المبلغ غير مطابق..."
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <input
            type="checkbox"
            id="advancePickupDeliveringTrackingModal"
            checked={advanceStatus === "delivering"}
            disabled={pending}
            onChange={(e) => {
              const val = e.target.checked ? "delivering" : "";
              setAdvanceStatus(val);
              if (advanceStatusRef.current) advanceStatusRef.current.value = val;
            }}
            className="size-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <label htmlFor="advancePickupDeliveringTrackingModal" className="text-xs font-black text-emerald-950 cursor-pointer select-none">
            تغيير حالة الطلب تلقائياً إلى «قيد التوصيل» 🛵
          </label>
        </div>

        {error && <p className="text-xs font-black text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            إلغاء
          </button>
          
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (submitModeRef.current) submitModeRef.current.value = "statusOnlyNoAmount";
              if (advanceStatusRef.current) advanceStatusRef.current.value = "delivering";
              setAdvanceStatus("delivering");
              setTimeout(() => {
                formRef.current?.requestSubmit();
              }, 40);
            }}
            className="rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-2 text-xs font-black text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:opacity-60 cursor-pointer"
            title="تحويل الحالة إلى «قيد التوصيل» دون تسجيل مبلغ صادر"
          >
            لم أدفع (تغيير الحالة فقط)
          </button>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {pending ? "جاري الحفظ... ⏳" : "💾 تأكيد وتسجيل الصادر"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminDeliveryFormModal({
  orderId,
  orderNumber,
  courierName,
  nextPath,
  expectedAlfHint,
  remainingAlfHint,
  onSuccess,
  onClose,
  prepaidAll = false,
}: {
  orderId: string;
  orderNumber: number;
  courierName?: string | null;
  nextPath: string;
  expectedAlfHint: string;
  remainingAlfHint: string;
  onSuccess: (msg: string) => void;
  onClose: () => void;
  prepaidAll?: boolean;
}) {
  const [amount, setAmount] = useState(prepaidAll ? "0" : "");
  const [note, setNote] = useState(prepaidAll ? "كلشي واصل" : "");
  const [advanceStatus, setAdvanceStatus] = useState("delivered");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const advanceStatusRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const submitModeRef = useRef<HTMLInputElement>(null);

  const displayTargetAlf = prepaidAll ? "0" : (remainingAlfHint || expectedAlfHint || "");

  async function handleFormSubmit(fd: FormData) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await submitAdminDeliveryMoney({}, fd);
      if (res.error) {
        setError(res.error);
        setPending(false);
      } else {
        const msg = courierName
          ? `تم تسليم الطلب واحتساب أرباح التوصيل للمندوب (${courierName}) بنجاح! 🎉`
          : "تم تسليم الطلب وتسجيل الوارد والأرباح للإدارة بنجاح! 🎉";
        onSuccess(msg);
      }
    } catch (e: any) {
      setError(e?.message || "حدث خطأ غير متوقع.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 text-right">
      <p className="font-bold text-red-950 text-sm">
        {prepaidAll
          ? "الطلب واصل حسابه مسبقاً — انقر للتأكيد وتحويل الحالة إلى «تم التسليم»"
          : "اكتب المبلغ المستلم من الزبون أو انقر على الزر السريع:"}
      </p>

      <div className={moneyWardSummaryBoxClass}>
        <span>المبلغ الكلي: <span className={moneyWardTotalValueClass}>{prepaidAll ? "كل شي واصل" : expectedAlfHint || "—"}</span></span>
        <span>المتبقي للوارد: <span className={moneyWardRemainValueClass}>{prepaidAll ? "0" : remainingAlfHint || "—"}</span></span>
      </div>

      <form
        ref={formRef}
        action={handleFormSubmit}
        className="space-y-3"
      >
        <input ref={submitModeRef} type="hidden" name="mandoubMoneySubmitMode" value="" />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="next" value={nextPath} />
        <input ref={advanceStatusRef} type="hidden" name="advanceStatus" value={advanceStatus} />

        {/* سطر الإدخال: باليمين خانة مصغرة جداً يدوياً ، وباليسار زر مربع كبيييير جداً للنقر السريع المباشر */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* اليمين: خانة كتابة السعر يدوياً مصغرة ومضغوطة جداً */}
          <div className="w-28 sm:w-32 shrink-0 space-y-1">
            <label className="text-[10px] font-bold text-slate-500 block text-center truncate">سعر آخر يدوياً:</label>
            <input
              ref={amountRef}
              name="amountAlf"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={pending}
              className={`${moneyWardAmountInputClass} animate-placeholder w-full text-center text-xs h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold`}
              placeholder="اكتب السعر"
              inputMode="decimal"
              enterKeyHint="done"
            />
          </div>

          {/* اليسار: زر مربع كبيييييير جداً وضخم ملفت للنقر السريع بلمسة واحدة */}
          {displayTargetAlf !== "" && (
            <div className="relative flex-1 flex justify-end min-w-0">
              <span className="pointer-events-none absolute -top-3 -right-1 text-sm star-particle-1 z-10 select-none">✨</span>
              <span className="pointer-events-none absolute -bottom-2 left-1 text-sm star-particle-2 z-10 select-none">💫</span>

              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  if (amountRef.current) amountRef.current.value = displayTargetAlf;
                  if (submitModeRef.current) submitModeRef.current.value = "";
                  if (advanceStatusRef.current) advanceStatusRef.current.value = "delivered";
                  setAmount(displayTargetAlf);
                  setAdvanceStatus("delivered");
                  setTimeout(() => {
                    formRef.current?.requestSubmit();
                  }, 40);
                }}
                className="magical-money-block-red w-full max-w-[210px] h-20 flex items-center justify-center rounded-2xl border-2 border-red-500 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 p-2 font-black text-white shadow-xl active:scale-95 transition-all cursor-pointer select-none group disabled:opacity-50"
                title="اضغط لتأكيد وإرسال المبلغ وتغيير الحالة مباشرة"
              >
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl sm:text-5xl font-black drop-shadow-md tracking-tighter leading-none">
                    {displayTargetAlf}
                  </span>
                  <span className="text-xs sm:text-sm font-bold opacity-90 shrink-0 select-none">
                    {prepaidAll ? "واصل" : "ألف"}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-black text-slate-800 block">سبب الاختلاف / ملاحظة (إن وجد):</label>
          <textarea
            ref={noteRef}
            name="mismatchNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={pending}
            rows={2}
            className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-rose-600 focus:outline-hidden"
            placeholder="اكتب الملاحظة هنا إن كان المبلغ غير مطابق..."
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
          <input
            type="checkbox"
            id="advanceDeliveryDeliveredTrackingModal"
            checked={advanceStatus === "delivered"}
            disabled={pending}
            onChange={(e) => {
              const val = e.target.checked ? "delivered" : "";
              setAdvanceStatus(val);
              if (advanceStatusRef.current) advanceStatusRef.current.value = val;
            }}
            className="size-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500 cursor-pointer"
          />
          <label htmlFor="advanceDeliveryDeliveredTrackingModal" className="text-xs font-black text-rose-950 cursor-pointer select-none">
            تغيير حالة الطلب تلقائياً إلى «تم التسليم» 🎉
          </label>
        </div>

        {error && <p className="text-xs font-black text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            إلغاء
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (submitModeRef.current) submitModeRef.current.value = "statusOnlyNoAmount";
              if (advanceStatusRef.current) advanceStatusRef.current.value = "delivered";
              setAdvanceStatus("delivered");
              setTimeout(() => {
                formRef.current?.requestSubmit();
              }, 40);
            }}
            className="rounded-xl border-2 border-rose-400 bg-rose-50 px-4 py-2 text-xs font-black text-rose-950 shadow-sm transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
            title="تحويل الحالة إلى «تم التسليم» دون تسجيل مبلغ وارد"
          >
            تأكيد تسليم بدون مبلغ
          </button>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {pending ? "جاري الحفظ... ⏳" : "💾 تأكيد وتسجيل الوارد"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TrackingCardMoneyBadges({ o }: { o: TrackingTableRow }) {
  const pickup = o.pickupSumDinar ?? null;
  const preparerPickup = o.preparerPickupSumDinar ?? null;
  const adminPickup = o.adminPickupSumDinar ?? null;
  const delivery = o.deliverySumDinar ?? null;
  const preparerDelivery = o.preparerDeliverySumDinar ?? null;

  const showPickup = pickup != null && Number.isFinite(pickup) && pickup > 0;
  const showPreparerPickup = preparerPickup != null && Number.isFinite(preparerPickup) && preparerPickup > 0;
  const showAdminPickup = adminPickup != null && Number.isFinite(adminPickup) && adminPickup > 0;
  const showDelivery = delivery != null && Number.isFinite(delivery) && delivery > 0;
  const showPreparerDelivery = preparerDelivery != null && Number.isFinite(preparerDelivery) && preparerDelivery > 0;

  const hasAnyBadge =
    showPickup ||
    showPreparerPickup ||
    showAdminPickup ||
    showDelivery ||
    showPreparerDelivery ||
    o.wardMismatchType ||
    o.saderMismatchType ||
    (o.noWardRecorded && o.orderStatus === "delivered");

  if (!hasAnyBadge) return null;

  const pillBase =
    "inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-black leading-none tabular-nums shadow-xs border shrink-0";

  return (
    <div className="flex items-center gap-1 flex-wrap shrink-0" onClick={(e) => e.stopPropagation()}>
      {showPickup && (
        <span className={`${pillBase} bg-emerald-600 text-white border-emerald-700`} title="صادر المندوب">
          {formatDinarAsAlf(pickup)}
        </span>
      )}
      {showPreparerPickup && (
        <span className={`${pillBase} bg-amber-500 text-white border-amber-600`} title="صادر المجهز">
          {formatDinarAsAlf(preparerPickup)}
        </span>
      )}
      {showAdminPickup && (
        <span className={`${pillBase} bg-blue-600 text-white border-blue-700`} title="صادر الإدارة">
          {formatDinarAsAlf(adminPickup)}
        </span>
      )}
      {showDelivery && (
        <span className={`${pillBase} bg-rose-600 text-white border-rose-700`} title="وارد المندوب">
          {formatDinarAsAlf(delivery)}
        </span>
      )}
      {showPreparerDelivery && (
        <span className={`${pillBase} bg-purple-600 text-white border-purple-700`} title="وارد المجهز">
          {formatDinarAsAlf(preparerDelivery)}
        </span>
      )}

      {o.wardMismatchType === "deficit" && (
        <span className={`${pillBase} bg-red-700 text-white border-red-800`} title="نقص بالوارد">
          نقص بالوارد
        </span>
      )}
      {o.saderMismatchType === "deficit" && (
        <span className={`${pillBase} bg-amber-700 text-white border-amber-800`} title="نقص بالصادر">
          نقص بالصادر
        </span>
      )}
      {o.wardMismatchType === "excess" && (
        <span className={`${pillBase} bg-emerald-800 text-white border-emerald-900`} title="زيادة بالوارد">
          زيادة بالوارد
        </span>
      )}
      {o.saderMismatchType === "excess" && (
        <span className={`${pillBase} bg-emerald-800 text-white border-emerald-900`} title="زيادة بالصادر">
          زيادة بالصادر
        </span>
      )}
      {o.noWardRecorded && o.orderStatus === "delivered" && (
        <span className={`${pillBase} bg-slate-700 text-white border-slate-800`} title="بدون وارد">
          بدون وارد
        </span>
      )}
    </div>
  );
}

function TrackingCardsView({
  rows,
  onOpenRow,
  onAssignOrder,
  onRejectOrder,
  onRestoreOrder,
  onAdminPickup,
  onAdminDelivery,
  icons,
  showSelectColumn,
  isSelected,
  onToggleOne,
  columns = 2,
}: {
  rows: TrackingTableRow[];
  onOpenRow: (id: string) => void;
  onAssignOrder: (row: TrackingTableRow) => void;
  onRejectOrder?: (row: TrackingTableRow) => void;
  onRestoreOrder?: (row: TrackingTableRow) => void;
  onAdminPickup?: (row: TrackingTableRow) => void;
  onAdminDelivery?: (row: TrackingTableRow) => void;
  icons: GlobalIconsConfig | null;
  showSelectColumn?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleOne?: (id: string) => void;
  columns?: 1 | 2 | 3;
}) {
  if (!rows.length) {
    return (
      <div className="py-12 text-center text-[#0A3D2E] font-bold bg-white rounded-3xl border-2 border-dashed border-[#C9A86A]/40 shadow-sm text-sm sm:text-base">
        لا توجد طلبات للعرض في هذه القائمة
      </div>
    );
  }

  const gridColsClass =
    columns === 1
      ? "grid grid-cols-1 gap-3.5"
      : columns === 2
      ? "grid grid-cols-1 md:grid-cols-2 gap-3.5"
      : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5";

  // تجميع الطلبات حسب اليوم بالتاريخ البغدادي الدقيق
  const groupedByDate: { dateKey: string; dateLabel: string; items: TrackingTableRow[] }[] = [];
  rows.forEach((row) => {
    const rawDate = row.createdAt ? (typeof row.createdAt === 'string' ? new Date(row.createdAt) : row.createdAt) : null;
    const dateKey = rawDate ? getBaghdadDateString(rawDate) : "unknown";
    const dateLabel = rawDate ? formatBaghdadDateFriendly(rawDate) : "طلبات أخرى";

    const lastGroup = groupedByDate[groupedByDate.length - 1];
    if (lastGroup && lastGroup.dateKey === dateKey) {
      lastGroup.items.push(row);
    } else {
      groupedByDate.push({ dateKey, dateLabel, items: [row] });
    }
  });

  return (
    <div className="space-y-6 pb-12">
      {groupedByDate.map((group) => (
        <div key={group.dateKey} className="space-y-3.5">
          {/* شريط الفاصل الزمني البارز بين الأيام باللون الأخضر الزمردي والذهبي الفاخر */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] border-y-2 border-[#C9A86A] px-4 py-2.5 text-[#FFF8F0] shadow-md flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-[#F5D77F] to-[#C9A86A] text-[#0A3D2E] flex items-center justify-center font-black shadow-xs border border-[#FFF0D0] text-sm">
                📅
              </div>
              <span className="text-xs sm:text-sm font-black tracking-wide">
                {group.dateLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-[#C9A86A]/20 px-3 py-0.5 text-xs font-black text-[#F5D77F] border border-[#C9A86A]/50">
                {group.items.length} طلب
              </span>
              <span className="text-xs text-[#F5D77F]">⚜️</span>
            </div>
          </div>

          {/* قائمة الكروت الملكية التابعة لهذا اليوم */}
          <div className={gridColsClass}>
            {group.items.map((o) => {
              const isPending = o.orderStatus === "pending";
              const isAssigned = o.orderStatus === "assigned";
              const isDelivering = o.orderStatus === "delivering";
              const isDelivered = o.orderStatus === "delivered";
              const isCancelled = o.orderStatus === "cancelled";

              const selected = isSelected ? isSelected(o.id) : false;

              const displayTotal = o.hasDebt && o.priceWithDebtLabel
                ? o.priceWithDebtLabel
                : o.totalLabel || "—";

              // استخراج رقم السعر فقط بدون الوحدة لوضعه بالدائرة الكبيرة الفاخرة
              const numericPrice = displayTotal.replace(/[^\d]/g, "") || displayTotal;

              const displayGoodsType = o.orderType && o.orderType !== "عام" && o.orderType !== "—"
                ? o.orderType
                : o.summary && o.summary.trim()
                ? o.summary
                : o.orderType || "—";

              const isDoubleRouteOrder = o.routeModeLabel === "وجهتين" && Boolean(o.secondCustomerRegionName);

              const headerTextStr = isDoubleRouteOrder
                ? `${o.regionName || "المرسل"} إلى ${o.secondCustomerRegionName || "المستلم"}`
                : `${o.shopCustomerLabel || "المحل"} إلى ${o.regionName || "المنطقة"}`;

              const hasAssignedCourier = Boolean(o.courierName && o.courierName !== "—" && o.courierName.trim() !== "");

              // حالات الطلب الخاصة
              const isPrepaid = Boolean(o.prepaidAll || o.totalLabel === "كل شي واصل" || o.totalLabel === "واصل");
              const isReverse = Boolean(isReversePickupOrderType(o.orderType) || o.orderType?.includes("عكسي") || o.orderType?.includes("راجع"));
              const hasGps = Boolean(o.hasCourierUploadedLocation || o.customerLocationUrl || !o.missingCustomerLocation);
              const isDoubleRoute = Boolean(o.routeModeLabel === "وجهتين");
              const hasPreparerPricing = Boolean(
                o.preparerShoppingJson &&
                  (typeof o.preparerShoppingJson === "object"
                    ? Object.keys(o.preparerShoppingJson).length > 0
                    : typeof o.preparerShoppingJson === "string"
                    ? (o.preparerShoppingJson as string).trim().length > 2
                    : false)
              );

              return (
                <div
                  key={o.id}
                  onClick={() => {
                    if (showSelectColumn && onToggleOne) {
                      onToggleOne(o.id);
                    } else {
                      onOpenRow(o.id);
                    }
                  }}
                  className={`group relative rounded-[22px] p-[2px] bg-gradient-to-b from-[#C9A86A] via-[#E8D5A8] to-[#C9A86A] shadow-[0_4px_20px_rgba(10,61,46,0.08)] hover:shadow-[0_8px_28px_rgba(201,168,106,0.25)] transition-all active:scale-[0.99] cursor-pointer ${
                    selected ? "ring-3 ring-[#0A3D2E]" : ""
                  }`}
                >
                  {/* جسم البطاقة الداخلي الأبيض العاجي الفاخر */}
                  <div className="rounded-[20px] bg-white p-3.5 relative overflow-hidden flex flex-col justify-between space-y-2.5">
                    
                    {/* زخارف الزوايا الأربع المنحوتة الفاخرة (Ornate Bracket Corners) */}
                    <span className="pointer-events-none absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#C9A86A] rounded-tr-md opacity-80" />
                    <span className="pointer-events-none absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#C9A86A] rounded-tl-md opacity-80" />
                    <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#C9A86A] rounded-br-md opacity-80" />
                    <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#C9A86A] rounded-bl-md opacity-80" />

                    {/* البادجات المالية العائمة أعلى الكرت */}
                    <div className="absolute -top-3.5 left-16 z-20 pointer-events-none flex items-center gap-1 shrink-0">
                      <TrackingCardMoneyBadges o={o} />
                    </div>

                    {/* 1. السطر العلوي: رقم الطلب # + شارة الوجهة المخملية العنابية في الوسط */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#C9A86A]/20 pb-2 min-w-0 w-full" onClick={(e) => e.stopPropagation()}>
                      {/* أقصى اليمين: رقم الطلب + خانة التحديد السريع */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {showSelectColumn && (
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggleOne && onToggleOne(o.id)}
                            className="size-5 rounded border-2 border-[#C9A86A] text-[#0A3D2E] focus:ring-[#C9A86A] cursor-pointer"
                          />
                        )}
                        <span className="text-base sm:text-lg font-black text-[#0A3D2E] tabular-nums tracking-tight font-mono">
                          #{o.orderNumber}
                        </span>
                      </div>

                      {/* شارة الوجهة المخملية العنابية في الوسط */}
                      <div
                        className="flex-1 min-w-0 rounded-full px-3 py-1 text-center font-black text-xs sm:text-[13px] text-white truncate shadow-xs border border-[#C9A86A]/50"
                        style={{
                          background: "linear-gradient(180deg, #8E2323 0%, #6E1818 100%)",
                        }}
                        title={headerTextStr}
                      >
                        {headerTextStr}
                      </div>

                      {/* شارة حالة الطلب المصغرة على اليسار */}
                      <div className="shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${
                          isPending ? "bg-red-600" : isAssigned ? "bg-red-500" : isDelivering ? "bg-amber-600" : isDelivered ? "bg-emerald-600" : "bg-slate-600"
                        }`}>
                          {isPending ? "جديد" : isAssigned ? "مسند" : isDelivering ? "بالتوصيل" : isDelivered ? "مسلّم" : "مرفوض"}
                        </span>
                      </div>
                    </div>

                    {/* 2. القسم الأوسط: نوع البضاعة يميناً + الدائرة الزمردية المركزية الضخمة + التوقيت يساراً */}
                    <div className="flex items-center justify-between py-1 px-1">
                      {/* النص الأيمن (نوع البضاعة / التفاصيل) */}
                      <div className="text-[13px] sm:text-[14px] font-extrabold text-[#0A3D2E] text-center w-[90px] sm:w-[105px] leading-snug truncate">
                        {displayGoodsType}
                        {o.customerName && (
                          <span className="block text-[10.5px] text-slate-500 font-bold truncate mt-0.5">
                            👤 {o.customerName}
                          </span>
                        )}
                      </div>

                      {/* الدائرة الزمردية المركزية الضخمة برقم السعر الذهبي البارز */}
                      <div className="relative shrink-0">
                        <div className="w-[66px] h-[66px] sm:w-[74px] sm:h-[74px] rounded-full bg-gradient-to-b from-[#0F4D3A] to-[#0A3D2E] border-[3px] border-[#C9A86A] flex items-center justify-center shadow-[0_4px_16px_rgba(10,61,46,0.3)] relative">
                          <div className="absolute inset-1 rounded-full border border-[#FFF0D0]/20 pointer-events-none" />
                          <span
                            className="text-[22px] sm:text-[26px] font-black leading-none select-none font-mono"
                            style={{
                              background: "linear-gradient(135deg, #FFF0D0 0%, #F5D77F 40%, #C9A86A 80%, #9E7D3B 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {numericPrice || "—"}
                          </span>
                        </div>
                        <span className="absolute -top-1 -right-1 text-[10px] text-[#C9A86A]">✦</span>
                        <span className="absolute -bottom-1 -left-1 text-[10px] text-[#C9A86A]">✦</span>
                      </div>

                      {/* النص الأيسر الأحمر العنابي (وقت الطلب أو فوري) */}
                      <div className="text-[12px] sm:text-[13px] font-black text-[#7A1F1F] text-center w-[90px] sm:w-[105px] leading-snug">
                        {o.orderNoteTime || "فوري"}
                        {isPrepaid && (
                          <span className="block text-[10px] text-emerald-600 font-bold mt-0.5">
                            (واصل)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3. سطر رقم هاتف الزبون + أزرار التعديل والأسعار والرفض (الطلب الثاني) */}
                    <div
                      className="flex items-center justify-between bg-[#FFF8F0] rounded-full px-3 py-1.5 border border-[#C9A86A]/40 shadow-2xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* اليمين: زر الرفض ❌ / إرجاع 🔄 + زر تعديل الطلب ✏️ + زر تعديل أسعار التجهيز 💰 */}
                      <div className="flex items-center gap-1 shrink-0">
                        {onRejectOrder && !isCancelled && !isDelivered && o.orderStatus !== "archived" && (
                          <button
                            type="button"
                            onClick={() => onRejectOrder(o)}
                            className="w-7 h-7 rounded-full bg-gradient-to-b from-[#F5A623] to-[#D97706] text-white flex items-center justify-center border border-[#FFF0D0] text-xs font-black shadow-xs hover:brightness-110 transition active:scale-90"
                            title="رفض الطلب ❌"
                          >
                            ✕
                          </button>
                        )}
                        {onRestoreOrder && isCancelled && (
                          <button
                            type="button"
                            onClick={() => onRestoreOrder(o)}
                            className="w-7 h-7 rounded-full bg-gradient-to-b from-sky-500 to-cyan-600 text-white flex items-center justify-center border border-[#FFF0D0] text-xs font-black shadow-xs hover:brightness-110 transition active:scale-90"
                            title="إرجاع الطلب المرفوض إلى جديد 🔄"
                          >
                            🔄
                          </button>
                        )}

                        {/* زر تعديل الطلب ✏️ */}
                        <Link
                          href={`${SECRET_ADMIN_PATH}/orders/${o.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 rounded-full bg-gradient-to-b from-[#F9E7B9] to-[#C9A86A] text-[#0A3D2E] flex items-center justify-center border border-[#FFF0D0] text-xs font-black shadow-xs hover:scale-105 transition active:scale-90"
                          title="تعديل الطلب ✏️"
                        >
                          ✏️
                        </Link>

                        {/* زر تعديل أسعار التجهيز 💰 */}
                        {hasPreparerPricing && (
                          <Link
                            href={`${SECRET_ADMIN_PATH}/orders/${o.id}/price`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-7 h-7 rounded-full bg-gradient-to-b from-[#F9E7B9] to-[#C9A86A] text-[#0A3D2E] flex items-center justify-center border border-[#FFF0D0] text-xs font-black shadow-xs hover:scale-105 transition active:scale-90"
                            title="تعديل أسعار التجهيز 💰"
                          >
                            💰
                          </Link>
                        )}
                      </div>

                      {/* اليسار: رقم هاتف الزبون مع أيقونة اتصال ذهبية */}
                      <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-mono font-bold text-[#0A3D2E]">
                        {o.customerAlternatePhone && o.customerAlternatePhone !== "—" && (
                          <span className="text-slate-400">
                            {o.customerAlternatePhone} /
                          </span>
                        )}
                        <span>{o.customerPhone || "—"}</span>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-b from-[#F5D77F] to-[#C9A86A] flex items-center justify-center shadow-xs">
                          <span className="text-[10px]">📞</span>
                        </div>
                      </div>
                    </div>

                    {/* 4. شريط الأزرار السفلية: نقل زر الإسناد هنا + زر الاستلام/التسليم + وجهتين + إيموجي اللوكيشن فقط (الطلب الثالث والرابع) */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      {/* زر الإسناد للمندوبين (تم نقله للأسفل كما طُلب) */}
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => onAssignOrder(o)}
                          className={`h-[34px] px-3 rounded-full text-xs font-black flex items-center gap-1.5 border shadow-xs transition active:scale-95 ${
                            hasAssignedCourier
                              ? "bg-[#0A3D2E] text-[#F5D77F] border-[#C9A86A]"
                              : "bg-[#0A3D2E] text-white border-[#C9A86A] animate-pulse"
                          }`}
                          title={hasAssignedCourier ? `تغيير المندوب (${o.courierName})` : "إسناد لمندوب"}
                        >
                          <span className="text-xs">🛵</span>
                          <span className="max-w-[100px] truncate">
                            {hasAssignedCourier ? o.courierName : "إسناد للمندوب"}
                          </span>
                        </button>
                      )}

                      {/* أزرار الاستلام والتسليم الخاصة بالإدارة ⚡ */}
                      {onAdminPickup && (isPending || isAssigned) && !isCancelled && !isDelivered && o.orderStatus !== "archived" && (
                        <button
                          type="button"
                          onClick={() => onAdminPickup(o)}
                          className="h-[34px] px-3.5 rounded-full bg-[#0A3D2E] text-white text-xs font-black flex items-center gap-1 border border-[#C9A86A] shadow-xs hover:brightness-110 transition active:scale-90"
                          title="استلام الطلب وتسجيل الصادر ⚡"
                        >
                          <span className="text-[#F5D77F]">⚡</span>
                          <span>استلام</span>
                        </button>
                      )}

                      {onAdminDelivery && isDelivering && !isCancelled && !isDelivered && o.orderStatus !== "archived" && (
                        <button
                          type="button"
                          onClick={() => onAdminDelivery(o)}
                          className="h-[34px] px-3.5 rounded-full bg-rose-700 text-white text-xs font-black flex items-center gap-1 border border-rose-500 shadow-xs hover:brightness-110 transition active:scale-90"
                          title="تسليم الطلب وتسجيل الوارد 🫴"
                        >
                          <span>🫴</span>
                          <span>تسليم</span>
                        </button>
                      )}

                      {/* زر وجهتين ➔ */}
                      {isDoubleRoute && (
                        <span className="h-[34px] px-3 rounded-full bg-[#0A3D2E] text-white text-xs font-black flex items-center gap-1 border border-[#C9A86A]/40 shadow-xs">
                          <span>وجهتين</span>
                          <span className="text-[#F5D77F]">➔</span>
                        </span>
                      )}

                      {/* شارة بدون لوكيشن / GPS: تم تعديلها لتكون إيموجي فقط كما طُلب في النقطة 4 */}
                      {hasGps ? (
                        <span
                          className="h-[34px] px-2.5 rounded-full bg-violet-700 text-white text-xs font-black flex items-center justify-center border border-violet-500 shadow-xs"
                          title="لوكيشن GPS متوفر"
                        >
                          GPS
                        </span>
                      ) : (
                        <span
                          className="size-[34px] rounded-full flex items-center justify-center text-white text-xs font-black shadow-xs border border-[#C9A86A]/60 animate-pulse"
                          style={{
                            background: "linear-gradient(180deg, #8E2323 0%, #6E1818 100%)",
                          }}
                          title="الزبون لا يملك لوكيشن ⚠️"
                        >
                          📍
                        </span>
                      )}

                      {/* شارة عكسي إن وُجد */}
                      {isReverse && (
                        <span className="h-[34px] px-2.5 rounded-full bg-rose-700 text-white text-xs font-black flex items-center justify-center border border-rose-500 shadow-xs" title="طلب راجع / عكسي">
                          عكسي
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrderTrackingBulkTable({
  rows,
  couriers,
}: {
  rows: TrackingTableRow[];
  couriers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [quickStatus, setQuickStatus] = useState<string>("all");
  const [quickCourier, setQuickCourier] = useState<string>("any");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [cardColumns, setCardColumns] = useState<1 | 2 | 3>(2);
  const [showCardsMenu, setShowCardsMenu] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tracking_card_columns");
      if (saved === "1" || saved === "2" || saved === "3") {
        setCardColumns(Number(saved) as 1 | 2 | 3);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setShowCardsMenu(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const selectedCount = selected.size;
  const allSelected = selectedCount > 0 && visibleIds.every((id) => selected.has(id));
  const showSelectColumn = showQuickSelect;

  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkUpdateOrdersStatus,
    {} as BulkOrdersState,
  );

  const [adminPickupOrder, setAdminPickupOrder] = useState<TrackingTableRow | null>(null);
  const [adminDeliveryOrder, setAdminDeliveryOrder] = useState<TrackingTableRow | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleMoneySuccess = (msg: string) => {
    setAdminPickupOrder(null);
    setAdminDeliveryOrder(null);
    setToastMsg({ text: msg, type: "success" });
    router.refresh();
    setTimeout(() => setToastMsg(null), 4000);
  };

  const [targetStatus, setTargetStatus] = useState<string>("assigned");
  const [courierId, setCourierId] = useState<string>("");
  const [assignOrder, setAssignOrder] = useState<TrackingTableRow | null>(null);
  const [rejectOrder, setRejectOrder] = useState<TrackingTableRow | null>(null);
  const [restoreOrder, setRestoreOrder] = useState<TrackingTableRow | null>(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const needsCourier =
    targetStatus === "assigned" ||
    targetStatus === "delivering" ||
    targetStatus === "delivered";

  const selectedIdsArr = useMemo(() => Array.from(selected), [selected]);

  const unifiedRows: MandoubRow[] = useMemo(
    () =>
      rows.map((r) => {
        const ui = STATUS_UI[r.orderStatus] ?? {
          ar: r.orderStatus,
          dot: "bg-slate-500 ring-2 ring-slate-200/80",
        };
        return {
          id: r.id,
          shortId: String(r.orderNumber),
          orderStatus: r.orderStatus,
          assignedCourierName: r.courierName?.trim() || "",
          shopName: r.shopCustomerLabel,
          shopNameHighlightClass: mandoubShopNameVividClass(r.orderStatus, false),
          regionLine: r.regionName,
          orderType: r.routeModeLabel
            ? `${r.orderType} • ${r.routeModeLabel}`
            : r.orderType,
          priceStr: r.hasDebt && r.priceWithDebtLabel ? r.priceWithDebtLabel : r.totalLabel,
          hasDebt: r.hasDebt,
          calculatedDebt: r.calculatedDebt,
          delStr: r.deliveryLabel,
          customerPhone: r.customerPhone,
          timeLine: r.orderNoteTime || "—",
          statusAr: ui.ar,
          statusClass: ui.dot,
          hasCustomerLocation: !r.missingCustomerLocation,
          hasCourierUploadedLocation: r.hasCourierUploadedLocation,
          hasMoneyDeletedBadge: false,
          prepaidAll: false,
          reversePickup: isReversePickupOrderType(r.orderType),
          wardMismatchType: r.wardMismatchType,
          saderMismatchType: r.saderMismatchType,
          noWardRecorded: r.noWardRecorded,
          noSaderRecorded: r.noSaderRecorded,
          createdAt: r.createdAt,
          pickupSumDinar: r.pickupSumDinar ?? 0,
          preparerPickupSumDinar: r.preparerPickupSumDinar ?? null,
          adminPickupSumDinar: r.adminPickupSumDinar ?? null,
          deliverySumDinar: r.deliverySumDinar ?? 0,
          // بيانات الوصول السريع
          audioUrl: r.audioUrl,
          adminAudioUrl: r.adminAudioUrl,
          shopPhone: r.shopPhone,
          shopLocationUrl: r.shopLocationUrl,
          customerLocationUrl: r.customerLocationUrl,
          secondCustomerLocationUrl: r.secondCustomerLocationUrl,
          shopDoorPhotoUrl: r.shopDoorPhotoUrl,
          customerDoorPhotoUrl: r.customerDoorPhotoUrl,
          secondCustomerDoorPhotoUrl: r.secondCustomerDoorPhotoUrl,
          routeMode: r.routeModeLabel === "وجهتين" ? "double" : "single",
          secondCustomerRegionName: r.secondCustomerRegionName,
        };
      }),
    [rows],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function selectMatchingQuickFilters() {
    const next = new Set<string>();
    for (const r of rows) {
      if (quickStatus !== "all" && r.orderStatus !== quickStatus) continue;
      if (quickCourier !== "any") {
        if (r.assignedCourierId !== quickCourier) continue;
      }
      next.add(r.id);
    }
    setSelected(next);
  }

  function selectAllVisible() {
    setSelected(new Set(visibleIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  useEffect(() => {
    if (bulkState.ok) setSelected(new Set());
  }, [bulkState.ok]);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {visibleIds.length > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setShowQuickSelect((v) => {
                  if (v) setSelected(new Set());
                  return !v;
                })
              }
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-black transition active:scale-95 shadow-xs ${
                showQuickSelect
                  ? "bg-[#0A3D2E] border-[#C9A86A] text-[#F5D77F]"
                  : "border-[#C9A86A]/70 bg-white text-[#0A3D2E] hover:border-[#C9A86A] hover:bg-[#FFF8F0]"
              }`}
            >
              <span>⚡ تحديد سريع</span>
              <span className={showQuickSelect ? "text-[#F5D77F]" : "text-[#C9A86A]"}>
                {showQuickSelect ? "▲" : "▼"}
              </span>
            </button>
          </div>
        ) : <div />}

        {/* أزرار التبديل بين عرض الكروت وعرض الجدول مع قائمة منسدلة لاختيار 1 2 3 */}
        <div className="flex items-center gap-1.5 rounded-full bg-white p-1 border border-[#C9A86A]/70 shadow-xs">
          {/* زر البطاقات مع القائمة المنسدلة */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                if (viewMode !== "cards") {
                  setViewMode("cards");
                  setShowCardsMenu(true);
                } else {
                  setShowCardsMenu((v) => !v);
                }
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black transition active:scale-95 ${
                viewMode === "cards"
                  ? "bg-[#0A3D2E] text-[#F5D77F] shadow-xs border border-[#C9A86A]"
                  : "text-[#0A3D2E] hover:bg-[#FFF8F0]"
              }`}
              title="عرض البطاقات (انقر لاختيار 1 أو 2 أو 3 طلبات بالسطر)"
            >
              <span>📱</span>
              <span>البطاقات</span>
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-gradient-to-b from-[#F5D77F] to-[#C9A86A] text-[#0A3D2E] text-[10px] font-black">
                {cardColumns}
              </span>
              <span className="text-[9px] text-[#C9A86A]">
                {showCardsMenu ? "▲" : "▼"}
              </span>
            </button>

            {/* القائمة المنسدلة لاختيار عدد الأعمدة 1 2 3 */}
            {showCardsMenu && (
              <div className="absolute top-full right-0 mt-2 z-30 w-40 rounded-2xl bg-white p-2 shadow-2xl border-2 border-[#C9A86A] animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-black text-[#0A3D2E] border-b border-[#C9A86A]/30 mb-1">
                  الطلبات بالسطر:
                </div>
                <div className="space-y-1">
                  {([1, 2, 3] as const).map((num) => {
                    const isSelectedNum = cardColumns === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setCardColumns(num);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("tracking_card_columns", String(num));
                          }
                          setShowCardsMenu(false);
                        }}
                        className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-xs font-black transition active:scale-95 ${
                          isSelectedNum
                            ? "bg-[#0A3D2E] text-[#F5D77F] shadow-xs"
                            : "text-[#0A3D2E] hover:bg-[#FFF8F0]"
                        }`}
                      >
                        <span>
                          {num === 1 ? "1 (طلب واحد)" : num === 2 ? "2 (طلبين)" : "3 (ثلاث طلبات)"}
                        </span>
                        {isSelectedNum && <span className="text-xs text-[#F5D77F]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* زر الجدول */}
          <button
            type="button"
            onClick={() => {
              setViewMode("table");
              setShowCardsMenu(false);
            }}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black transition active:scale-95 ${
              viewMode === "table"
                ? "bg-[#0A3D2E] text-[#F5D77F] shadow-xs border border-[#C9A86A]"
                : "text-[#0A3D2E] hover:bg-[#FFF8F0]"
            }`}
          >
            <span>📋</span>
            <span>الجدول</span>
          </button>
        </div>
      </div>

      {showQuickSelect && visibleIds.length > 0 && (
        <div className="rounded-2xl border-2 border-[#C9A86A]/40 bg-gradient-to-b from-[#FFFDF9] to-[#FFF8F0] p-2.5 sm:p-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs text-[#C9A86A]">⚜️</span>
            <p className="text-[11px] sm:text-xs font-black text-[#0A3D2E]">
              اختر حالة و/أو مندوباً ثم اضغط «تحديد المطابقين»:
            </p>
          </div>
          
          <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
            <label className="flex flex-col gap-0.5 text-[10.5px] font-black text-[#0A3D2E]/80">
              الحالة الحالية
              <select
                value={quickStatus}
                onChange={(e) => setQuickStatus(e.target.value)}
                className="h-8 sm:h-8.5 rounded-xl border border-[#C9A86A]/60 bg-white px-2 py-1 text-xs font-black text-[#0A3D2E] outline-none shadow-2xs focus:border-[#C9A86A] focus:ring-1 focus:ring-[#C9A86A]"
              >
                {QUICK_STATUS_VALUES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-0.5 text-[10.5px] font-black text-[#0A3D2E]/80">
              المندوب المسند
              <select
                value={quickCourier}
                onChange={(e) => setQuickCourier(e.target.value)}
                className="h-8 sm:h-8.5 min-w-[7.5rem] sm:min-w-[8.5rem] rounded-xl border border-[#C9A86A]/60 bg-white px-2 py-1 text-xs font-black text-[#0A3D2E] outline-none shadow-2xs focus:border-[#C9A86A] focus:ring-1 focus:ring-[#C9A86A]"
              >
                <option value="any">أي مندوب</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {/* أزرار الإجراء السريع بتصميم ملكي مصغر ومدمج */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={selectMatchingQuickFilters}
                className="h-8 sm:h-8.5 rounded-xl bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] px-3 py-1 text-xs font-black text-[#F5D77F] border border-[#C9A86A] shadow-xs hover:brightness-110 active:scale-95 transition"
                title="تحديد الطلبات المطابقة للفلاتر"
              >
                ✨ تحديد المطابقين
              </button>

              <button
                type="button"
                onClick={selectAllVisible}
                className="h-8 sm:h-8.5 rounded-xl border border-[#C9A86A]/70 bg-white px-2.5 py-1 text-xs font-black text-[#0A3D2E] hover:bg-[#FFF8F0] shadow-2xs active:scale-95 transition"
                title="تحديد كل الطلبات الظاهرة"
              >
                تحديد الكل
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="h-8 sm:h-8.5 rounded-xl border border-rose-200 bg-white px-2 py-1 text-xs font-black text-rose-700 hover:bg-rose-50 shadow-2xs active:scale-95 transition"
                title="إفراغ التحديد الحالي"
              >
                إفراغ
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCount ? (
        <div className="fixed bottom-5 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 w-auto max-w-[calc(100vw-2rem)] md:max-w-5xl rounded-3xl border-2 border-[#C9A86A] bg-gradient-to-b from-white/95 to-[#FFF8F0]/95 backdrop-blur-md px-4 py-3 shadow-[0_15px_40px_rgba(10,61,46,0.18)] animate-in fade-in slide-in-from-bottom-8 duration-300" dir="rtl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center justify-between lg:justify-start gap-3 border-b lg:border-b-0 pb-2 lg:pb-0 border-[#C9A86A]/20">
              <div>
                <p className="text-xs sm:text-sm font-black text-[#0A3D2E]">
                  تم اختيار <span className="text-base sm:text-lg font-black text-[#C9A86A]">{selectedCount}</span> طلبية
                </p>
                {bulkState.error ? (
                  <p className="mt-0.5 text-xs font-bold text-rose-600">
                    {bulkState.error}
                  </p>
                ) : null}
                {bulkPending ? (
                  <p className="mt-0.5 text-[11px] font-bold text-[#0A3D2E] animate-pulse">جارٍ حفظ التعديلات… ⏳</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="lg:hidden flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs font-bold"
                title="إلغاء التحديد"
              >
                ✕
              </button>
            </div>

            <form action={bulkAction} className="flex flex-wrap items-end justify-center lg:justify-end gap-2">
              {selectedIdsArr.map((id) => (
                <input key={id} type="hidden" name="orderIds" value={id} />
              ))}

              <label className="flex flex-col gap-0.5 text-[10.5px] font-black text-[#0A3D2E]/80">
                الحالة الجديدة
                <select
                  name="targetStatus"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="h-8.5 rounded-xl border border-[#C9A86A]/60 bg-white px-2 py-1 text-xs font-black text-[#0A3D2E] outline-none shadow-2xs focus:border-[#C9A86A]"
                >
                  <option value="pending">قيد الانتظار (جديد)</option>
                  <option value="assigned">مسند للمندوب</option>
                  <option value="delivering">عند المندوب (بالتوصيل)</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">مرفوض</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </label>

              {needsCourier ? (
                <label className="flex flex-col gap-0.5 text-[10.5px] font-black text-[#0A3D2E]/80">
                  المندوب المسند
                  <select
                    name="courierId"
                    value={courierId}
                    onChange={(e) => setCourierId(e.target.value)}
                    className="h-8.5 min-w-[8rem] rounded-xl border border-[#C9A86A]/60 bg-white px-2 py-1 text-xs font-black text-[#0A3D2E] outline-none shadow-2xs focus:border-[#C9A86A]"
                  >
                    <option value="">اختر مندوب للطلب…</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="courierId" value="" />
              )}

              {needsCourier && (
                <div className="flex h-8.5 items-center gap-1.5 bg-[#FFF8F0] px-2.5 rounded-xl border border-[#C9A86A]/50">
                  <input type="checkbox" id="bulk-direct-tracking" name="directReceipt" className="h-4 w-4 rounded border-[#C9A86A] text-[#0A3D2E] focus:ring-[#C9A86A]" />
                  <label htmlFor="bulk-direct-tracking" className="text-[10px] font-black text-[#0A3D2E] cursor-pointer select-none">استلام مباشر ⚡</label>
                </div>
              )}

              <button
                type="submit"
                disabled={bulkPending || (needsCourier && !courierId)}
                className="h-8.5 rounded-xl bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#0F4D3A] px-4 text-xs font-black text-[#F5D77F] border border-[#C9A86A] shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition"
              >
                تطبيق الإجراء
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="hidden lg:flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition text-xs font-bold"
                title="إلغاء التحديد وإفراغ القائمة"
              >
                ✕
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* المحتوى الرئيسي: عرض البطاقات (مثل المندوبين) أو عرض الجدول */}
      {viewMode === "cards" ? (
        <TrackingCardsView
          rows={rows}
          onOpenRow={(id) => router.push(`${SECRET_ADMIN_PATH}/orders/${id}`)}
          onAssignOrder={(r) => setAssignOrder(r)}
          onRejectOrder={(r) => setRejectOrder(r)}
          onRestoreOrder={(r) => setRestoreOrder(r)}
          onAdminPickup={(r) => setAdminPickupOrder(r)}
          onAdminDelivery={(r) => setAdminDeliveryOrder(r)}
          icons={icons}
          showSelectColumn={showSelectColumn}
          isSelected={(id) => selected.has(id)}
          onToggleOne={toggleOne}
          columns={cardColumns}
        />
      ) : (
        <UnifiedOrderListTable
          rows={unifiedRows}
          colCount={9}
          showSelectColumn={showSelectColumn}
          isRowSelectable={() => true}
          isSelected={(id) => selected.has(id)}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          onToggleOne={toggleOne}
          onOpenRow={(id) => {
            router.push(`${SECRET_ADMIN_PATH}/orders/${id}`);
          }}
          selectAllTitle="تحديد الكل"
          selectAllAriaLabel="تحديد كل الطلبات الظاهرة"
          selectedTitle="تحديد"
          selectedAriaPrefix="تحديد الطلب"
          showStatusDotInSelectCol={false}
          renderOrderIdBadge={() => null}
          renderBelowOrderId={(row) => {
            if (row.orderStatus === "archived") return null;
            const originalRow = rows.find((r) => r.id === row.id);
            if (row.orderStatus === "cancelled") {
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (originalRow) setRestoreOrder(originalRow);
                  }}
                  className="flex h-11 px-3 items-center justify-center gap-1 rounded-2xl bg-sky-50 hover:bg-sky-100 border-2 border-sky-300 text-sky-800 shadow-sm transition active:scale-90 text-xs font-black"
                  title="إرجاع الطلب إلى جديد 🔄"
                >
                  <span>🔄</span>
                  <span>إرجاع</span>
                </button>
              );
            }
            const isAssigned = row.orderStatus !== "pending" || Boolean(row.assignedCourierName && row.assignedCourierName !== "—");
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (originalRow) setAssignOrder(originalRow);
                }}
                className={`flex h-11 px-3 items-center justify-center gap-1 rounded-2xl bg-white border-2 shadow-sm transition hover:bg-emerald-50 active:scale-90 text-xs font-black ${
                  isAssigned ? "border-violet-300 text-violet-700 hover:border-violet-500" : "border-emerald-200 text-emerald-700 hover:border-emerald-400"
                }`}
                title={isAssigned ? "تغيير المندوب" : "إسناد لمندوب"}
              >
                <span>🛵</span>
                <span>{isAssigned ? (row.assignedCourierName || "تغيير") : "إسناد"}</span>
              </button>
            );
          }}
        />
      )}

      {/* التوست التنبيهي لعمليات الإدارة */}
      {toastMsg && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border-2 text-white font-black text-sm sm:text-base animate-in slide-in-from-top duration-300 ${
            toastMsg.type === "success"
              ? "bg-emerald-900 border-emerald-400"
              : "bg-rose-900 border-rose-400"
          }`}
        >
          <span>{toastMsg.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="mr-2 text-white/80 hover:text-white font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* نافذة استلام الطلب وصادر الإدارة */}
      {adminPickupOrder && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setAdminPickupOrder(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl ring-2 ring-emerald-500/30 dark:ring-emerald-500/20 max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-950 pb-3 mb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-emerald-950 dark:text-emerald-300 flex items-center gap-2">
                  <span>⚡</span>
                  <span>استلام الطلب وتسجيل الصادر (إدارة / بالنيابة)</span>
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  الطلب #{adminPickupOrder.orderNumber} {adminPickupOrder.courierName ? `— المندوب: ${adminPickupOrder.courierName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminPickupOrder(null)}
                className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <AdminPickupFormModal
              orderId={adminPickupOrder.id}
              orderNumber={adminPickupOrder.orderNumber}
              courierName={adminPickupOrder.courierName}
              nextPath="/abo1stor3hlaa2kbr8-47/orders/tracking"
              expectedAlfHint={
                adminPickupOrder.orderSubtotalDinar != null
                  ? dinarDecimalToAlfInputString(adminPickupOrder.orderSubtotalDinar)
                  : ""
              }
              remainingAlfHint={
                adminPickupOrder.orderSubtotalDinar != null
                  ? dinarDecimalToAlfInputString(
                      Math.max(0, adminPickupOrder.orderSubtotalDinar - (adminPickupOrder.pickupSumDinar ?? 0)),
                    )
                  : ""
              }
              onSuccess={handleMoneySuccess}
              onClose={() => setAdminPickupOrder(null)}
            />
          </div>
        </div>
      )}

      {/* نافذة تسليم الطلب ووارد الإدارة */}
      {adminDeliveryOrder && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setAdminDeliveryOrder(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl ring-2 ring-rose-500/30 dark:ring-rose-500/20 max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-950 pb-3 mb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-rose-950 dark:text-rose-300 flex items-center gap-2">
                  <span>🫴</span>
                  <span>تسليم الطلب واحتساب الأرباح (إدارة / بالنيابة)</span>
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  الطلب #{adminDeliveryOrder.orderNumber} {adminDeliveryOrder.courierName ? `— المندوب: ${adminDeliveryOrder.courierName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminDeliveryOrder(null)}
                className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <AdminDeliveryFormModal
              orderId={adminDeliveryOrder.id}
              orderNumber={adminDeliveryOrder.orderNumber}
              courierName={adminDeliveryOrder.courierName}
              nextPath="/abo1stor3hlaa2kbr8-47/orders/tracking"
              expectedAlfHint={
                adminDeliveryOrder.totalAmountDinar != null
                  ? dinarDecimalToAlfInputString(adminDeliveryOrder.totalAmountDinar)
                  : ""
              }
              remainingAlfHint={
                adminDeliveryOrder.totalAmountDinar != null
                  ? dinarDecimalToAlfInputString(
                      Math.max(0, adminDeliveryOrder.totalAmountDinar - (adminDeliveryOrder.deliverySumDinar ?? 0)),
                    )
                  : ""
              }
              onSuccess={handleMoneySuccess}
              onClose={() => setAdminDeliveryOrder(null)}
              prepaidAll={
                adminDeliveryOrder.prepaidAll ||
                adminDeliveryOrder.totalLabel === "كل شي واصل" ||
                adminDeliveryOrder.totalLabel === "واصل"
              }
            />
          </div>
        </div>
      )}

      {/* نافذة الإسناد السريع للمندوبين */}
      {assignOrder && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="mt-8 w-full max-w-md animate-in slide-in-from-top-4 rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800" dir="rtl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">إسناد لمندوب</h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">الطلب #{assignOrder.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignOrder(null)}
                className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pt-1 space-y-3">
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50">
                <input type="checkbox" id="direct-receipt-tracking-modal" className="h-5 w-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-400" />
                <label htmlFor="direct-receipt-tracking-modal" className="text-sm font-black text-emerald-950 dark:text-emerald-300 cursor-pointer select-none">
                  استلام مباشر للمندوب (تخطي الموافقة) ⚡
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {couriers.map((c) => {
                  const isCurrent = assignOrder.assignedCourierId === c.id || (assignOrder.courierName && assignOrder.courierName === c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={bulkPending}
                      onClick={async () => {
                        const direct = (document.getElementById('direct-receipt-tracking-modal') as HTMLInputElement)?.checked;
                        const fd = new FormData();
                        fd.append("orderIds", assignOrder.id);
                        fd.append("targetStatus", direct ? "delivering" : "assigned");
                        fd.append("courierId", c.id);
                        if (direct) fd.append("directReceipt", "on");
                        setAssignOrder(null);
                        const res = await bulkUpdateOrdersStatus({}, fd);
                        if (res.error) alert(res.error);
                        else router.refresh();
                      }}
                      className={`w-full rounded-2xl border-2 px-3.5 py-3 text-right text-sm sm:text-base font-bold transition active:scale-[0.98] disabled:opacity-60 ${
                        isCurrent
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-400"
                          : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white hover:border-emerald-500 hover:bg-emerald-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black truncate">{c.name}</span>
                        {isCurrent && <span className="text-emerald-600 font-bold text-xs">✓</span>}
                      </div>
                      {isCurrent && (
                        <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">مسند حالياً</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد رفض الطلب السريع */}
      {rejectOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setRejectOrder(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 animate-in zoom-in-95 duration-200 text-center" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-2xl text-rose-600">
              ❌
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">هل تريد رفض الطلب #{rejectOrder.orderNumber}؟</h3>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {rejectOrder.shopCustomerLabel} إلى {rejectOrder.regionName}
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={bulkPending}
                onClick={async () => {
                  const fd = new FormData();
                  fd.append("orderIds", rejectOrder.id);
                  fd.append("targetStatus", "cancelled");
                  setRejectOrder(null);
                  const res = await bulkUpdateOrdersStatus({}, fd);
                  if (res.error) alert(res.error);
                  else router.refresh();
                }}
                className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-black text-white shadow-md transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
              >
                نعم، رفض الطلب ❌
              </button>
              <button
                type="button"
                onClick={() => setRejectOrder(null)}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-3 text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد إرجاع الطلب المرفوض إلى جديد */}
      {restoreOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setRestoreOrder(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 animate-in zoom-in-95 duration-200 text-center" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/60 text-2xl text-sky-600">
              🔄
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">هل تريد إرجاع الطلب #{restoreOrder.orderNumber} إلى جديد؟</h3>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {restoreOrder.shopCustomerLabel} إلى {restoreOrder.regionName}
            </p>

            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={bulkPending}
                onClick={async () => {
                  const fd = new FormData();
                  fd.append("orderIds", restoreOrder.id);
                  fd.append("targetStatus", "pending");
                  setRestoreOrder(null);
                  const res = await bulkUpdateOrdersStatus({}, fd);
                  if (res.error) {
                    alert(res.error);
                  } else {
                    setToastMsg({ text: `تم إرجاع الطلب #${restoreOrder.orderNumber} إلى قائمة الطلبات الجديدة بنجاح! 🔄`, type: "success" });
                    router.refresh();
                    setTimeout(() => setToastMsg(null), 4000);
                  }
                }}
                className="flex-1 rounded-2xl bg-sky-600 py-3 text-sm font-black text-white shadow-md transition hover:bg-sky-700 active:scale-95 disabled:opacity-50"
              >
                نعم، إرجاع إلى جديد 🔄
              </button>
              <button
                type="button"
                onClick={() => setRestoreOrder(null)}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-3 text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

