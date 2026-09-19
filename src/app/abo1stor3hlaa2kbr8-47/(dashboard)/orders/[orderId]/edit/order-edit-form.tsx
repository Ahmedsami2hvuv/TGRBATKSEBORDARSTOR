"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import {
  dinarDecimalToAlfInputString,
  parseAlfInputToDinarOrZero,
} from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { OrderStatusRadioGroup } from "@/components/order-status-radio-group";
import { AdminVoiceNoteSection } from "./admin-voice-note-section";
import { CustomerDoorPhotoQuick } from "../customer-door-photo-quick";
import {
  clearOrderCustomerLocationAdmin,
  setAdminOrderCustomerLocationFromGeolocation,
  updateOrderAdmin,
  type OrderEditState,
} from "./actions";
import { DeleteVoiceNoteButton } from "./delete-voice-note-button";
import { AdminRegionSearchPicker } from "@/components/admin-region-search-picker";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { ShopSearchPicker } from "@/components/shop-search-picker";


const STATUS_OPTIONS = [
  { value: "pending", label: "قيد الانتظار (جديد)" },
  { value: "assigned", label: "مسند للمندوب" },
  { value: "delivering", label: "قيد التوصيل" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "مرفوض" },
  { value: "archived", label: "مؤرشف" },
];

const initial: OrderEditState = {};

type ShopOpt = { id: string; name: string; regionDeliveryPrice: string };

function sanitizePhone(value: string): string {
  const arabicDigits = /[٠١٢٣٤٥٦٧٨٩]/g;
  const persianDigits = /[۰۱۲۳۴۵۶۷۸۹]/g;
  let clean = value
    .replace(arabicDigits, (d) => String(d.charCodeAt(0) - 1632))
    .replace(persianDigits, (d) => String(d.charCodeAt(0) - 1776));
  return clean.replace(/\D/g, "");
}

function handlePhoneBlur(value: string, setter: (v: string) => void) {
  let clean = sanitizePhone(value);
  while (clean.startsWith("00")) {
    clean = clean.slice(2);
  }
  if (clean.startsWith("964")) {
    clean = clean.slice(3);
  }
  while (clean.startsWith("0")) {
    clean = clean.slice(1);
  }
  if (clean.length === 10 && clean.startsWith("7")) {
    setter(`0${clean}`);
  } else if (clean.length === 11 && clean.startsWith("07")) {
    setter(clean);
  } else {
    setter(clean);
  }
}

type RegionOpt = { id: string; name: string; deliveryPrice: string };
type CourierOpt = { id: string; name: string };

type CustomerOpt = {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  customerRegionId: string | null;
  customerLocationUrl: string;
  customerLandmark: string;
};

type EmployeeOpt = { id: string; shopId: string; name: string };

type CustomerPrefill = {
  id: string;
  source: "customer" | "phoneProfile";
  shopId: string | null;
  name: string;
  phone: string;
  customerRegionId: string | null;
  customerLocationUrl: string;
  customerLandmark: string;
  customerDoorPhotoUrl: string | null;
  alternatePhone: string | null;
  isBlocked?: boolean;
  isShopBlocked?: boolean;
};

