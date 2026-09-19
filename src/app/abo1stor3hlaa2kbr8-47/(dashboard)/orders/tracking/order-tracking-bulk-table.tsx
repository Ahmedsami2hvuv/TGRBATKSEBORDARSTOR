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
import { LuxuryAssignCourierModal } from "@/components/luxury-assign-courier-modal";
import { formatBaghdadDateFriendly, getBaghdadDateString } from "@/lib/baghdad-time";
import { formatDinarAsAlf, dinarDecimalToAlfInputString, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { LuxuryReverseOrderButton } from "@/components/luxury-reverse-order-button";
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

function hasValidPreparerShoppingList(raw: unknown): boolean {
  if (raw == null) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.products)) return obj.products.length > 0;
    if (Array.isArray(obj.items)) return obj.items.length > 0;
    return Object.keys(obj).length > 0;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "{}" || t === "[]" || t === "null" || t.length <= 2) return false;
    try {
      const v = JSON.parse(t) as unknown;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object" && v !== null) {
        const obj = v as Record<string, unknown>;
        if (Array.isArray(obj.products)) return obj.products.length > 0;
        if (Array.isArray(obj.items)) return obj.items.length > 0;
        return Object.keys(obj).length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }
  return false;
}

const QUICK_STATUS_VALUES = [
  { value: "all", label: "أي حالة" },
  { value: "pending", label: "جديد" },
  { value: "assigned", label: "بانتظار المندوب" },
  { value: "delivering", label: "عند المندوب" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "مرفوض" },
  { value: "archived", label: "مؤرشف" },
] as const;

