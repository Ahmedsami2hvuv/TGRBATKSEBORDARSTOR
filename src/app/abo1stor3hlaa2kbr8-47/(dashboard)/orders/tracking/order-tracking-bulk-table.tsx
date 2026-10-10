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
} from "@/app/mandoub/cash-actions";
import type { MandoubCashState } from "@/app/mandoub/types";
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

import {
  Truck,
  Phone,
  Clock,
  MapPin,
  Pencil,
  X,
  RotateCcw,
  User,
  UserCheck,
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  Table2,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
} from "lucide-react";

// تلوين بلوك اسم المحل والمنطقة حسب الحالة مثل حساب المندوب
const getRouteBadgeStyle = (status: string) => {
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
};

function OrderSaderSideBadge({ o }: { o: TrackingTableRow }) {
  const pickup = o.pickupSumDinar ?? null;
  const preparerPickup = o.preparerPickupSumDinar ?? null;
  const adminPickup = o.adminPickupSumDinar ?? null;

  const showPickup = pickup != null && Number.isFinite(pickup) && pickup > 0;
  const showPreparerPickup = preparerPickup != null && Number.isFinite(preparerPickup) && preparerPickup > 0;
  const showAdminPickup = adminPickup != null && Number.isFinite(adminPickup) && adminPickup > 0;

  let text = "";
  let tooltip = "";

  if (showPickup) {
    text = formatDinarAsAlf(pickup);
    tooltip = `صادر المندوب: ${text}`;
  } else if (showPreparerPickup) {
    text = formatDinarAsAlf(preparerPickup);
    tooltip = `صادر المجهز: ${text}`;
  } else if (showAdminPickup) {
    text = formatDinarAsAlf(adminPickup);
    tooltip = `صادر الإدارة: ${text}`;
  } else if (o.saderMismatchType === "excess") {
    text = "زيادة";
    tooltip = "زيادة بالصادر";
  }

  if (!text) return null;

  return (
    <div
      className="h-[26px] px-2 rounded-[8px] bg-[#E8EEFF] border border-[#D0DDFB] text-[#0B2E8C] flex items-center justify-center select-none shrink-0 shadow-2xs"
      title={tooltip}
    >
      <span className="text-[11px] font-black font-mono leading-none tracking-tight text-[#0B2E8C] truncate max-w-full text-center">
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

  if (showDelivery) {
    text = formatDinarAsAlf(delivery);
    tooltip = `وارد المندوب: ${text}`;
  } else if (showPreparerDelivery) {
    text = formatDinarAsAlf(preparerDelivery);
    tooltip = `وارد المجهز: ${text}`;
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
      className="h-[26px] px-2 rounded-[8px] bg-[#FFF8E1] border border-[#FFC107]/60 text-[#0B2E8C] flex items-center justify-center select-none shrink-0 shadow-2xs"
      title={tooltip}
    >
      <span className="text-[11px] font-black font-mono leading-none tracking-tight text-[#0B2E8C] truncate max-w-full text-center">
        {text}
      </span>
    </div>
  );
}

function TrackingCardMoneyBadges({ o, icons }: { o: TrackingTableRow; icons?: GlobalIconsConfig | null }) {
  // نقلت البلوكات لتظهر داخل الكارت مثل حساب المندوب
  return null;
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
      // الأزرق الفاتح للطلب الجديد (مكبر عمودياً)
      return "/images/order-luxury/header-new-v2.webp";
    case "assigned":
      // الأحمر للمسند للمندوب (مكبر عمودياً)
      return "/images/order-luxury/header-assigned-v2.webp";
    case "delivering":
      // الأصفر للمستلم من قبل المندوب (مكبر عمودياً)
      return "/images/order-luxury/header-received-v2.webp";
    case "delivered":
      // الأخضر / الأزرق النيلي للمسلم (مكبر عمودياً)
      return "/images/order-luxury/header-delivered-v2.webp";
    default:
      return "/images/order-luxury/header-assigned-v2.webp";
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
      ? "grid grid-cols-1 gap-2.5 w-full mx-auto"
      : columns === 2
      ? "grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-5xl mx-auto"
      : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full max-w-7xl mx-auto";

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
    <div className="space-y-4 pb-12 w-full">
      {groupedByDate.map((group) => {
        const dateDayNumber = group.items[0]?.createdAt
          ? new Date(group.items[0].createdAt).getDate()
          : 17;

        return (
          <div key={group.dateKey} className="space-y-2.5 w-full">
            {/* شريط الفاصل الزمني للأيام بهوية وصلي الرسمية */}
            <div className="relative overflow-hidden rounded-[16px] bg-gradient-to-r from-[#0B2E8C] via-[#153E9B] to-[#0B2E8C] border border-[#FFC107]/40 px-3.5 py-2 text-white shadow-sm flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFC107]" />
                <span className="text-[#FFC107] font-black text-xs">وصلي</span>
              </div>

              {/* تاريخ اليوم بالمنتصف */}
              <div className="text-center font-black text-xs sm:text-sm tracking-wide text-white drop-shadow-sm">
                {group.dateLabel} <span className="text-[#FFC107] font-semibold text-xs">({group.items.length} طلب)</span>
              </div>

              {/* رقم اليوم */}
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-[#FFC107] text-[#0B2E8C] flex items-center justify-center shadow-xs font-black text-xs">
                  {dateDayNumber}
                </div>
              </div>
            </div>

            {/* قائمة الكروت الملكية التابعة لهذا اليوم ملاصقة وممتدة بعرض الشاشة */}
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

                let cleanNoteTime = (o.orderNoteTime || "").trim();
                if (o.orderType && cleanNoteTime.startsWith(o.orderType)) {
                  cleanNoteTime = cleanNoteTime.slice(o.orderType.length).replace(/^[\s\-–—:]+/, "").trim();
                }
                if (!cleanNoteTime) cleanNoteTime = "فوري";

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
                    className={`group relative rounded-[20px] p-3 transition-all active:scale-[0.99] cursor-pointer flex flex-col justify-between bg-white border-[1.5px] border-[#D0DDFB] shadow-[0_3px_10px_rgba(11,46,140,0.06)] hover:border-[#1E4DB7]/50 hover:shadow-[0_4px_14px_rgba(11,46,140,0.1)] w-full min-h-[195px] select-none ${
                      selected ? "border-[#0B2E8C] ring-2 ring-[#0B2E8C]/25 bg-[#F0F5FF]" : ""
                    }`}
                  >
                    {/* 1. السطر العلوي: شريط مسار وصلي وكبسولة رقم الطلب */}
                    <div className="relative z-10 flex items-center justify-between gap-2 min-w-0 w-full shrink-0">
                      {/* شريط المسار الملون بهوية وصلي بحسب حالة الطلب */}
                      <div
                        className={`flex-1 w-full min-w-0 flex items-center gap-2 text-[14px] sm:text-[15px] font-black rounded-[14px] px-3.5 py-2 shadow-xs transition-all ${getRouteBadgeStyle(
                          o.orderStatus
                        )}`}
                      >
                        <Truck
                          className={`w-4 h-4 shrink-0 ${
                            isDelivering ? "text-[#0B2E8C]" : "text-[#FFC107]"
                          }`}
                          strokeWidth={2.5}
                        />
                        <span className="flex-1 min-w-0 tracking-wide flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-ellipsis">
                          <span className="font-black shrink-0">{o.shopCustomerLabel || "المحل"}</span>
                          <span className="opacity-70 text-[12px] shrink-0 font-bold">←</span>
                          <span className="font-black truncate">{o.regionName || "المنطقة"}</span>
                        </span>
                      </div>

                      {/* اليسار: كبسولة رقم الطلب واختيار الطلب */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {showSelectColumn && (
                          <input
                            type="checkbox"
                            checked={selected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => onToggleOne && onToggleOne(o.id)}
                            className="size-5 rounded border-2 border-[#D0DDFB] text-[#0B2E8C] focus:ring-[#0B2E8C] cursor-pointer"
                          />
                        )}
                        <div className="shrink-0 h-[28px] bg-[#0B2E8C] rounded-[8px] px-2.5 py-0.5 shadow-xs flex items-center justify-center gap-1">
                          <span className="font-mono font-black text-[#FFC107] text-[13px] leading-none tracking-wide">
                            #{o.orderNumber}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. القسم الأوسط: تفاصيل الشحنة وبلوكات الوارد في اليمين، دائرة السعر التفاعلية في المنتصف، ووقت الطلب */}
                    <div className="relative z-10 flex items-center justify-between gap-2 px-1 w-full my-auto shrink-0 min-h-[68px]">
                      {/* النص الأيمن: نوع البضاعة وبلوكات الوارد والصادر (نفس مكان حساب المندوب) */}
                      <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5">
                        {/* كبسولة نوع البضاعة */}
                        <div className="bg-[#E8EEFF] border border-[#D0DDFB] text-[#0B2E8C] text-[11px] font-bold rounded-[14px] px-3 py-1 max-w-[200px] truncate leading-tight shadow-2xs">
                          {displayGoodsType}
                        </div>

                        {/* بلوكات حالات الوارد المرتبة داخل الطلب (نفس حساب المندوب تماماً) */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* 1. بلوك نقص بالوارد */}
                          {o.wardMismatchType === "deficit" && (
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-rose-50 border-[1.5px] border-rose-500 text-rose-700 shadow-xs select-none shrink-0"
                              title="نقص بالوارد"
                            >
                              <div className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                                <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                              <span className="text-[11px] font-black leading-none">نقص بالوارد</span>
                            </div>
                          )}

                          {/* 2. بلوك زيادة بالوارد */}
                          {o.wardMismatchType === "excess" && (
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-emerald-50 border-[1.5px] border-emerald-500 text-emerald-700 shadow-xs select-none shrink-0"
                              title="زيادة بالوارد"
                            >
                              <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                              <span className="text-[11px] font-black leading-none">زيادة بالوارد</span>
                            </div>
                          )}

                          {/* 3. بلوك بدون وارد */}
                          {(o.noWardRecorded || (o.orderStatus === "delivered" && (o.deliverySumDinar === 0 || o.deliverySumDinar == null))) && (
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-black border border-slate-700 text-white shadow-xs select-none shrink-0"
                              title="بدون وارد مسجل"
                            >
                              <div className="w-3 h-3 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                                <span className="text-[8px] font-black text-white leading-none">✕</span>
                              </div>
                              <span className="text-[11px] font-black leading-none">بدون وارد</span>
                            </div>
                          )}

                          {/* 4. زيادة بالصادر */}
                          {o.saderMismatchType === "excess" && (
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-amber-50 border-[1.5px] border-amber-500 text-amber-700 shadow-xs select-none shrink-0"
                              title="زيادة بالصادر"
                            >
                              <span className="text-[11px] font-black leading-none">زيادة بالصادر</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* دائرة السعر التفاعلية المركزية مع بادجات الصادر والوارد */}
                      <div className="flex items-center gap-1 shrink-0 relative">
                        {/* بادج الصادر */}
                        <OrderSaderSideBadge o={o} />

                        {/* زر دائرة السعر التفاعلية (المتفق عليه: زر التسليم والاستلام يصبح بدائرة السعر) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDelivering && onAdminDelivery) {
                              onAdminDelivery(o);
                            } else if ((isPending || isAssigned) && onAdminPickup) {
                              onAdminPickup(o);
                            } else {
                              onOpenRow(o.id);
                            }
                          }}
                          className="w-[66px] h-[66px] sm:w-[72px] sm:h-[72px] rounded-full bg-[#0B2E8C] border-[3px] border-[#FFC107] flex items-center justify-center relative select-none shrink-0 cursor-pointer active:scale-95 transition-transform shadow-[0_4px_12px_rgba(11,46,140,0.22)] hover:shadow-[0_6px_16px_rgba(11,46,140,0.32)]"
                          title={
                            isDelivering
                              ? "اضغط لتسجيل تسليم الطلب والوارد 🫴"
                              : (isPending || isAssigned)
                              ? "اضغط لتسجيل استلام الطلب والصادر ⚡"
                              : "اضغط لعرض تفاصيل الطلب"
                          }
                        >
                          {isAllPaid ? (
                            <div className="flex flex-col items-center justify-center leading-[1.05] select-none text-center px-1">
                              <span className="text-[12px] sm:text-[13px] font-black tracking-tight text-[#FFC107]">
                                كلشي
                              </span>
                              <span className="text-[11px] sm:text-[12px] font-black tracking-tight text-[#FFC107]">
                                واصل
                              </span>
                            </div>
                          ) : (
                            <span
                              className={`${
                                numericPrice.length >= 5
                                  ? "text-[16px] sm:text-[18px]"
                                  : numericPrice.length >= 4
                                  ? "text-[19px] sm:text-[22px]"
                                  : numericPrice.length === 3
                                  ? "text-[23px] sm:text-[26px]"
                                  : "text-[28px] sm:text-[32px]"
                              } font-black leading-none font-mono tracking-tight text-[#FFC107] pt-0.5`}
                            >
                              {numericPrice || "—"}
                            </span>
                          )}
                        </button>

                        {/* بادج الوارد */}
                        <OrderWardSideBadge o={o} />
                      </div>
                    </div>

                    {/* 3. شريط التواصل والخيارات السفلي بهوية وصلي الرسمية الكاملة */}
                    <div className="relative z-10 h-[44px] rounded-[20px] bg-gradient-to-r from-[#E8EEFF] to-[#FFF8E1] border border-[#D0DDFB] flex items-center justify-between px-2 w-full shrink-0 shadow-2xs">
                      {/* قسم اليمين: زر الاتصال + رقم الزبون + وقت الطلب */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {o.customerPhone ? (
                          <a
                            href={`tel:${o.customerPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-7 h-7 rounded-full bg-[#FFC107] flex items-center justify-center shadow-xs active:scale-95 transition-transform cursor-pointer shrink-0"
                            title={`اتصال بالزبون: ${o.customerPhone}`}
                          >
                            <Phone className="w-3.5 h-3.5 text-[#0B2E8C]" fill="#0B2E8C" strokeWidth={2.2} />
                          </a>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 opacity-50">
                            <Phone className="w-3.5 h-3.5 text-slate-500" strokeWidth={2.2} />
                          </div>
                        )}

                        {/* رقم هاتف الزبون */}
                        <span className="font-mono font-black text-[12px] tracking-wide text-[#0B2E8C] select-all truncate max-w-[100px] sm:max-w-[120px]">
                          {o.customerPhone || "—"}
                        </span>

                        {/* وقت الطلبية */}
                        <div
                          className="h-[24px] px-2 rounded-full border border-[#D0DDFB] bg-white text-[#0B2E8C] text-[10px] font-black flex items-center gap-1 shrink-0 shadow-2xs"
                          title="وقت الطلبية"
                        >
                          <Clock className="w-3 h-3 text-[#1E4DB7]" />
                          <span>{cleanNoteTime}</span>
                        </div>
                      </div>

                      {/* قسم اليسار: اللوكيشن، التعديل، الرفض/الإرجاع، وكبسولة المندوب */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* زر اللوكيشن 📍 */}
                        {hasGps && o.customerLocationUrl ? (
                          <a
                            href={o.customerLocationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-7 h-7 rounded-full bg-[#0B2E8C] flex items-center justify-center shadow-xs active:scale-90 transition-transform hover:bg-[#1E4DB7] cursor-pointer shrink-0"
                            title="فتح موقع الزبون 📍"
                          >
                            <MapPin className="w-3.5 h-3.5 text-[#FFC107]" />
                          </a>
                        ) : (
                          <div
                            className="relative w-7 h-7 rounded-full bg-[#0B2E8C] flex items-center justify-center shadow-xs shrink-0 cursor-default"
                            title="تنبيه: الزبون لا يملك لوكيشن"
                          >
                            <MapPin className="w-3.5 h-3.5 text-[#FFC107]" />
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 shadow-[0_0_8px_#ef4444] border border-white" />
                            </span>
                          </div>
                        )}

                        {/* زر تعديل أسعار التجهيز (إن وجد) */}
                        {isFromPreparer && (
                          <Link
                            href={`${SECRET_ADMIN_PATH}/orders/${o.id}/price`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-7 h-7 rounded-full bg-white border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C] shadow-xs active:scale-90 transition-transform hover:bg-[#F0F4FF] cursor-pointer shrink-0"
                            title="تعديل تفاصيل وأسعار التجهيز"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-[#0B2E8C]" />
                          </Link>
                        )}

                        {/* زر تعديل الطلب ✏️ */}
                        <Link
                          href={`${SECRET_ADMIN_PATH}/orders/${o.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-7 rounded-full bg-white border border-[#D0DDFB] flex items-center justify-center text-[#0B2E8C] shadow-xs active:scale-90 transition-transform hover:bg-[#F0F4FF] cursor-pointer shrink-0"
                          title="تعديل الطلب"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#0B2E8C]" />
                        </Link>

                        {/* زر الرفض / الإرجاع ❌ */}
                        {onRejectOrder && !isCancelled && !isDelivered && o.orderStatus !== "archived" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRejectOrder(o);
                            }}
                            className="w-7 h-7 rounded-full bg-rose-50 border border-rose-300 flex items-center justify-center text-rose-600 shadow-xs active:scale-90 transition-transform hover:bg-rose-100 cursor-pointer shrink-0"
                            title="رفض الطلب"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}
                        {onRestoreOrder && isCancelled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestoreOrder(o);
                            }}
                            className="w-7 h-7 rounded-full bg-sky-50 border border-sky-300 flex items-center justify-center text-sky-600 shadow-xs active:scale-90 transition-transform hover:bg-sky-100 cursor-pointer shrink-0"
                            title="إرجاع الطلب المرفوض إلى جديد"
                          >
                            <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}

                        {/* كبسولة المندوب وإسناد الطلب */}
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignOrder(o);
                            }}
                            className="h-[28px] px-2.5 rounded-full bg-[#0B2E8C] border border-[#FFC107]/40 text-white flex items-center gap-1 shadow-xs active:scale-95 transition-transform cursor-pointer shrink-0"
                            title={hasAssignedCourier ? `تغيير المندوب (${o.courierName})` : "إسناد لمندوب"}
                          >
                            {hasAssignedCourier ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5 text-[#FFC107] shrink-0" />
                                <span className="text-[11px] font-black max-w-[65px] sm:max-w-[75px] truncate text-[#FFF8E1]">
                                  {o.courierName}
                                </span>
                              </>
                            ) : (
                              <>
                                <User className="w-3.5 h-3.5 text-[#FFC107] shrink-0" />
                                <span className="text-[11px] font-bold text-white/90">إسناد</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* شارة طلب عكسي إن وجد */}
                        {isReverse && (
                          <LuxuryReverseOrderButton
                            orderId={o.id}
                            orderNumber={o.orderNumber}
                            customerPhone={o.customerPhone}
                            role="admin"
                          />
                        )}

                        {/* زر وجهتين */}
                        {isDoubleRoute && (
                          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                            <div
                              className="h-[26px] px-2 rounded-full bg-[#0B2E8C] text-[#FFC107] text-[10px] font-black flex items-center justify-center shadow-xs"
                              title="طلب وجهتين"
                            >
                              وجهتين
                            </div>
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
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] sm:text-xs font-black transition active:scale-95 shadow-2xs cursor-pointer ${
                showQuickSelect
                  ? "bg-[#0B2E8C] border-[#FFC107]/50 text-[#FFC107]"
                  : "border-[#D0DDFB] bg-white text-[#0B2E8C] hover:bg-[#F0F4FF]"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-[#FFC107]" />
              <span>تحديد سريع</span>
              <span className={showQuickSelect ? "text-[#FFC107]" : "text-[#0B2E8C]"}>
                {showQuickSelect ? "▲" : "▼"}
              </span>
            </button>
          </div>
        ) : <div />}

        {/* أزرار التبديل بين عرض الكروت وعرض الجدول مع قائمة منسدلة لاختيار 1 2 3 */}
        <div className="flex items-center gap-1 rounded-full bg-white p-0.5 border border-[#D0DDFB] shadow-2xs">
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
              className={`flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black transition active:scale-95 cursor-pointer ${
                viewMode === "cards"
                  ? "bg-[#0B2E8C] text-[#FFC107] shadow-2xs border border-[#0B2E8C]"
                  : "text-[#0B2E8C] hover:bg-[#F0F4FF]"
              }`}
              title="عرض البطاقات (انقر لاختيار 1 أو 2 أو 3 طلبات بالسطر)"
            >
              <LayoutGrid className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>البطاقات</span>
              <span className="inline-flex size-3.5 sm:size-4 items-center justify-center rounded-full bg-[#FFC107] text-[#0B2E8C] text-[9px] sm:text-[10px] font-black">
                {cardColumns}
              </span>
              <span className="text-[8px] text-[#FFC107]">
                {showCardsMenu ? "▲" : "▼"}
              </span>
            </button>

            {/* القائمة المنسدلة لاختيار عدد الأعمدة 1 2 3 */}
            {showCardsMenu && (
              <div className="absolute top-full right-0 mt-1.5 z-30 w-40 rounded-2xl bg-white p-1.5 shadow-xl border-2 border-[#D0DDFB] animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-black text-[#0B2E8C] border-b border-[#D0DDFB] mb-1">
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
                        className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer ${
                          isSelectedNum
                            ? "bg-[#0B2E8C] text-[#FFC107] shadow-xs"
                            : "text-[#0B2E8C] hover:bg-[#F0F4FF]"
                        }`}
                      >
                        <span>
                          {num === 1 ? "1 (طلب واحد)" : num === 2 ? "2 (طلبين)" : "3 (ثلاث طلبات)"}
                        </span>
                        {isSelectedNum && <Check className="w-3.5 h-3.5 text-[#FFC107] stroke-[3]" />}
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
            className={`flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-black transition active:scale-95 cursor-pointer ${
              viewMode === "table"
                ? "bg-[#0B2E8C] text-[#FFC107] shadow-2xs border border-[#0B2E8C]"
                : "text-[#0B2E8C] hover:bg-[#F0F4FF]"
            }`}
          >
            <Table2 className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>الجدول</span>
          </button>
        </div>
      </div>

      {showQuickSelect && visibleIds.length > 0 && (
        <div className="rounded-2xl border-2 border-[#D0DDFB] bg-[#F8FAFF] p-2.5 sm:p-3 shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#FFC107]" />
            <p className="text-[11px] sm:text-xs font-black text-[#0B2E8C]">
              اختر حالة و/أو مندوباً ثم اضغط «تحديد المطابقين»:
            </p>
          </div>
          
          <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
            <label className="flex flex-col gap-0.5 text-[10.5px] font-black text-[#0B2E8C]/80">
              الحالة الحالية
              <select
                value={quickStatus}
                onChange={(e) => setQuickStatus(e.target.value)}
                className="h-8 sm:h-8.5 rounded-xl border border-[#D0DDFB] bg-white px-2 py-1 text-xs font-black text-[#0B2E8C] outline-none shadow-2xs focus:border-[#0B2E8C]"
              >
                {QUICK_STATUS_VALUES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-0.5 text-[10.5px] font-black text-[#0B2E8C]/80">
              المندوب المسند
              <select
                value={quickCourier}
                onChange={(e) => setQuickCourier(e.target.value)}
                className="h-8 sm:h-8.5 min-w-[7.5rem] sm:min-w-[8.5rem] rounded-xl border border-[#D0DDFB] bg-white px-2 py-1 text-xs font-black text-[#0B2E8C] outline-none shadow-2xs focus:border-[#0B2E8C]"
              >
                <option value="any">أي مندوب</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {/* أزرار الإجراء السريع بتصميم وصلي */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={selectMatchingQuickFilters}
                className="h-8 sm:h-8.5 rounded-xl bg-[#0B2E8C] px-3 py-1 text-xs font-black text-[#FFC107] border border-[#FFC107]/40 shadow-xs hover:bg-[#153E9B] active:scale-95 transition cursor-pointer"
                title="تحديد الطلبات المطابقة للفلاتر"
              >
                تحديد المطابقين
              </button>

              <button
                type="button"
                onClick={selectAllVisible}
                className="h-8 sm:h-8.5 rounded-xl border border-[#D0DDFB] bg-white px-2.5 py-1 text-xs font-black text-[#0B2E8C] hover:bg-[#F0F4FF] shadow-2xs active:scale-95 transition cursor-pointer"
                title="تحديد كل الطلبات الظاهرة"
              >
                تحديد الكل
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="h-8 sm:h-8.5 rounded-xl border border-rose-200 bg-white px-2 py-1 text-xs font-black text-rose-700 hover:bg-rose-50 shadow-2xs active:scale-95 transition cursor-pointer"
                title="إفراغ التحديد الحالي"
              >
                إفراغ
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCount ? (
        <div className="fixed bottom-5 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 w-auto max-w-[calc(100vw-2rem)] md:max-w-5xl rounded-3xl border-2 border-[#D0DDFB] bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_15px_40px_rgba(11,46,140,0.18)] animate-in fade-in slide-in-from-bottom-8 duration-300" dir="rtl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center justify-between lg:justify-start gap-3 border-b lg:border-b-0 pb-2 lg:pb-0 border-[#D0DDFB]">
              <div>
                <p className="text-xs sm:text-sm font-black text-[#0B2E8C]">
                  تم اختيار <span className="text-base sm:text-lg font-black text-[#0B2E8C]">{selectedCount}</span> طلبية
                </p>
                {bulkState.error ? (
                  <p className="mt-0.5 text-xs font-bold text-rose-600">
                    {bulkState.error}
                  </p>
                ) : null}
                {bulkPending ? (
                  <p className="mt-0.5 text-[11px] font-bold text-[#0B2E8C] animate-pulse">جارٍ حفظ التعديلات… ⏳</p>
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

              <label className="flex flex-col gap-0.5 text-[10.5px] font-black text-[#0B2E8C]/80">
                الحالة الجديدة
                <select
                  name="targetStatus"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="h-8.5 rounded-xl border border-[#D0DDFB] bg-white px-2 py-1 text-xs font-black text-[#0B2E8C] outline-none shadow-2xs focus:border-[#0B2E8C]"
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
                <label className="flex flex-col gap-0.5 text-[10.5px] font-black text-[#0B2E8C]/80">
                  المندوب المسند
                  <select
                    name="courierId"
                    value={courierId}
                    onChange={(e) => setCourierId(e.target.value)}
                    className="h-8.5 min-w-[8rem] rounded-xl border border-[#D0DDFB] bg-white px-2 py-1 text-xs font-black text-[#0B2E8C] outline-none shadow-2xs focus:border-[#0B2E8C]"
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
                <div className="flex h-8.5 items-center gap-1.5 bg-[#F0F4FF] px-2.5 rounded-xl border border-[#D0DDFB]">
                  <input type="checkbox" id="bulk-direct-tracking" name="directReceipt" className="h-4 w-4 rounded border-[#D0DDFB] text-[#0B2E8C] focus:ring-[#0B2E8C]" />
                  <label htmlFor="bulk-direct-tracking" className="text-[10px] font-black text-[#0B2E8C] cursor-pointer select-none">استلام مباشر</label>
                </div>
              )}

              <button
                type="submit"
                disabled={bulkPending || (needsCourier && !courierId)}
                className="h-8.5 rounded-xl bg-[#0B2E8C] px-4 text-xs font-black text-[#FFC107] border border-[#FFC107]/40 shadow-sm hover:bg-[#153E9B] active:scale-95 disabled:opacity-50 transition cursor-pointer"
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
          onAssignOrder={(r) => {
            if (couriers.length === 1 && (!r.assignedCourierId || r.assignedCourierId === "")) {
              const fd = new FormData();
              fd.append("orderIds", r.id);
              fd.append("targetStatus", "assigned");
              fd.append("courierId", couriers[0].id);
              bulkUpdateOrdersStatus({}, fd).then((res) => {
                if (res?.error) alert(res.error);
              });
            } else {
              setAssignOrder(r);
            }
          }}
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
                  if (couriers.length === 1 && (!row.assignedCourierName || row.assignedCourierName === "—")) {
                    const fd = new FormData();
                    fd.append("orderIds", row.id);
                    fd.append("targetStatus", "assigned");
                    fd.append("courierId", couriers[0].id);
                    bulkUpdateOrdersStatus({}, fd).then((res) => {
                      if (res?.error) alert(res.error);
                    });
                  } else if (originalRow) {
                    setAssignOrder(originalRow);
                  }
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