export function OrderEditForm({
  orderId,
  orderNumber,
  routeMode = "single",
  defaultShopId,
  defaultSubmittedByEmployeeId,
  employees,
  defaultStatus,
  defaultOrderType,
  defaultSummary,
  defaultCustomerPhone,
  defaultAlternatePhone,
  defaultCustomerLocationUrl,
  defaultCustomerLandmark,
  defaultCustomerId,
  customers,
  defaultCustomerRegionId,
  defaultSecondCustomerPhone = "",
  defaultSecondAlternatePhone = "",
  defaultSecondCustomerRegionId = "",
  defaultSecondCustomerLocationUrl = "",
  defaultSecondCustomerLandmark = "",
  defaultSecondCustomerDoorPhotoUrl = null,
  defaultImageUrl,
  defaultOrderImageUploadedByName,
  defaultCustomerDoorPhotoUrl,
  defaultCustomerDoorPhotoUploadedByName,
  defaultCustomerLocationUploadedByName,
  defaultVoiceNoteUrl,
  defaultAdminVoiceNoteUrl,
  defaultPurchasePrice = "",
  defaultOrderSubtotal,
  defaultDeliveryPrice,
  defaultTotalAmount,
  defaultOrderNoteTime,
  defaultAssignedCourierId,
  defaultPrepaidAll,
  defaultIsBlocked,
  defaultIsShopBlocked,
  shops,
  regions,
  couriers,
}: {
  orderId: string;
  orderNumber: number;
  routeMode?: "single" | "double";
  defaultShopId: string;
  defaultSubmittedByEmployeeId: string;
  employees: EmployeeOpt[];
  defaultStatus: string;
  defaultOrderType: string;
  defaultSummary: string;
  defaultCustomerPhone: string;
  defaultAlternatePhone: string;
  defaultCustomerLocationUrl: string;
  defaultCustomerLandmark: string;
  defaultCustomerId: string;
  customers: CustomerOpt[];
  defaultCustomerRegionId: string;
  defaultSecondCustomerPhone?: string;
  defaultSecondAlternatePhone?: string;
  defaultSecondCustomerRegionId?: string;
  defaultSecondCustomerLocationUrl?: string;
  defaultSecondCustomerLandmark?: string;
  defaultSecondCustomerDoorPhotoUrl?: string | null;
  defaultImageUrl: string | null;
  defaultOrderImageUploadedByName: string | null;
  defaultCustomerDoorPhotoUrl: string | null;
  defaultCustomerDoorPhotoUploadedByName: string | null;
  defaultCustomerLocationUploadedByName?: string | null;
  defaultVoiceNoteUrl: string | null;
  defaultAdminVoiceNoteUrl: string | null;
  defaultPurchasePrice?: string;
  defaultOrderSubtotal: string;
  defaultDeliveryPrice: string;
  defaultTotalAmount: string;
  defaultOrderNoteTime: string;
  defaultAssignedCourierId: string;
  defaultPrepaidAll: boolean;
  defaultIsBlocked?: boolean;
  defaultIsShopBlocked?: boolean;
  shops: ShopOpt[];
  regions: RegionOpt[];
  couriers: CourierOpt[];
}) {
  const bound = updateOrderAdmin.bind(null, orderId);
  const [state, formAction, pending] = useActionState(bound, initial);

  const [shopId, setShopId] = useState(defaultShopId);
  const [submittedByEmployeeId, setSubmittedByEmployeeId] = useState(
    defaultSubmittedByEmployeeId,
  );
  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone);
  const [alternatePhone, setAlternatePhone] = useState(defaultAlternatePhone);
  const [customerRegionId, setCustomerRegionId] = useState(defaultCustomerRegionId);
  const [custLocationUrl, setCustLocationUrl] = useState(defaultCustomerLocationUrl);
  const [custLandmark, setCustLandmark] = useState(defaultCustomerLandmark);

  const [secondCustomerPhone, setSecondCustomerPhone] = useState(defaultSecondCustomerPhone);
  const [secondAlternatePhone, setSecondAlternatePhone] = useState(defaultSecondAlternatePhone);
  const [secondCustomerRegionId, setSecondCustomerRegionId] = useState(defaultSecondCustomerRegionId);
  const [secondCustLocationUrl, setSecondCustLocationUrl] = useState(defaultSecondCustomerLocationUrl);
  const [secondCustLandmark, setSecondCustLandmark] = useState(defaultSecondCustomerLandmark);

  const [isBlocked, setIsBlocked] = useState(!!defaultIsBlocked);
  const [isShopBlocked, setIsShopBlocked] = useState(!!defaultIsShopBlocked);
  const [firstPrefill, setFirstPrefill] = useState<CustomerPrefill | null>(null);
  const [secondPrefill, setSecondPrefill] = useState<CustomerPrefill | null>(null);
  const [firstPrefillLoading, setFirstPrefillLoading] = useState(false);
  const [secondPrefillLoading, setSecondPrefillLoading] = useState(false);
  const [firstDoorPhotoUrl, setFirstDoorPhotoUrl] = useState<string | null>(defaultCustomerDoorPhotoUrl);
  const [secondDoorPhotoUrl, setSecondDoorPhotoUrl] = useState<string | null>(defaultSecondCustomerDoorPhotoUrl);

  const [locBusy, setLocBusy] = useState(false);
  const [confirmClearLoc, setConfirmClearLoc] = useState(false);
  const [confirmReplaceLoc, setConfirmReplaceLoc] = useState(false);
  const router = useRouter();
  const [purchasePrice, setPurchasePrice] = useState(defaultPurchasePrice);
  const [orderSubtotal, setOrderSubtotal] = useState(defaultOrderSubtotal);
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);
  const [selectedCourierId, setSelectedCourierId] = useState(defaultAssignedCourierId);

  const calculatedProfit = useMemo(() => {
    const p = parseFloat(purchasePrice);
    const s = parseFloat(orderSubtotal);
    if (!isNaN(p) && !isNaN(s) && s > p && purchasePrice.trim() !== "") {
      return s - p;
    }
    return null;
  }, [purchasePrice, orderSubtotal]);
  const [deliveryPrice, setDeliveryPrice] = useState(defaultDeliveryPrice);
  const [totalAmount, setTotalAmount] = useState(defaultTotalAmount);
  const [summaryText, setSummaryText] = useState(defaultSummary);
  const [prepaidAllEnabled, setPrepaidAllEnabled] = useState(defaultPrepaidAll);
  const [reversePickupEnabled, setReversePickupEnabled] = useState(isReversePickupOrderType(defaultOrderType));
  const formRef = useRef<HTMLFormElement>(null);
  const orderImgRef = useRef<HTMLInputElement>(null);
  const summaryTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = summaryTextareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(90, el.scrollHeight + 4)}px`;
    }
  }, [summaryText]);

  const adjustPurchasePrice = (delta: number) => {
    const current = parseFloat(purchasePrice) || 0;
    const next = Math.max(0, parseFloat((current + delta).toFixed(2)));
    setPurchasePrice(next === 0 ? "" : next.toString());
  };

  const adjustOrderSubtotal = (delta: number) => {
    const current = parseFloat(orderSubtotal) || 0;
    const next = Math.max(0, parseFloat((current + delta).toFixed(2)));
    const nextStr = next === 0 ? "0" : next.toString();
    onOrderSubtotalChange(nextStr);
  };

  const submitCustomerImportChoice = useCallback(
    (choice: "confirm" | "decline", pending: NonNullable<OrderEditState["pendingCustomerImport"]>) => {
      const form = formRef.current;
      if (!form) return;
      const fd = new FormData(form);
      fd.set("customerImportChoice", choice);
      if (choice === "confirm") {
        fd.set("importCustomerId", pending.customerId);
      }
      formAction(fd);
    },
    [formAction],
  );

  const onClearCustomerLocation = useCallback(() => {
    if (!custLocationUrl.trim()) return;
    if (!confirmClearLoc) {
      setConfirmClearLoc(true);
      setConfirmReplaceLoc(false);
      return;
    }
    setConfirmClearLoc(false);
    void (async () => {
      setLocBusy(true);
      try {
        const r = await clearOrderCustomerLocationAdmin(orderId);
        if (r.error) {
          window.alert(r.error);
          return;
        }
        setCustLocationUrl("");
        router.refresh();
      } finally {
        setLocBusy(false);
      }
    })();
  }, [custLocationUrl, orderId, router, confirmClearLoc]);

  const onReplaceCustomerLocationGps = useCallback(() => {
    if (!confirmReplaceLoc) {
      setConfirmReplaceLoc(true);
      setConfirmClearLoc(false);
      return;
    }
    setConfirmReplaceLoc(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      window.alert("المتصفح لا يدعم تحديد الموقع.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          setLocBusy(true);
          try {
            const r = await setAdminOrderCustomerLocationFromGeolocation(
              orderId,
              pos.coords.latitude,
              pos.coords.longitude,
            );
            if (r.error) {
              window.alert(r.error);
              return;
            }
            if (r.locationUrl) setCustLocationUrl(r.locationUrl);
            router.refresh();
          } finally {
            setLocBusy(false);
          }
        })();
      },
      (err) => {
        if (err.code === 1) {
          window.alert("تم رفض إذن الموقع. اسمح بالوصول ثم أعد المحاولة.");
        } else {
          window.alert("تعذّر تحديد الموقع. تأكد من تشغيل GPS ثم أعد المحاولة.");
        }
      },
      { enableHighAccuracy: true, timeout: 28000, maximumAge: 0 },
    );
  }, [orderId, router, confirmReplaceLoc]);

  useEffect(() => {
    setSummaryText(defaultSummary);
  }, [defaultSummary]);

  useEffect(() => {
    setPrepaidAllEnabled(defaultPrepaidAll);
  }, [defaultPrepaidAll]);

  useEffect(() => {
    if (!customerPhone.trim() || !customerRegionId.trim()) {
      setFirstPrefill(null);
      setFirstPrefillLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setFirstPrefillLoading(true);
        try {
          const params = new URLSearchParams({
            phone: customerPhone,
            regionId: customerRegionId,
            shopId: shopId,
          });
          const res = await fetch(`/api/abo1stor3hlaa2kbr8-47/customer-prefill?${params.toString()}`);
          if (!res.ok) throw new Error();
          const json = await res.json();
          if (active) setFirstPrefill(json.profile || null);
        } catch {
          if (active) setFirstPrefill(null);
        } finally {
          if (active) setFirstPrefillLoading(false);
        }
      })();
    }, 500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerPhone, customerRegionId, shopId]);

  useEffect(() => {
    if (!secondCustomerPhone.trim() || !secondCustomerRegionId.trim()) {
      setSecondPrefill(null);
      setSecondPrefillLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSecondPrefillLoading(true);
        try {
          const params = new URLSearchParams({
            phone: secondCustomerPhone,
            regionId: secondCustomerRegionId,
            // Second customer prefill might not care about shopId if it's just a recipient
          });
          const res = await fetch(`/api/abo1stor3hlaa2kbr8-47/customer-prefill?${params.toString()}`);
          if (!res.ok) throw new Error();
          const json = await res.json();
          if (active) setSecondPrefill(json.profile || null);
        } catch {
          if (active) setSecondPrefill(null);
        } finally {
          if (active) setSecondPrefillLoading(false);
        }
      })();
    }, 500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [secondCustomerPhone, secondCustomerRegionId]);

  const applyFirstPrefill = () => {
    if (!firstPrefill) return;
    setCustLocationUrl(firstPrefill.customerLocationUrl || "");
    setCustLandmark(firstPrefill.customerLandmark || "");
    if (firstPrefill.alternatePhone) setAlternatePhone(firstPrefill.alternatePhone);
    if (firstPrefill.customerDoorPhotoUrl) setFirstDoorPhotoUrl(firstPrefill.customerDoorPhotoUrl);
    if (firstPrefill.isBlocked !== undefined) setIsBlocked(firstPrefill.isBlocked);
    if (firstPrefill.isShopBlocked !== undefined) setIsShopBlocked(firstPrefill.isShopBlocked);
  };

  const applySecondPrefill = () => {
    if (!secondPrefill) return;
    setSecondCustLocationUrl(secondPrefill.customerLocationUrl || "");
    setSecondCustLandmark(secondPrefill.customerLandmark || "");
    if (secondPrefill.alternatePhone) setSecondAlternatePhone(secondPrefill.alternatePhone);
    if (secondPrefill.customerDoorPhotoUrl) setSecondDoorPhotoUrl(secondPrefill.customerDoorPhotoUrl);
  };

  const customersForShop = useMemo(
    () => customers.filter((c) => c.shopId === shopId),
    [customers, shopId],
  );

  const employeesForShop = useMemo(
    () => employees.filter((e) => e.shopId === shopId),
    [employees, shopId],
  );

  useEffect(() => {
    setSubmittedByEmployeeId((prev) => {
      if (!prev) return prev;
      const ok = employees.some((e) => e.id === prev && e.shopId === shopId);
      return ok ? prev : "";
    });
  }, [shopId, employees]);

  const computeDeliveryFromRegions = useCallback(
    (sid: string, custRid: string): string => {
      const shop = shops.find((s) => s.id === sid);
      if (!shop) return "0";
      const shopDel = parseAlfInputToDinarOrZero(shop.regionDeliveryPrice);
      if (!custRid.trim()) {
        return dinarDecimalToAlfInputString(shopDel);
      }
      const reg = regions.find((r) => r.id === custRid);
      if (!reg) return dinarDecimalToAlfInputString(shopDel);
      const custDel = parseAlfInputToDinarOrZero(reg.deliveryPrice);
      return dinarDecimalToAlfInputString(Math.max(shopDel, custDel));
    },
    [shops, regions],
  );

  const syncTotalFromSubAndDel = useCallback((subStr: string, delStr: string) => {
    const sub = parseAlfInputToDinarOrZero(subStr);
    const del = parseAlfInputToDinarOrZero(delStr);
    setTotalAmount(dinarDecimalToAlfInputString(sub + del));
  }, []);

  const onShopChange = (nextShopId: string) => {
    setShopId(nextShopId);
    setSubmittedByEmployeeId((prev) => {
      const ok = employees.some((e) => e.id === prev && e.shopId === nextShopId);
      return ok ? prev : "";
    });
    setCustomerId((prev) => {
      const ok = customers.some((c) => c.id === prev && c.shopId === nextShopId);
      return ok ? prev : "";
    });
    const nextDel = computeDeliveryFromRegions(nextShopId, customerRegionId);
    setDeliveryPrice(nextDel);
    syncTotalFromSubAndDel(orderSubtotal, nextDel);
  };

  const onCustomerPick = (nextId: string) => {
    setCustomerId(nextId);
    if (!nextId.trim()) return;
    const c = customers.find((x) => x.id === nextId);
    if (!c) return;
    setCustomerPhone(c.phone);
    setCustomerRegionId(c.customerRegionId ?? "");
    setCustLocationUrl(c.customerLocationUrl);
    setCustLandmark(c.customerLandmark);
    const nextDel = computeDeliveryFromRegions(shopId, c.customerRegionId ?? "");
    setDeliveryPrice(nextDel);
    syncTotalFromSubAndDel(orderSubtotal, nextDel);
  };

  const onCustomerRegionChange = (nextRegionId: string) => {
    setCustomerRegionId(nextRegionId);
    const nextDel = computeDeliveryFromRegions(shopId, nextRegionId);
    setDeliveryPrice(nextDel);
    syncTotalFromSubAndDel(orderSubtotal, nextDel);
  };

  const onOrderSubtotalChange = (v: string) => {
    setOrderSubtotal(v);
    syncTotalFromSubAndDel(v, deliveryPrice);
  };

  const onDeliveryChange = (v: string) => {
    setDeliveryPrice(v);
    syncTotalFromSubAndDel(orderSubtotal, v);
  };

  const selectedRegionName = useMemo(() => {
    if (!customerRegionId.trim()) return null;
    return regions.find((r) => r.id === customerRegionId)?.name ?? null;
  }, [customerRegionId, regions]);

  const secondSelectedRegionName = useMemo(() => {
    if (!secondCustomerRegionId.trim()) return null;
    return regions.find((r) => r.id === secondCustomerRegionId)?.name ?? null;
  }, [secondCustomerRegionId, regions]);

  const courierRadioOptions = useMemo(
    () => [
      { value: "", label: "بدون إسناد" },
      ...couriers.map((c) => ({ value: c.id, label: c.name })),
    ],
    [couriers],
  );

  const imgSrc = resolvePublicAssetSrc(defaultImageUrl);
  const customerDoorSrc = resolvePublicAssetSrc(firstDoorPhotoUrl);
  const secondCustomerDoorSrc = resolvePublicAssetSrc(secondDoorPhotoUrl);
  const voiceSrc = resolvePublicAssetSrc(defaultVoiceNoteUrl);

  return (
    <>
    <div
      className={`relative pb-6 ${
        prepaidAllEnabled || reversePickupEnabled
          ? "rounded-2xl border-2 border-red-300/85 bg-gradient-to-b from-red-50/70 to-red-50/20 p-3 sm:p-4 shadow-inner"
          : ""
      }`}
    >
    <form
      id="admin-order-edit-form"
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4"
      dir="rtl"
    >
      {!custLocationUrl.trim() ? (
        <div
          className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs sm:text-sm font-bold text-rose-900"
          role="status"
        >
          📍 لا يوجد رابط لوكيشن للزبون — أضف الرابط أدناه أو عيّنه عند الإسناد.
        </div>
      ) : null}

      {isBlocked && (
        <div
          className="animate-pulse rounded-xl border-2 border-red-600 bg-red-100 px-3.5 py-2.5 text-center text-xs sm:text-sm font-black text-red-950 shadow-sm flex items-center justify-center gap-2"
          role="alert"
        >
          <span>🛑</span>
          <span>تنبيه: هذا الزبون محظور عاماً من التوصيل (شامل لكل المحلات في النظام)</span>
        </div>
      )}

      {!isBlocked && isShopBlocked && (
        <div
          className="rounded-xl border-2 border-amber-500 bg-amber-50 px-3.5 py-2 text-center text-xs sm:text-sm font-black text-amber-950 shadow-xs flex items-center justify-center gap-2"
          role="alert"
        >
          <span>⚠️</span>
          <span>تنبيه: هذا الزبون محظور من هذا المحل ({shops.find((s) => s.id === shopId)?.name || "هذا المحل"}) فقط</span>
        </div>
      )}

      {/* بصمة الإدارة الصوتي */}
      <AdminVoiceNoteSection
        orderId={orderId}
        defaultAdminVoiceNoteUrl={defaultAdminVoiceNoteUrl}
      />

      {/* 1. اختيار المندوب */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-black text-[#0A3D2E] block">المندوب:</label>
        <div className="flex flex-wrap items-stretch gap-1.5" dir="rtl">
          {courierRadioOptions.map((o) => {
            const isSelected = selectedCourierId === o.value;
            return (
              <label
                key={o.value}
                className={`min-h-[36px] px-3 py-1 rounded-[12px] border-[1.5px] flex items-center justify-center text-center cursor-pointer transition-all active:scale-95 select-none ${
                  isSelected
                    ? "bg-gradient-to-b from-[#0E3D2B] via-[#0A3525] to-[#07281C] border-[#C9A86A] text-[#E8C77E] shadow-[0_2px_8px_rgba(10,46,32,0.35),inset_0_1px_0_rgba(232,199,126,0.3)] font-black text-xs sm:text-sm"
                    : "bg-[#FFFEF8] border-[#E8D5A3] text-[#0A3D2E] hover:border-[#C9A86A] hover:bg-[#FDF6E3] font-bold text-xs sm:text-sm"
                }`}
              >
                <input
                  type="radio"
                  name="assignedCourierId"
                  value={o.value}
                  checked={isSelected}
                  onChange={() => setSelectedCourierId(o.value)}
                  className="sr-only"
                />
                <span className="truncate leading-none">{o.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. اختيار حالة الطلبية بالألوان المعتمدة بالنظام */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-black text-[#0A3D2E] block">حالة الطلبية:</label>
        <div className="flex flex-wrap items-stretch gap-1.5" dir="rtl">
          {STATUS_OPTIONS.map((o) => {
            const isSelected = selectedStatus === o.value;
            let selectedClass = "bg-[#0A3D2E] text-[#E8C77E] border-[#C9A86A]";
            if (o.value === "pending") selectedClass = "bg-red-600 text-white border-red-700 shadow-sm font-black";
            else if (o.value === "assigned") selectedClass = "bg-rose-600 text-white border-rose-700 shadow-sm font-black";
            else if (o.value === "delivering") selectedClass = "bg-amber-500 text-slate-950 border-amber-600 shadow-sm font-black";
            else if (o.value === "delivered") selectedClass = "bg-emerald-600 text-white border-emerald-700 shadow-sm font-black";
            else if (o.value === "cancelled") selectedClass = "bg-slate-600 text-white border-slate-700 shadow-sm font-black";
            else if (o.value === "archived") selectedClass = "bg-violet-600 text-white border-violet-700 shadow-sm font-black";

            return (
              <label
                key={o.value}
                className={`min-h-[36px] px-3 py-1 rounded-[12px] border-[1.5px] flex items-center justify-center text-center cursor-pointer transition-all active:scale-95 select-none ${
                  isSelected
                    ? `${selectedClass} shadow-md font-black text-xs sm:text-sm`
                    : "bg-[#FFFEF8] border-[#E8D5A3] text-slate-700 hover:border-[#C9A86A] hover:bg-[#FDF6E3] font-bold text-xs sm:text-sm"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={o.value}
                  checked={isSelected}
                  onChange={() => setSelectedStatus(o.value)}
                  className="sr-only"
                />
                <span className="truncate leading-none">{o.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {routeMode === "double" ? (
        <div className="rounded-2xl border-2 border-sky-400 bg-gradient-to-r from-sky-50 to-indigo-50 p-3.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-lg font-bold text-white shadow">
              ⇄
            </span>
            <div>
              <h3 className="text-sm font-black text-sky-950">طلب ذو وجهتين (بين زبونين فقط)</h3>
              <p className="text-[11px] font-bold text-sky-800">
                عملية نقل مباشرة بين الزبون المرسل (الجهة الأولى) والزبون المستلم (الجهة الثانية).
              </p>
            </div>
          </div>
          <input type="hidden" name="shopId" value={shopId} />
          <input type="hidden" name="submittedByEmployeeId" value={submittedByEmployeeId} />
        </div>
      ) : (
        <div className="space-y-3">
          <ShopSearchPicker
            shops={shops}
            fieldName="shopId"
            label="المحل"
            required
            value={shopId}
            onValueChange={onShopChange}
          />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[12px] font-black text-[#0A3D2E] block">عميل المحل (موظف رفع الطلب)</span>
            <select
              name="submittedByEmployeeId"
              value={submittedByEmployeeId}
              onChange={(e) => setSubmittedByEmployeeId(e.target.value)}
              className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10"
            >
              <option value="">— بدون ربط بموظف محدد (من رفع الطلب من داخل المحل) —</option>
              {employeesForShop.map((e) => (
                <option key={e.id} value={e.id}>
                  {(e.name || "").trim() ? e.name.trim() : "موظف بدون اسم"}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <input type="hidden" name="customerId" value={customerId} />

      {/* نوع الطلب */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[12px] font-black text-[#0A3D2E] block">نوع الطلب</span>
        <input
          name="orderType"
          defaultValue={defaultOrderType}
          className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
        />
      </label>

      {/* أسعار الشراء والبيع والتوصيل والمجموع */}
      <div className="flex flex-wrap items-end gap-2 sm:gap-2.5 rounded-2xl border-[1.5px] border-[#C9A86A]/40 bg-[#FDF6E3]/30 p-3 sm:p-3.5 shadow-xs">
        {/* سعر الشراء للمحل */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] sm:text-[12px] font-black text-[#0A3D2E]">سعر الشراء (للمحل)</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => adjustPurchasePrice(-0.25)}
              className="flex h-[36px] w-[34px] items-center justify-center rounded-xl border border-rose-300 bg-rose-50 text-xl font-black text-rose-700 transition shadow-xs hover:bg-rose-100 active:scale-90"
              title="إنقاص 0.25"
            >
              -
            </button>
            <input
              name="purchasePrice"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0"
              className="w-16 sm:w-20 h-[36px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-1 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums text-center focus:border-[#0A3D2E] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => adjustPurchasePrice(0.25)}
              className="flex h-[36px] w-[34px] items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-xl font-black text-emerald-700 transition shadow-xs hover:bg-emerald-100 active:scale-90"
              title="زيادة 0.25"
            >
              +
            </button>
          </div>
        </div>

        {/* سعر البيع للزبون */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] sm:text-[12px] font-black text-[#0A3D2E]">سعر البيع (للزبون)</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => adjustOrderSubtotal(-0.25)}
              className="flex h-[36px] w-[34px] items-center justify-center rounded-xl border border-rose-300 bg-rose-50 text-xl font-black text-rose-700 transition shadow-xs hover:bg-rose-100 active:scale-90"
              title="إنقاص 0.25"
            >
              -
            </button>
            <input
              name="orderSubtotal"
              value={orderSubtotal}
              onChange={(e) => onOrderSubtotalChange(e.target.value)}
              className="w-16 sm:w-20 h-[36px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-1 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums text-center focus:border-[#0A3D2E] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => adjustOrderSubtotal(0.25)}
              className="flex h-[36px] w-[34px] items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-xl font-black text-emerald-700 transition shadow-xs hover:bg-emerald-100 active:scale-90"
              title="زيادة 0.25"
            >
              +
            </button>
          </div>
        </div>

        {/* التوصيل */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] sm:text-[12px] font-black text-[#0A3D2E]">التوصيل</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const current = parseAlfInputToDinarOrZero(deliveryPrice);
                const next = Math.max(0, current - 1);
                onDeliveryChange(dinarDecimalToAlfInputString(next));
              }}
              className="flex h-[36px] w-[34px] items-center justify-center rounded-xl border border-rose-300 bg-rose-50 text-xl font-black text-rose-700 transition shadow-xs hover:bg-rose-100 active:scale-90"
              title="إنقاص 1 ألف"
            >
              -
            </button>
            <input
              name="deliveryPrice"
              value={deliveryPrice}
              onChange={(e) => onDeliveryChange(e.target.value)}
              className="w-14 sm:w-16 h-[36px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-1 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums text-center focus:border-[#0A3D2E] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const current = parseAlfInputToDinarOrZero(deliveryPrice);
                const next = current + 1;
                onDeliveryChange(dinarDecimalToAlfInputString(next));
              }}
              className="flex h-[36px] w-[34px] items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-xl font-black text-emerald-700 transition shadow-xs hover:bg-emerald-100 active:scale-90"
              title="زيادة 1 ألف"
            >
              +
            </button>
          </div>
        </div>

        {/* المجموع */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] sm:text-[12px] font-black text-[#0A3D2E]">المجموع</span>
          <input
            name="totalAmount"
            value={totalAmount}
            readOnly
            className="w-20 sm:w-24 h-[36px] rounded-xl border-[1.5px] border-[#C9A86A]/80 bg-[#FFF8E0] font-mono font-black tabular-nums text-center text-[#8B6A2A] text-xs sm:text-sm shadow-inner"
          />
        </div>
      </div>

      {/* زرا كل شي واصل وطلب عكسي جنب بعض */}
      <div className="grid grid-cols-2 gap-2">
        <label
          className={`min-h-[40px] px-3 py-1.5 rounded-[12px] border-[1.5px] flex items-center justify-center text-center cursor-pointer transition-all active:scale-95 select-none ${
            prepaidAllEnabled
              ? "bg-red-600 border-red-700 text-white font-black text-xs sm:text-sm shadow-sm"
              : "bg-[#FFFEF8] border-[#E8D5A3] text-slate-700 hover:border-[#C9A86A] hover:bg-[#FDF6E3] font-bold text-xs sm:text-sm"
          }`}
        >
          <input
            type="checkbox"
            name="prepaidAll"
            value="on"
            checked={prepaidAllEnabled}
            onChange={(e) => setPrepaidAllEnabled(e.target.checked)}
            className="sr-only"
          />
          <span>كل شي واصل</span>
        </label>

        <label
          className={`min-h-[40px] px-3 py-1.5 rounded-[12px] border-[1.5px] flex items-center justify-center text-center cursor-pointer transition-all active:scale-95 select-none ${
            reversePickupEnabled
              ? "bg-amber-600 border-amber-700 text-white font-black text-xs sm:text-sm shadow-sm"
              : "bg-[#FFFEF8] border-[#E8D5A3] text-slate-700 hover:border-[#C9A86A] hover:bg-[#FDF6E3] font-bold text-xs sm:text-sm"
          }`}
        >
          <input
            type="checkbox"
            name="reversePickup"
            value="on"
            checked={reversePickupEnabled}
            onChange={(e) => setReversePickupEnabled(e.target.checked)}
            className="sr-only"
          />
          <span>طلب عكسي</span>
        </label>
      </div>

      {/* خيارات حظر الزبون (عام وخاص بالمحل) بدون شرح تحتي */}
      <div className="grid grid-cols-2 gap-2">
        <label
          className={`min-h-[40px] px-2.5 py-1.5 rounded-[12px] border-[1.5px] flex items-center justify-center text-center cursor-pointer transition-all active:scale-95 select-none ${
            isBlocked
              ? "bg-red-600 border-red-700 text-white font-black text-xs sm:text-sm shadow-sm"
              : "bg-[#FFFEF8] border-[#E8D5A3] text-red-900 hover:border-red-400 hover:bg-red-50/40 font-bold text-xs sm:text-sm"
          }`}
        >
          <input
            type="checkbox"
            name="isBlocked"
            checked={isBlocked}
            onChange={(e) => setIsBlocked(e.target.checked)}
            className="sr-only"
          />
          <span>🛑 حظر عام (كل المحلات)</span>
        </label>

        <label
          className={`min-h-[40px] px-2.5 py-1.5 rounded-[12px] border-[1.5px] flex items-center justify-center text-center cursor-pointer transition-all active:scale-95 select-none ${
            isShopBlocked
              ? "bg-amber-600 border-amber-700 text-white font-black text-xs sm:text-sm shadow-sm"
              : "bg-[#FFFEF8] border-[#E8D5A3] text-amber-900 hover:border-amber-400 hover:bg-amber-50/40 font-bold text-xs sm:text-sm"
          }`}
        >
          <input
            type="checkbox"
            name="isShopBlocked"
            checked={isShopBlocked}
            onChange={(e) => setIsShopBlocked(e.target.checked)}
            className="sr-only"
          />
          <span>⚠️ حظر من (الإدارة) فقط</span>
        </label>
      </div>

      {/* منطقة الزبون ووقت الطلب جنباً إلى جنب */}
      <div className="grid grid-cols-2 gap-2 items-start">
        <div className="space-y-1">
          <label className="text-[12px] font-black text-[#0A3D2E] block">
            {routeMode === "double" ? "منطقة الزبون (1)" : "منطقة الزبون"}
          </label>
          <AdminRegionSearchPicker
            name="customerRegionId"
            regions={regions.map((r) => ({ id: r.id, name: r.name }))}
            value={customerRegionId}
            onValueChange={onCustomerRegionChange}
            allowEmpty
            placeholder="بحث عن منطقة…"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[12px] font-black text-[#0A3D2E] block">وقت الطلب</label>
          <input
            name="orderNoteTime"
            defaultValue={defaultOrderNoteTime}
            required
            className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10"
            placeholder="إجباري"
          />
        </div>
      </div>

      {/* رقم الزبون الأول والثاني جنباً إلى جنب */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[12px] font-black text-[#0A3D2E] block">
            {routeMode === "double" ? "رقم الزبون المرسل (الجهة الأولى)" : "رقم الزبون (الأول)"}
          </label>
          <div className="relative">
            <input
              name="customerPhone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(sanitizePhone(e.target.value))}
              onBlur={(e) => handlePhoneBlur(e.target.value, setCustomerPhone)}
              className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
              dir="ltr"
            />
            {firstPrefillLoading && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0A3D2E] border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[12px] font-black text-[#0A3D2E] block">
            {routeMode === "double" ? "رقم ثانٍ للمرسل (اختياري)" : "رقم الزبون (الثاني)"}
          </label>
          <input
            name="alternatePhone"
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(sanitizePhone(e.target.value))}
            onBlur={(e) => handlePhoneBlur(e.target.value, setAlternatePhone)}
            placeholder="إن وجد"
            className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
            dir="ltr"
          />
        </div>
      </div>

      {firstPrefill && (
        <div className="animate-in fade-in slide-in-from-top-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-emerald-900">بيانات محفوظة لهذا الرقم والمنطقة</span>
              <p className="text-[10px] text-emerald-700">
                {firstPrefill.source === "customer" ? "من سجلات زبائن المحل" : "من قاعدة بيانات الأرقام العامة"}
              </p>
            </div>
            <button
              type="button"
              onClick={applyFirstPrefill}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              تطبيق البيانات المحفوظة
            </button>
          </div>
        </div>
      )}

      {/* لوكيشن الزبون والنقطة الدالة */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-black text-[#0A3D2E]">
              {routeMode === "double" ? "موقع الزبون المرسل (رابط خرائط)" : "موقع الزبون (رابط خرائط)"}
            </span>
            <input
              name="customerLocationUrl"
              value={custLocationUrl}
              onChange={(e) => setCustLocationUrl(e.target.value)}
              className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs font-bold text-[#0A3D2E] font-mono focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10"
              placeholder="رابط اللوكيشن..."
              dir="ltr"
            />
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onReplaceCustomerLocationGps}
              disabled={locBusy || pending}
              className={`px-2.5 py-1 rounded-lg border text-xs font-black transition cursor-pointer ${
                confirmReplaceLoc
                  ? "bg-sky-600 text-white border-sky-700 animate-pulse"
                  : "bg-sky-50 text-sky-900 border-sky-300 hover:bg-sky-100"
              }`}
            >
              {confirmReplaceLoc ? "تأكيد أخذ الموقع؟" : "أخذ موقعي الحالي"}
            </button>
            {confirmReplaceLoc && (
              <button
                type="button"
                onClick={() => setConfirmReplaceLoc(false)}
                className="text-[10px] font-bold text-sky-600 underline cursor-pointer"
              >
                إلغاء
              </button>
            )}

            <button
              type="button"
              onClick={onClearCustomerLocation}
              disabled={locBusy || pending || !custLocationUrl.trim()}
              className={`px-2.5 py-1 rounded-lg border text-xs font-black transition cursor-pointer ${
                confirmClearLoc
                  ? "bg-rose-600 text-white border-rose-700 animate-pulse"
                  : "bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100 disabled:opacity-50"
              }`}
            >
              {confirmClearLoc ? "تأكيد المسح؟" : "مسح اللوكيشن"}
            </button>
            {confirmClearLoc && (
              <button
                type="button"
                onClick={() => setConfirmClearLoc(false)}
                className="text-[10px] font-bold text-rose-600 underline cursor-pointer"
              >
                إلغاء
              </button>
            )}
          </div>
          <ImageUploaderCaption name={defaultCustomerLocationUploadedByName} />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[12px] font-black text-[#0A3D2E]">
            {routeMode === "double" ? "نقطة دالة للزبون المرسل" : "أقرب نقطة دالة"}
          </span>
          <input
            name="customerLandmark"
            value={custLandmark}
            onChange={(e) => setCustLandmark(e.target.value)}
            className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10"
            placeholder="أقرب نقطة دالة..."
          />
        </label>
      </div>

      {/* صورة باب الزبون */}
      <div className="rounded-xl border border-[#C9A86A]/40 bg-[#FDF6E3]/30 p-3 sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-black text-[#0A3D2E]">
            {routeMode === "double" ? "صورة باب الزبون المرسل (الجهة الأولى)" : "صورة باب الزبون (المستلم/الوجهة الأولى)"}
          </span>
          <CustomerDoorPhotoQuick orderId={orderId} hasImage={!!defaultCustomerDoorPhotoUrl} />
        </div>
        {customerDoorSrc ? (
          <div className="mt-2.5">
            <a href={customerDoorSrc} target="_blank" rel="noopener noreferrer" className="block">
              <div className="aspect-square max-w-[140px] overflow-hidden rounded-lg border border-[#C9A86A]/40 bg-white shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={customerDoorSrc} alt="صورة باب الزبون" className="h-full w-full object-cover" />
              </div>
            </a>
            <ImageUploaderCaption name={defaultCustomerDoorPhotoUploadedByName} />
          </div>
        ) : null}
      </div>

      {/* في حالة المسار المزدوج */}
      {routeMode === "double" && (
        <div className="space-y-4 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/20 p-3 sm:p-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-sky-100 pb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">2</div>
            <h2 className="text-xs sm:text-sm font-black text-sky-900">بيانات الوجهة الثانية (المستلم الثاني)</h2>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-black text-[#0A3D2E] block">منطقة الوجهة الثانية</label>
            <AdminRegionSearchPicker
              name="secondCustomerRegionId"
              regions={regions.map((r) => ({ id: r.id, name: r.name }))}
              value={secondCustomerRegionId}
              onValueChange={setSecondCustomerRegionId}
              allowEmpty
              placeholder="اكتب جزءاً من اسم المنطقة للبحث…"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[12px] font-black text-[#0A3D2E] block">رقم المستلم الثاني</span>
              <div className="relative">
                <input
                  name="secondCustomerPhone"
                  value={secondCustomerPhone}
                  onChange={(e) => setSecondCustomerPhone(sanitizePhone(e.target.value))}
                  onBlur={(e) => handlePhoneBlur(e.target.value, setSecondCustomerPhone)}
                  className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums focus:border-[#0A3D2E] focus:outline-none"
                  dir="ltr"
                />
                {secondPrefillLoading && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0A3D2E] border-t-transparent"></div>
                  </div>
                )}
              </div>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[12px] font-black text-[#0A3D2E] block">رقم ثانٍ للمستلم</span>
              <input
                name="secondCustomerAlternatePhone"
                value={secondAlternatePhone}
                onChange={(e) => setSecondAlternatePhone(sanitizePhone(e.target.value))}
                onBlur={(e) => handlePhoneBlur(e.target.value, setSecondAlternatePhone)}
                placeholder="إن وجد"
                className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] font-mono tabular-nums focus:border-[#0A3D2E] focus:outline-none"
                dir="ltr"
              />
            </label>
          </div>

          {secondPrefill && (
            <div className="animate-in fade-in slide-in-from-top-2 rounded-xl border border-sky-200 bg-sky-50 p-3 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-sky-900">بيانات محفوظة للوجهة الثانية</span>
                  <p className="text-[10px] text-sky-700">
                    {secondPrefill.source === "customer" ? "من سجلات زبائن المحل" : "من قاعدة بيانات الأرقام العامة"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={applySecondPrefill}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition-colors cursor-pointer"
                >
                  تطبيق البيانات المحفوظة
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[12px] font-black text-[#0A3D2E] block">موقع الوجهة الثانية (رابط)</span>
              <input
                name="secondCustomerLocationUrl"
                value={secondCustLocationUrl}
                onChange={(e) => setSecondCustLocationUrl(e.target.value)}
                className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs font-bold text-[#0A3D2E] font-mono focus:border-[#0A3D2E] focus:outline-none"
                dir="ltr"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[12px] font-black text-[#0A3D2E] block">نقطة دالة للوجهة الثانية</span>
              <input
                name="secondCustomerLandmark"
                value={secondCustLandmark}
                onChange={(e) => setSecondCustLandmark(e.target.value)}
                className="w-full h-[38px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white px-3 text-xs sm:text-sm font-black text-[#0A3D2E] focus:border-[#0A3D2E] focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 sm:p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-black text-[#0A3D2E]">صورة باب الوجهة الثانية</span>
              <CustomerDoorPhotoQuick orderId={orderId} hasImage={!!defaultSecondCustomerDoorPhotoUrl} isSecondCustomer />
            </div>
            {secondCustomerDoorSrc ? (
              <div className="mt-2.5">
                <a href={secondCustomerDoorSrc} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="aspect-square max-w-[140px] overflow-hidden rounded-lg border border-sky-200 bg-white shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={secondCustomerDoorSrc} alt="صورة باب الوجهة الثانية" className="h-full w-full object-cover" />
                  </div>
                </a>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ملاحظة مُدخل الطلب */}
      <label className="flex flex-col gap-1 text-sm">
        <span className={summaryText.trim() ? "text-[12px] font-black text-rose-800" : "text-[12px] font-black text-[#0A3D2E]"}>
          ملاحظة مُدخل الطلب
        </span>
        <textarea
          ref={summaryTextareaRef}
          name="summary"
          value={summaryText}
          onChange={(e) => setSummaryText(e.target.value)}
          placeholder="ملاحظات وتفاصيل المنتجات المكتوبة..."
          className={
            summaryText.trim()
              ? "w-full min-h-[90px] rounded-xl border-[1.5px] border-rose-400 bg-rose-50/80 p-3 text-xs sm:text-sm font-bold text-rose-950 ring-2 ring-rose-200 focus:border-rose-500 focus:outline-none transition-[height] duration-150 resize-y overflow-y-auto"
              : "w-full min-h-[90px] rounded-xl border-[1.5px] border-[#C9A86A]/60 bg-white p-3 text-xs sm:text-sm font-bold text-[#0A3D2E] focus:border-[#0A3D2E] focus:outline-none focus:ring-2 focus:ring-[#0A3D2E]/10 transition-[height] duration-150 resize-y overflow-y-auto"
          }
        />
      </label>

      {/* صورة الطلب */}
      <div className="rounded-xl border border-[#C9A86A]/40 bg-[#FDF6E3]/30 p-3 sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-black text-[#0A3D2E]">صورة الطلب</span>
          <div className="flex flex-wrap gap-1.5">
            <input
              ref={orderImgRef}
              name="orderImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) formRef.current?.requestSubmit();
              }}
            />
            <button
              type="button"
              disabled={pending}
              className="rounded-xl border border-[#C9A86A] bg-white px-3 py-1 text-xs font-black text-[#0A3D2E] hover:bg-[#FDF6E3] transition cursor-pointer shadow-xs disabled:opacity-60"
              onClick={() => {
                const el = orderImgRef.current;
                if (!el) return;
                el.setAttribute("capture", "environment");
                el.click();
              }}
            >
              {pending ? "جارٍ الرفع..." : "📷 كاميرا"}
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-xl border border-[#C9A86A] bg-white px-3 py-1 text-xs font-black text-[#0A3D2E] hover:bg-[#FDF6E3] transition cursor-pointer shadow-xs disabled:opacity-60"
              onClick={() => {
                const el = orderImgRef.current;
                if (!el) return;
                el.removeAttribute("capture");
                el.click();
              }}
            >
              {pending ? "جارٍ الرفع..." : "🖼️ معرض"}
            </button>
          </div>
        </div>
        {imgSrc ? (
          <div className="mt-2.5">
            <div className="aspect-square max-w-[160px] overflow-hidden rounded-lg border border-[#C9A86A]/40 bg-white shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt="صورة الطلب"
                className="h-full w-full object-contain"
              />
            </div>
            <ImageUploaderCaption name={defaultOrderImageUploadedByName} />
          </div>
        ) : null}
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-xs sm:text-sm font-black text-rose-900" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.pendingCustomerImport ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs sm:text-sm font-bold text-amber-950">
          يوجد طلب تأكيد أدناه — اختر أحد الخيارات لإكمال الحفظ.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !!state.pendingCustomerImport}
        className="w-full h-[46px] rounded-xl bg-gradient-to-r from-[#0F4D3A] via-[#0A3D2E] to-[#06281D] text-[#F5D77F] border border-[#C9A86A] font-black text-base shadow-lg hover:brightness-110 active:scale-[0.98] transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
      >
        <span>✏️</span>
        <span>
          {pending
            ? "جارٍ التحديث…"
            : state.pendingCustomerImport
              ? "أكمل من النافذة أعلاه"
              : "تحديث"}
        </span>
      </button>
    </form>
    </div>

    {state.pendingCustomerImport ? (
      <div
        className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-import-dialog-title"
      >
        <div className="max-h-[min(90vh,520px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-sky-200 bg-white p-5 shadow-2xl">
          <h2
            id="customer-import-dialog-title"
            className="text-lg font-bold text-slate-900"
          >
            تفاصيل مسجّلة لهذا الرقم والمنطقة
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            يوجد في <strong>سجلات الزبائن</strong> لهذا المحل ملف لنفس رقم الزبون بعد التغيير و<strong>لنفس منطقة الزبون</strong>{" "}
            المختارة في الطلب
            {state.pendingCustomerImport.regionName ? (
              <>
                {" "}
                (<span className="font-semibold">{state.pendingCustomerImport.regionName}</span>)
              </>
            ) : null}
            . هل تريد جلب اللوكيشن والنقطة الدالة
            {state.pendingCustomerImport.hasDoorPhoto ? " وصورة باب الزبون إن وُجدت" : ""} من هذا السجل
            وربط الطلب بهذا الزبون؟
          </p>
          <ul className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
            {state.pendingCustomerImport.alternatePhone?.trim() ? (
              <li className="break-all">
                <span className="font-bold text-slate-700">رقم ثانٍ: </span>
                <span className="font-mono tabular-nums">
                  {state.pendingCustomerImport.alternatePhone.trim()}
                </span>
              </li>
            ) : null}
            {state.pendingCustomerImport.locationUrl?.trim() ? (
              <li className="break-all">
                <span className="font-bold text-slate-700">لوكيشن: </span>
                {state.pendingCustomerImport.locationUrl}
              </li>
            ) : null}
            {state.pendingCustomerImport.landmark?.trim() ? (
              <li className="break-words">
                <span className="font-bold text-slate-700">نقطة دالة: </span>
                {state.pendingCustomerImport.landmark}
              </li>
            ) : null}
            {state.pendingCustomerImport.hasDoorPhoto ? (
              <li className="font-bold text-emerald-800">صورة باب الزبون: متوفرة في السجل</li>
            ) : null}
          </ul>
          {state.pendingCustomerImport.doorPhotoUrl?.trim() ? (
            <a
              href={state.pendingCustomerImport.doorPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.pendingCustomerImport.doorPhotoUrl}
                alt="صورة باب الزبون من السجل"
                className="h-28 w-28 rounded-lg border border-emerald-200 object-cover"
              />
            </a>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            «نعم» تستبدل حقول الموقع في الطلب بما في السجل وتربط الطلب بهذا الزبون. «لا» يحفظ الطلب بالقيم
            المدخلة حالياً دون هذا الدمج.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              disabled={pending}
              onClick={() =>
                submitCustomerImportChoice("decline", state.pendingCustomerImport!)
              }
            >
              لا، احفظ بدون جلب من السجل
            </button>
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={pending}
              onClick={() =>
                submitCustomerImportChoice("confirm", state.pendingCustomerImport!)
              }
            >
              {pending ? "جارٍ الحفظ…" : "نعم، أضف التفاصيل واربط بالزبون"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