/* مكونات المربعات التفاعلية الفاخرة المطابقة لـ Mnt-Data-Photo3607594841302210502-Jpeg.html */
function AmountSquareBtn({
  value,
  selected,
  onClick,
  color = "emerald",
}: {
  value: string;
  selected: boolean;
  onClick: () => void;
  color?: "emerald" | "orange";
}) {
  const isEmerald = color === "emerald";
  const activeBg = isEmerald ? "#0A3D2A" : "#8B2E1A";
  const inactiveBg = "#E8E0D0";
  const textColor = selected ? "#C9A86A" : isEmerald ? "#0A3D2A" : "#8B2E1A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[120px] h-[120px] min-w-[120px] min-h-[120px]
        rounded-[18px] border-[2.5px] flex items-center justify-center
        text-[48px] font-black leading-none tracking-tight
        transition-all duration-200 active:scale-[0.97]
        select-none cursor-pointer
        ${selected ? "shadow-[0_0_0_3px_#C9A86A44,0_8px_20px_rgba(0,0,0,0.15)] scale-[1.02]" : "shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]"}
      `}
      style={{
        backgroundColor: selected ? activeBg : inactiveBg,
        borderColor: "#C9A86A",
        color: textColor,
      }}
    >
      <span style={{ fontSize: "48px", fontWeight: "900", lineHeight: "1" }}>
        {value}
      </span>
    </button>
  );
}

function ZeroSquareBtn({
  label,
  activeLabel = "0",
  selected,
  onClick,
  color = "emerald",
}: {
  label: string;
  activeLabel?: string;
  selected: boolean;
  onClick: () => void;
  color?: "emerald" | "orange";
}) {
  const isEmerald = color === "emerald";
  const activeBg = isEmerald ? "#0A3D2A" : "#8B2E1A";
  const textColor = selected ? "#C9A86A" : "#0A3D2A";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-[120px] h-[120px] min-w-[120px] min-h-[120px]
        rounded-[18px] border-[2.5px] flex flex-col items-center justify-center
        transition-all duration-200 active:scale-[0.97]
        select-none cursor-pointer
        ${selected ? "shadow-[0_0_0_3px_#C9A86A44,0_8px_20px_rgba(0,0,0,0.12)] scale-[1.02]" : "shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"}
      `}
      style={{
        backgroundColor: selected ? activeBg : "#E8E0D0",
        borderColor: "#C9A86A",
        color: textColor,
      }}
    >
      <span
        className={`font-black leading-none ${selected ? "text-[48px]" : "text-[22px]"}`}
        style={{ fontSize: selected ? "48px" : "22px", fontWeight: "900", lineHeight: "1" }}
      >
        {selected ? activeLabel : label}
      </span>
      {selected && (
        <span className="text-[11px] font-bold mt-1 tracking-wide opacity-70" style={{ color: "#C9A86A" }}>
          {label}
        </span>
      )}
    </button>
  );
}

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
  const targetAlf = remainingAlfHint || expectedAlfHint || "";
  const [amountAlf, setAmountAlf] = useState("");
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const isMismatch =
    amountAlf.trim() !== "" &&
    amountAlf.trim() !== targetAlf &&
    amountAlf.trim() !== "0" &&
    selectedBox !== "zero";

  async function handleFormSubmit(fd: FormData) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const amtVal = String(fd.get("amountAlf") ?? "").trim();
      if (!amtVal && selectedBox !== "zero") {
        fd.set("amountAlf", targetAlf || "0");
      }
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
    <form ref={formRef} action={handleFormSubmit} className="space-y-4" dir="rtl">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="advanceStatus" value="delivering" />

      {error && (
        <div className="rounded-xl border border-rose-400 bg-rose-50 p-2.5 text-xs font-bold text-rose-900 text-center">
          {error}
        </div>
      )}

      <div className="text-right">
        <span className="text-[14px] font-bold text-[#0A3D2A]">المبلغ (ألف دينار):</span>
      </div>

      {/* مربعات الاختيار السريع 120x120 */}
      <div className="flex gap-4 justify-center" dir="ltr">
        <AmountSquareBtn
          value={targetAlf || "0"}
          selected={selectedBox === "num" || (amountAlf === targetAlf && targetAlf !== "" && targetAlf !== "0")}
          onClick={() => {
            setAmountAlf(targetAlf);
            setSelectedBox("num");
            const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
            if (amtInput) amtInput.value = targetAlf;
            setTimeout(() => {
              formRef.current?.requestSubmit();
            }, 30);
          }}
          color="emerald"
        />
        <ZeroSquareBtn
          label="لم أدفع"
          activeLabel="0"
          selected={selectedBox === "zero" || amountAlf === "0"}
          onClick={() => {
            setAmountAlf("0");
            setSelectedBox("zero");
            const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
            if (amtInput) amtInput.value = "0";
            setTimeout(() => {
              formRef.current?.requestSubmit();
            }, 30);
          }}
          color="emerald"
        />
      </div>

      {/* حقل إدخال المبلغ */}
      <div>
        <input
          name="amountAlf"
          inputMode="numeric"
          value={amountAlf}
          onChange={(e) => {
            const v = e.target.value;
            setAmountAlf(v);
            if (v === targetAlf && targetAlf !== "" && targetAlf !== "0") setSelectedBox("num");
            else if (v === "0") setSelectedBox("zero");
            else setSelectedBox(null);
          }}
          placeholder={targetAlf || "0"}
          className="w-full h-[56px] rounded-[16px] border-[1.5px] border-[#C9A86A] bg-white text-center text-[26px] font-black text-[#0A3D2A] placeholder:text-[#0A3D2A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/40"
        />
      </div>

      {/* حقل سبب اختلاف المبلغ: يظهر فقط إذا كتب المستخدم سعراً مختلفاً عن المتوقع */}
      {isMismatch ? (
        <div className="space-y-1.5 animate-in fade-in duration-200">
          <div className="text-right">
            <span className="text-[13px] font-bold text-[#0A3D2A]">
              سبب اختلاف الصادر <span className="text-rose-600">*</span>
            </span>
          </div>
          <textarea
            name="mismatchNote"
            required
            rows={2}
            className="w-full min-h-[78px] rounded-[16px] border-[1.5px] border-[#C9A86A]/70 bg-white px-4 py-3 text-[13px] text-right placeholder:text-[#0A3D2A]/40 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/30 resize-none font-medium"
            placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
          />
        </div>
      ) : (
        <input type="hidden" name="mismatchNote" value="" />
      )}

      <div className="h-[1px] bg-[#C9A86A]/20 my-4" />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-[48px] rounded-[16px] font-black text-[15px] text-[#0A3D2A] border border-[#C9A86A] shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:brightness-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          style={{ background: "linear-gradient(180deg, #E8D5A3 0%, #C9A86A 100%)" }}
        >
          <span>💾</span>
          <span>{pending ? "جاري الحفظ..." : "تأكيد الصادر"}</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-[88px] h-[48px] rounded-[16px] bg-[#F0EAD8] border border-[#C9A86A]/30 font-bold text-[14px] text-[#0A3D2A] hover:bg-[#E8E0D0] transition active:scale-[0.98] cursor-pointer"
        >
          إلغاء
        </button>
      </div>
    </form>
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
  const targetAlf = prepaidAll ? "0" : (remainingAlfHint || expectedAlfHint || "");
  const [amountAlf, setAmountAlf] = useState("");
  const [selectedBox, setSelectedBox] = useState<"num" | "zero" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  const isMismatch =
    amountAlf.trim() !== "" &&
    amountAlf.trim() !== targetAlf &&
    amountAlf.trim() !== "0" &&
    selectedBox !== "zero";

  async function handleFormSubmit(fd: FormData) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const amtVal = String(fd.get("amountAlf") ?? "").trim();
      if (!amtVal && selectedBox !== "zero") {
        fd.set("amountAlf", targetAlf || "0");
      }
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
    <form ref={formRef} action={handleFormSubmit} className="space-y-4" dir="rtl">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="advanceStatus" value="delivered" />

      {error && (
        <div className="rounded-xl border border-rose-400 bg-rose-50 p-2.5 text-xs font-bold text-rose-900 text-center">
          {error}
        </div>
      )}

      <div className="text-right">
        <span className="text-[14px] font-bold text-[#0A3D2A]">المبلغ (ألف دينار):</span>
      </div>

      {/* مربعات الاختيار السريع 120x120 */}
      <div className="flex gap-4 justify-center" dir="ltr">
        <AmountSquareBtn
          value={targetAlf || "0"}
          selected={selectedBox === "num" || (amountAlf === targetAlf && targetAlf !== "" && targetAlf !== "0")}
          onClick={() => {
            setAmountAlf(targetAlf);
            setSelectedBox("num");
            const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
            if (amtInput) amtInput.value = targetAlf;
            setTimeout(() => {
              formRef.current?.requestSubmit();
            }, 30);
          }}
          color="orange"
        />
        <ZeroSquareBtn
          label="لم استلم"
          activeLabel="0"
          selected={selectedBox === "zero" || amountAlf === "0"}
          onClick={() => {
            setAmountAlf("0");
            setSelectedBox("zero");
            const amtInput = formRef.current?.querySelector('input[name="amountAlf"]') as HTMLInputElement;
            if (amtInput) amtInput.value = "0";
            setTimeout(() => {
              formRef.current?.requestSubmit();
            }, 30);
          }}
          color="orange"
        />
      </div>

      {/* حقل إدخال المبلغ */}
      <div>
        <input
          name="amountAlf"
          inputMode="numeric"
          value={amountAlf}
          onChange={(e) => {
            const v = e.target.value;
            setAmountAlf(v);
            if (v === targetAlf && targetAlf !== "" && targetAlf !== "0") setSelectedBox("num");
            else if (v === "0") setSelectedBox("zero");
            else setSelectedBox(null);
          }}
          placeholder={targetAlf || "0"}
          className="w-full h-[56px] rounded-[16px] border-[1.5px] border-[#C9A86A] bg-white text-center text-[26px] font-black text-[#8B2E1A] placeholder:text-[#8B2E1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/40"
        />
      </div>

      {/* حقل سبب اختلاف المبلغ: يظهر فقط إذا كتب المستخدم سعراً مختلفاً عن المتوقع */}
      {isMismatch ? (
        <div className="space-y-1.5 animate-in fade-in duration-200">
          <div className="text-right">
            <span className="text-[13px] font-bold text-[#0A3D2A]">
              سبب اختلاف الوارد <span className="text-rose-600">*</span>
            </span>
          </div>
          <textarea
            name="mismatchNote"
            required
            rows={2}
            className="w-full min-h-[78px] rounded-[16px] border-[1.5px] border-[#C9A86A]/70 bg-white px-4 py-3 text-[13px] text-right placeholder:text-[#0A3D2A]/40 focus:outline-none focus:ring-2 focus:ring-[#C9A86A]/30 resize-none font-medium"
            placeholder="اكتب سبب اختلاف المبلغ عن المطلوب..."
          />
        </div>
      ) : (
        <input type="hidden" name="mismatchNote" value="" />
      )}

      <div className="h-[1px] bg-[#C9A86A]/20 my-4" />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-[48px] rounded-[16px] font-black text-[15px] text-white border border-[#C9A86A] shadow-[0_4px_12px_rgba(0,0,0,0.12)] hover:brightness-[1.05] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          style={{ background: "linear-gradient(180deg, #F4A27A 0%, #D96A3A 100%)" }}
        >
          <span>💾</span>
          <span>{pending ? "جاري الحفظ..." : "تأكيد الوارد"}</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-[88px] h-[48px] rounded-[16px] bg-[#F0EAD8] border border-[#C9A86A]/30 font-bold text-[14px] text-[#0A3D2A] hover:bg-[#E8E0D0] transition active:scale-[0.98] cursor-pointer"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}

function OrderSaderSideBadge({ o }: { o: TrackingTableRow }) {
  const pickup = o.pickupSumDinar ?? null;
  const preparerPickup = o.preparerPickupSumDinar ?? null;
  const adminPickup = o.adminPickupSumDinar ?? null;

  const showPickup = pickup != null && Number.isFinite(pickup) && pickup > 0;
  const showPreparerPickup = preparerPickup != null && Number.isFinite(preparerPickup) && preparerPickup > 0;
  const showAdminPickup = adminPickup != null && Number.isFinite(adminPickup) && adminPickup > 0;

  let text = "";
  let tooltip = "";
  let isPreparer = false;

  if (showPickup) {
    text = formatDinarAsAlf(pickup);
    tooltip = `صادر المندوب: ${text}`;
  } else if (showPreparerPickup) {
    text = formatDinarAsAlf(preparerPickup);
    tooltip = `صادر المجهز: ${text}`;
    isPreparer = true;
  } else if (showAdminPickup) {
    text = formatDinarAsAlf(adminPickup);
    tooltip = `صادر الإدارة: ${text}`;
  } else if (o.saderMismatchType === "deficit") {
    text = "نقص";
    tooltip = "نقص بالصادر";
  } else if (o.saderMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالصادر";
  }

  if (!text) return null;

  return (
    <div
      className="w-13 h-8 sm:w-14.5 sm:h-9 bg-contain bg-no-repeat bg-center flex items-center justify-center select-none shrink-0"
      style={{
        backgroundImage: `url('${isPreparer ? "/images/order-luxury/badge-preparer-sader.webp" : "/images/order-luxury/badge-sader.webp"}')`,
      }}
      title={tooltip}
    >
      <span className="text-[10px] sm:text-[11.5px] font-black font-mono leading-none tracking-tighter text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pt-0.5 px-0.5 truncate max-w-full text-center">
        {text}
      </span>
    </div>
  );
}

function OrderWardSideBadge({ o }: { o: TrackingTableRow }) {
  const delivery = o.deliverySumDinar ?? null;
  const preparerDelivery = o.preparerDeliverySumDinar ?? null;

  const showDelivery = delivery != null && Number.isFinite(delivery) && delivery > 0;
  const showPreparerDelivery = preparerDelivery != null && Number.isFinite(preparerDelivery) && preparerDelivery > 0;

  let text = "";
  let tooltip = "";
  let isPreparer = false;

  if (showDelivery) {
    text = formatDinarAsAlf(delivery);
    tooltip = `وارد المندوب: ${text}`;
  } else if (showPreparerDelivery) {
    text = formatDinarAsAlf(preparerDelivery);
    tooltip = `وارد المجهز: ${text}`;
    isPreparer = true;
  } else if (o.wardMismatchType === "deficit") {
    text = "نقص";
    tooltip = "نقص بالوارد";
  } else if (o.wardMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالوارد";
  } else if (o.noWardRecorded && o.orderStatus === "delivered") {
    text = "بدون";
    tooltip = "بدون وارد مسجل";
  }

  if (!text) return null;

  return (
    <div
      className="w-13 h-8 sm:w-14.5 sm:h-9 bg-contain bg-no-repeat bg-center flex items-center justify-center select-none shrink-0"
      style={{
        backgroundImage: `url('${isPreparer ? "/images/order-luxury/badge-preparer-ward.webp" : "/images/order-luxury/badge-ward.webp"}')`,
      }}
      title={tooltip}
    >
      <span className="text-[10px] sm:text-[11.5px] font-black font-mono leading-none tracking-tighter text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pt-0.5 px-0.5 truncate max-w-full text-center">
        {text}
      </span>
    </div>
  );
}

function RoyalScallopedCardBorder() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-visible">
      <svg
        className="w-full h-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        fill="none"
      >
        {/* المسار الخارجي ذو الزوايا المقعرة الملكية المنحوتة */}
        <path
          d="M 28 6 
             L 372 6 
             C 378 6, 384 10, 386 16 
             C 388 22, 388 24, 394 28 
             L 394 172 
             C 388 176, 388 178, 386 184 
             C 384 190, 378 194, 372 194 
             L 28 194 
             C 22 194, 16 190, 14 184 
             C 12 178, 12 176, 6 172 
             L 6 28 
             C 12 24, 12 22, 14 16 
             C 16 10, 22 6, 28 6 Z"
          stroke="#C9A86A"
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />
        {/* المسار الداخلي المزدوج المتوازي */}
        <path
          d="M 32 12 
             L 368 12 
             C 373 12, 378 15, 380 20 
             C 382 24, 382 26, 388 29 
             L 388 171 
             C 382 174, 382 176, 380 180 
             C 378 185, 373 188, 368 188 
             L 32 188 
             C 27 188, 22 185, 20 180 
             C 18 176, 18 174, 12 171 
             L 12 29 
             C 18 26, 18 24, 20 20 
             C 22 15, 27 12, 32 12 Z"
          stroke="#D4AF37"
          strokeWidth="1"
          strokeOpacity="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function GlassOrbButton3D({
  children,
  onClick,
  title,
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses =
    size === "sm"
      ? "w-7.5 h-7.5 text-xs"
      : size === "lg"
      ? "w-12 h-12 text-sm"
      : "w-10 h-10 sm:w-11 sm:h-11 text-xs";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative rounded-full shrink-0 flex items-center justify-center font-black select-none transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden ${sizeClasses} ${className}`}
      style={{
        background: "radial-gradient(circle at 40% 30%, #157347 0%, #0D4A36 50%, #042116 100%)",
        border: "2.5px solid #C9A86A",
        boxShadow: "0 4px 10px rgba(4,33,22,0.45), inset 0 2px 3px rgba(255,255,255,0.6), inset 0 -3px 5px rgba(0,0,0,0.6)",
      }}
    >
      {/* اللمعة الزجاجية العلوية المقوسة */}
      <div
        className="pointer-events-none absolute top-0.5 inset-x-1.5 h-[40%] rounded-t-full opacity-75"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.1) 80%, transparent 100%)",
        }}
      />
      <span className="relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}

function RedGlassOrbButton3D({
  onClick,
  title,
  href,
}: {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  href?: string | null;
}) {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={title || "فتح موقع الزبون 📍"}
        className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer"
        style={{
          backgroundImage: "url('/images/order-luxury/btn-open-location.webp?v=royalLocV2')",
        }}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      title={title || "بدون لوكيشن"}
      className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-no-repeat bg-contain select-none shrink-0 opacity-80 cursor-default"
      style={{
        backgroundImage: "url('/images/order-luxury/btn-no-location.webp?v=royalLocV2')",
      }}
    />
  );
}

function GoldOrbButton3D({
  children,
  onClick,
  title,
  href,
  variant = "gold",
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  href?: string;
  variant?: "gold" | "cancel" | "restore";
}) {
  const bgGrad =
    variant === "cancel"
      ? "radial-gradient(circle at 38% 28%, #F59E0B 0%, #D97706 55%, #78350F 100%)"
      : variant === "restore"
      ? "radial-gradient(circle at 38% 28%, #38BDF8 0%, #0284C7 55%, #0369A1 100%)"
      : "radial-gradient(circle at 38% 28%, #FFE599 0%, #E6BA65 45%, #9E7420 100%)";

  const textColor = variant === "gold" ? "text-[#3D2800]" : "text-white";

  const content = (
    <>
      <div
        className="pointer-events-none absolute top-0.5 inset-x-1 h-[40%] rounded-t-full opacity-75"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.1) 80%, transparent 100%)",
        }}
      />
      <span className={`relative z-10 text-[11px] sm:text-xs font-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center ${textColor}`}>
        {children}
      </span>
    </>
  );

  const styleObj = {
    background: bgGrad,
    border: "1.8px solid #C9A86A",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25), inset 0 1.5px 2px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(0,0,0,0.4)",
  };

  if (href) {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        title={title}
        className="relative w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full shrink-0 flex items-center justify-center select-none transition hover:scale-105 active:scale-95 cursor-pointer overflow-hidden"
        style={styleObj}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="relative w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full shrink-0 flex items-center justify-center select-none transition hover:scale-105 active:scale-95 cursor-pointer overflow-hidden"
      style={styleObj}
    >
      {content}
    </button>
  );
}

function getHeaderBannerWebp(orderStatus: string) {
  switch (orderStatus) {
    case "pending":
      // الأزرق الفاتح للطلب الجديد
      return "/images/order-luxury/header-new.webp";
    case "assigned":
      // الأحمر للمسند للمندوب
      return "/images/order-luxury/header-assigned.webp";
    case "delivering":
      // الأصفر للمستلم من قبل المندوب
      return "/images/order-luxury/header-received.webp";
    case "delivered":
      // الأخضر / الأزرق النيلي للمسلم
      return "/images/order-luxury/header-delivered.webp";
    default:
      return "/images/order-luxury/header-assigned.webp";
  }
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
      ? "grid grid-cols-1 gap-4 max-w-lg mx-auto"
      : columns === 2
      ? "grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto"
      : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl mx-auto";

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
      {groupedByDate.map((group) => {
        const dateDayNumber = group.items[0]?.createdAt
          ? new Date(group.items[0].createdAt).getDate()
          : 17;

        return (
          <div key={group.dateKey} className="space-y-3.5">
            {/* شريط الفاصل الزمني البارز بين الأيام بالزخرفة الدمشقية الأرابيسك */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] border-y border-[#C9A86A] px-4 py-2.5 text-[#FFF8F0] shadow-md flex items-center justify-between">
              {/* زخرفة دمشقية يمنى */}
              <div className="flex items-center gap-2 opacity-90">
                <span className="text-[#F5D77F] text-base">❧</span>
                <span className="text-[#C9A86A] text-sm">⚜️</span>
              </div>

              {/* تاريخ اليوم بالمنتصف */}
              <div className="text-center font-black text-sm sm:text-base tracking-wide text-white drop-shadow-sm">
                {group.dateLabel} <span className="text-[#F5D77F] font-semibold text-xs sm:text-sm">({group.items.length} طلب)</span>
              </div>

              {/* أيقونة التقويم المذهبة في اليسار */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-b from-[#E67E22] to-[#D35400] text-white flex flex-col items-center justify-center border border-[#FFF0D0] shadow-xs leading-none">
                  <span className="text-[8px] font-bold opacity-90">📅</span>
                  <span className="text-xs sm:text-sm font-black">{dateDayNumber}</span>
                </div>
                <span className="text-[#F5D77F] text-base">☙</span>
              </div>
            </div>

            {/* قائمة الكروت الملكية التابعة لهذا اليوم مع ملفات WEBP المكيشة */}
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

                const numericPrice = displayTotal
                  .replace(/ألف|دينار|الف/g, "")
                  .replace(/,/g, ".")
                  .replace(/[^\d.]/g, "")
                  .replace(/\.$/, "")
                  .trim() || displayTotal;

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

                const isPrepaid = Boolean(o.prepaidAll || o.totalLabel === "كل شي واصل" || o.totalLabel === "واصل");
                const isAllPaid = Boolean(
                  o.prepaidAll ||
                  o.totalLabel === "كل شي واصل" ||
                  o.totalLabel === "واصل" ||
                  o.totalLabel?.includes("واصل") ||
                  displayTotal === "كل شي واصل" ||
                  displayTotal === "واصل" ||
                  displayTotal?.includes("واصل")
                );
                const isReverse = Boolean(isReversePickupOrderType(o.orderType) || o.orderType?.includes("عكسي") || o.orderType?.includes("راجع"));
                const hasGps = Boolean(o.hasCourierUploadedLocation || o.customerLocationUrl || !o.missingCustomerLocation);
                const isDoubleRoute = Boolean(o.routeModeLabel === "وجهتين");
                const isFromPreparer = hasValidPreparerShoppingList(o.preparerShoppingJson);

                const headerWebpBg = getHeaderBannerWebp(o.orderStatus);

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
                    className={`group relative rounded-[20px] px-4 sm:px-6 pt-3.5 pb-3 transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between gap-1.5 sm:gap-2 bg-transparent bg-no-repeat bg-[length:100%_100%] w-full ${
                      selected ? "ring-2 ring-[#0A3D2E]" : ""
                    }`}
                    style={{
                      backgroundImage: "url('/images/order-luxury/order-card-frame.webp')",
                      minHeight: "220px",
                    }}
                  >
                    {/* 1. السطر العلوي: كبسولة رقم الطلب وبلوك اسم المحل كلاهما داخل الإطار بدقة */}
                    <div className="relative z-10 flex items-center justify-between gap-1.5 sm:gap-2 min-w-0 w-full">
                      {/* اليمين: بلوك اسم المحل (مزاح لليسار ومنزل للأسفل ليتوسط الكرت ومحمي من خروج النص) */}
                      <div className="relative flex-1 min-w-0 max-w-[68%] sm:max-w-[74%]">
                        <div
                          className="w-full h-11 sm:h-12.5 rounded-full flex items-center justify-center px-3 sm:px-6 mr-0.5 sm:mr-1 mt-0.5 bg-no-repeat bg-[length:100%_100%] select-none overflow-hidden"
                          style={{
                            backgroundImage: `url('${headerWebpBg}')`,
                          }}
                        >
                          <span
                            className="font-black text-xs sm:text-sm leading-tight tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate text-center block w-full px-1"
                            style={{
                              color: "#FFFFFF",
                              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                            }}
                            title={headerTextStr}
                          >
                            {headerTextStr}
                          </span>
                        </div>
                      </div>

                      {/* اليسار: كبسولة رقم الطلب المكيشة + مربع الاختيار في أقصى اليسار */}
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-0.5 sm:ml-1">
                        {showSelectColumn && (
                          <input
                            type="checkbox"
                            checked={selected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => onToggleOne && onToggleOne(o.id)}
                            className="size-5 rounded border-2 border-[#C9A86A] text-[#0A3D2E] focus:ring-[#C9A86A] cursor-pointer"
                          />
                        )}

                        <div className="relative shrink-0">
                          {/* كبسولة رقم الطلب بصورة الخلفية المكيشة والنص متمركز وكبير في قلبها */}
                          <div
                            className="min-w-[76px] sm:min-w-[92px] h-10.5 sm:h-12 px-2 rounded-lg flex items-center justify-center text-center font-black font-mono text-base sm:text-xl tracking-wider select-none bg-no-repeat bg-[length:100%_100%] leading-none"
                            style={{
                              backgroundImage: "url('/images/order-luxury/order-number-bg.webp')",
                              color: "#F5D77F",
                              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
                            }}
                          >
                            <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pt-0.5">
                              {o.orderNumber}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. القسم الأوسط: دائرة السعر مثبتة في المنتصف تماماً 50% مع وضع الصادر والوارد بجانبيها وكبسولات آمنة للبضاعة والوقت */}
                    <div className="relative z-10 flex items-center justify-between gap-1 sm:gap-2 -mt-2 sm:-mt-3 py-0 px-0.5 sm:px-1 w-full min-h-[70px] sm:min-h-[80px]">
                      {/* النص الأيمن (نوع البضاعة داخل كبسولة أنيقة مؤطرة داخل الإطار) */}
                      <div className="flex items-center justify-start flex-1 min-w-0 max-w-[28%] sm:max-w-[30%]">
                        <div className="inline-flex items-center justify-center px-2 sm:px-2.5 py-0.5 rounded-full bg-[#FFF8F0]/90 dark:bg-slate-900/90 border border-[#C9A86A]/40 shadow-xs max-w-full">
                          <span className="text-[11px] sm:text-xs md:text-sm font-black text-slate-900 dark:text-[#F5D77F] leading-tight truncate">
                            {displayGoodsType}
                          </span>
                        </div>
                      </div>

                      {/* حاوية السعر المركزية المثبتة 100% في منتصف الكرت دائماً */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                        {/* بلوك الصادر (مثبت على يمين دائرة السعر دون زحزحتها) */}
                        <div className="absolute right-full mr-1 sm:mr-1.5 pointer-events-auto shrink-0">
                          <OrderSaderSideBadge o={o} />
                        </div>

                        {/* دائرة السعر المركزية الثابتة دائماً في المنتصف 50% */}
                        <div
                          className="w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center relative select-none bg-no-repeat bg-contain shrink-0 pointer-events-auto"
                          style={{
                            backgroundImage: "url('/images/order-luxury/price-circle.webp')",
                          }}
                        >
                          {isAllPaid ? (
                            <div className="flex flex-col items-center justify-center leading-[1.05] select-none text-center px-1">
                              <span
                                className="text-[13px] sm:text-[15px] font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                                style={{ color: "#F5D77F" }}
                              >
                                كلشي
                              </span>
                              <span
                                className="text-[12px] sm:text-[14px] font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                                style={{ color: "#F5D77F" }}
                              >
                                واصل
                              </span>
                            </div>
                          ) : (
                            <span
                              className={`${
                                numericPrice.length >= 5
                                  ? "text-[18px] sm:text-[21px]"
                                  : numericPrice.length >= 4
                                  ? "text-[22px] sm:text-[26px]"
                                  : numericPrice.length === 3
                                  ? "text-[27px] sm:text-[32px]"
                                  : "text-[34px] sm:text-[40px]"
                              } font-black leading-none font-mono drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] tracking-tight pt-0.5`}
                              style={{
                                color: "#F5D77F",
                              }}
                            >
                              {numericPrice || "—"}
                            </span>
                          )}
                        </div>

                        {/* بلوك الوارد (مثبت على يسار دائرة السعر دون زحزحتها) */}
                        <div className="absolute left-full ml-1 sm:ml-1.5 pointer-events-auto shrink-0">
                          <OrderWardSideBadge o={o} />
                        </div>
                      </div>

                      {/* النص الأيسر (وقت الطلب داخل كبسولة عنابية أنيقة مؤطرة داخل الإطار) */}
                      <div className="flex items-center justify-end flex-1 min-w-0 max-w-[28%] sm:max-w-[30%]">
                        <div className="inline-flex items-center justify-center px-2 sm:px-2.5 py-0.5 rounded-full bg-[#FFF0F0]/95 dark:bg-rose-950/50 border border-[#8B0000]/30 shadow-xs max-w-full">
                          <span className="text-[10.5px] sm:text-xs font-black text-[#8B0000] dark:text-rose-300 leading-tight truncate">
                            {o.orderNoteTime || "فوري"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. القسم السفلي للكرت: كبسولة هاتف الزبون يميناً + أزرار الاستلام والإسناد يساراً في سطر واحد بدون التفاف */}
                    <div className="relative z-10 flex flex-nowrap items-center justify-between gap-1 sm:gap-2 -mt-2 sm:-mt-3 pt-0 w-full">
                      {/* الجهة اليمنى: كبسولة هاتف الزبون العاجية المذهبة بالترتيب المطابق للصورة المرجعية */}
                      <div
                        className="flex items-center gap-0.5 sm:gap-1.5 rounded-full px-1.5 sm:px-3 py-0.5 bg-no-repeat bg-[length:100%_100%] h-8.5 sm:h-10 shrink min-w-0 mr-0.5"
                        style={{
                          backgroundImage: "url('/images/order-luxury/customer-phone-pill.webp')",
                        }}
                      >
                        {/* 1. زر الاتصال 📞 (أقصى اليمين - يغطي دائرة الهاتف المذهبة المدمجة بالكبسولة) */}
                        {o.customerPhone ? (
                          <a
                            href={`tel:${o.customerPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer -mr-0.5"
                            title={`اتصال بالزبون: ${o.customerPhone}`}
                          />
                        ) : (
                          <div className="w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-full shrink-0 -mr-0.5 opacity-50" />
                        )}

                        {/* 2. رقم هاتف الزبون */}
                        <div className="flex items-center px-0.5 min-w-0 truncate">
                          <span className="text-[10px] sm:text-xs font-mono font-black text-slate-900 tracking-tight select-all truncate">
                            {o.customerPhone || "—"}
                          </span>
                        </div>

                        {/* 3. زر اللوكيشن 📍 */}
                        {hasGps ? (
                          <RedGlassOrbButton3D
                            href={o.customerLocationUrl || "#"}
                            title="فتح موقع الزبون 📍"
                          />
                        ) : (
                          <div
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-no-repeat bg-contain select-none shrink-0"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-no-location.webp?v=royalLocV2')",
                            }}
                            title="الزبون لا يملك لوكيشن ⚠️"
                          />
                        )}

                        {/* 4. زر تعديل أسعار التجهيز 💰 (يظهر فقط لطلبات التجهيز) */}
                        {isFromPreparer && (
                          <Link
                            href={`${SECRET_ADMIN_PATH}/orders/${o.id}/price`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition drop-shadow-sm"
                            style={{
                              backgroundImage: "url('/images/order-luxury/1789252908710.webp?v=royal3D')",
                            }}
                            title="تعديل تفاصيل وأسعار التجهيز 💰"
                          />
                        )}

                        {/* 5. زر تعديل الطلب ✏️ */}
                        <Link
                          href={`${SECRET_ADMIN_PATH}/orders/${o.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition drop-shadow-sm"
                          style={{
                            backgroundImage: "url('/images/order-luxury/btn-edit.webp?v=royal3D')",
                          }}
                          title="تعديل الطلب ✏️"
                        />

                        {/* 6. زر الرفض / الإرجاع ❌ (أقصى اليسار) */}
                        {onRejectOrder && !isCancelled && !isDelivered && o.orderStatus !== "archived" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRejectOrder(o);
                            }}
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer drop-shadow-sm"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-reject.webp?v=royal3D')",
                            }}
                            title="رفض الطلب ❌"
                          />
                        )}
                        {onRestoreOrder && isCancelled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestoreOrder(o);
                            }}
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-no-repeat bg-contain select-none shrink-0 hover:scale-110 active:scale-95 transition cursor-pointer drop-shadow-sm"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-restore.webp?v=royal3D')",
                            }}
                            title="إرجاع الطلب المرفوض إلى جديد 🔄"
                          />
                        )}
                      </div>

                      {/* الجهة اليسرى: أزرار الاستلام والإسناد والتسليم متناسقة الحجم ومسحوبة لليمين */}
                      <div className="flex items-center gap-1 sm:gap-1.5 -translate-y-1 ml-0.5 shrink-0">
                        {/* زر استلام ⚡ */}
                        {onAdminPickup && (isPending || isAssigned) && !isCancelled && !isDelivered && o.orderStatus !== "archived" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdminPickup(o);
                            }}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-xs sm:text-sm font-black text-white hover:scale-105 active:scale-95 transition flex items-center justify-center bg-no-repeat bg-contain cursor-pointer shrink-0"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-pickup.webp')",
                            }}
                            title="استلام الطلب وتسجيل الصادر ⚡"
                          />
                        )}

                        {/* زر تسليم 🫴 */}
                        {onAdminDelivery && isDelivering && !isCancelled && !isDelivered && o.orderStatus !== "archived" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdminDelivery(o);
                            }}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-xs sm:text-sm font-black text-white hover:scale-105 active:scale-95 transition flex items-center justify-center bg-no-repeat bg-contain cursor-pointer shrink-0"
                            style={{
                              backgroundImage: "url('/images/order-luxury/btn-delivery.webp')",
                            }}
                            title="تسليم الطلب وتسجيل الوارد 🫴"
                          />
                        )}

                        {/* زر إسناد الطلب */}
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignOrder(o);
                            }}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-xs sm:text-sm font-black flex items-center justify-center text-white hover:scale-105 active:scale-95 transition shrink-0 bg-no-repeat bg-contain cursor-pointer"
                            style={{
                              backgroundImage: hasAssignedCourier
                                ? "url('/images/order-luxury/btn-assign-empty.webp')"
                                : "url('/images/order-luxury/btn-assign.webp')",
                            }}
                            title={hasAssignedCourier ? `تغيير المندوب (${o.courierName})` : "إسناد لمندوب"}
                          >
                            {hasAssignedCourier && (
                              <span className="text-[#FFF8F0] text-[10px] sm:text-xs max-w-[44px] sm:max-w-[54px] truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] font-black">
                                {o.courierName}
                              </span>
                            )}
                          </button>
                        )}

                        {/* زر/شارة طلب عكسي 🔄 يظهر فقط للطلبات العكسية */}
                        {isReverse && (
                          <LuxuryReverseOrderButton
                            orderId={o.id}
                            orderNumber={o.orderNumber}
                            customerPhone={o.customerPhone}
                            role="admin"
                          />
                        )}

                        {/* زر وجهتين 📦➔ */}
                        {isDoubleRoute && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <GlassOrbButton3D title="طلب وجهتين" size="lg">
                              <span className="text-sm">📦➔</span>
                            </GlassOrbButton3D>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        );
      })}



      {/* شريط عدد الطلبات في هذه الصفحة في الأسفل كما في الصورة */}
      <div className="pt-4 text-center font-black text-sm text-[#0A3D2E]">
        عدد الطلبات في هذه الصفحة: {rows.length}
      </div>
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
        {visibleIds.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setShowQuickSelect((v) => {
                  if (v) setSelected(new Set());
                  return !v;
                })
              }
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] sm:text-xs font-black transition active:scale-95 shadow-2xs ${
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
        <div className="flex items-center gap-1 rounded-full bg-white p-0.5 border border-[#C9A86A]/70 shadow-2xs">
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
              className={`flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black transition active:scale-95 ${
                viewMode === "cards"
                  ? "bg-[#0A3D2E] text-[#F5D77F] shadow-2xs border border-[#C9A86A]"
                  : "text-[#0A3D2E] hover:bg-[#FFF8F0]"
              }`}
              title="عرض البطاقات (انقر لاختيار 1 أو 2 أو 3 طلبات بالسطر)"
            >
              <span>📱</span>
              <span>البطاقات</span>
              <span className="inline-flex size-3.5 sm:size-4 items-center justify-center rounded-full bg-gradient-to-b from-[#F5D77F] to-[#C9A86A] text-[#0A3D2E] text-[9px] sm:text-[10px] font-black">
                {cardColumns}
              </span>
              <span className="text-[8px] text-[#C9A86A]">
                {showCardsMenu ? "▲" : "▼"}
              </span>
            </button>

            {/* القائمة المنسدلة لاختيار عدد الأعمدة 1 2 3 */}
            {showCardsMenu && (
              <div className="absolute top-full right-0 mt-1.5 z-30 w-40 rounded-2xl bg-white p-1.5 shadow-2xl border-2 border-[#C9A86A] animate-in fade-in zoom-in-95 duration-150">
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
            className={`flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black transition active:scale-95 ${
              viewMode === "table"
                ? "bg-[#0A3D2E] text-[#F5D77F] shadow-2xs border border-[#C9A86A]"
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

      {/* نافذة استلام الطلب وصادر الإدارة الفاخرة */}
      {adminPickupOrder && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setAdminPickupOrder(null)}
        >
          <div
            className="bg-[#FDF8EE] border-[2px] border-[#C9A86A] rounded-[28px] shadow-[0_12px_40px_rgba(10,61,42,0.10)] overflow-hidden w-full max-w-[440px] text-right animate-in fade-in zoom-in-95"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">💸</span>
                <div>
                  <h2 className="text-[18px] font-black text-[#0A3D2A] leading-tight">تسجيل صادر (إدارة)</h2>
                  <p className="text-[11px] font-bold text-[#8B6A2A]">
                    الطلب #{adminPickupOrder.orderNumber} {adminPickupOrder.courierName ? `— المندوب: ${adminPickupOrder.courierName}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminPickupOrder(null)}
                className="w-8 h-8 rounded-full bg-[#F0EAD8] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2A] text-[16px] cursor-pointer hover:bg-[#E8E0D0] transition font-bold"
              >
                ×
              </button>
            </div>
            <div className="h-[1px] bg-[#C9A86A]/30 mx-6" />

            <div className="p-6">
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
        </div>
      )}

      {/* نافذة تسليم الطلب ووارد الإدارة الفاخرة */}
      {adminDeliveryOrder && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setAdminDeliveryOrder(null)}
        >
          <div
            className="bg-[#FDF8EE] border-[2px] border-[#C9A86A] rounded-[28px] shadow-[0_12px_40px_rgba(139,46,26,0.10)] overflow-hidden w-full max-w-[440px] text-right animate-in fade-in zoom-in-95"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">🫴</span>
                <div>
                  <h2 className="text-[18px] font-black text-[#8B2E1A] leading-tight">تسجيل وارد (إدارة)</h2>
                  <p className="text-[11px] font-bold text-[#8B6A2A]">
                    الطلب #{adminDeliveryOrder.orderNumber} {adminDeliveryOrder.courierName ? `— المندوب: ${adminDeliveryOrder.courierName}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminDeliveryOrder(null)}
                className="w-8 h-8 rounded-full bg-[#F0EAD8] border border-[#C9A86A]/40 flex items-center justify-center text-[#0A3D2A] text-[16px] cursor-pointer hover:bg-[#E8E0D0] transition font-bold"
              >
                ×
              </button>
            </div>
            <div className="h-[1px] bg-[#C9A86A]/30 mx-6" />

            <div className="p-6">
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
        </div>
      )}

      {/* نافذة الإسناد السريع للمندوبين بتصميم ملكي فاخر */}
      {assignOrder && (
        <LuxuryAssignCourierModal
          orderId={assignOrder.id}
          orderNumber={assignOrder.orderNumber}
          currentCourierId={assignOrder.assignedCourierId}
          currentCourierName={assignOrder.courierName}
          couriers={couriers}
          isPending={bulkPending}
          onAssign={async (courierId, directReceipt) => {
            const fd = new FormData();
            fd.append("orderIds", assignOrder.id);
            if (courierId) {
              fd.append("targetStatus", directReceipt ? "delivering" : "assigned");
              fd.append("courierId", courierId);
              if (directReceipt) fd.append("directReceipt", "on");
            } else {
              fd.append("targetStatus", "pending");
              fd.append("courierId", "");
            }
            setAssignOrder(null);
            const res = await bulkUpdateOrdersStatus({}, fd);
            if (res.error) alert(res.error);
            else router.refresh();
          }}
          onClose={() => setAssignOrder(null)}
        />
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

