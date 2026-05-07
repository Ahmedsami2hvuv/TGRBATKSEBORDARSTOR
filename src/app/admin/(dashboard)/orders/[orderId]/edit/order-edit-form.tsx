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
import { AdminOrderFloatingBar } from "./admin-order-floating-bar";
import { isReversePickupOrderType } from "@/lib/order-type-flags";

const STATUS_OPTIONS = [
  { value: "pending", label: "قيد الانتظار (جديد)" },
  { value: "assigned", label: "مسند للمندوب" },
  { value: "delivering", label: "قيد التوصيل" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "ملغى" },
  { value: "archived", label: "مؤرشف" },
];

const initial: OrderEditState = {};

type ShopOpt = { id: string; name: string; regionDeliveryPrice: string };
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

export function OrderEditForm({
  orderId,
  orderNumber,
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
  defaultImageUrl,
  defaultOrderImageUploadedByName,
  defaultCustomerDoorPhotoUrl,
  defaultCustomerDoorPhotoUploadedByName,
  defaultCustomerLocationUploadedByName,
  defaultVoiceNoteUrl,
  defaultAdminVoiceNoteUrl,
  defaultOrderSubtotal,
  defaultDeliveryPrice,
  defaultTotalAmount,
  defaultOrderNoteTime,
  defaultAssignedCourierId,
  defaultPrepaidAll,
  shops,
  regions,
  couriers,
}: {
  orderId: string;
  orderNumber: number;
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
  defaultImageUrl: string | null;
  defaultOrderImageUploadedByName: string | null;
  defaultCustomerDoorPhotoUrl: string | null;
  defaultCustomerDoorPhotoUploadedByName: string | null;
  defaultCustomerLocationUploadedByName?: string | null;
  defaultVoiceNoteUrl: string | null;
  defaultAdminVoiceNoteUrl: string | null;
  defaultOrderSubtotal: string;
  defaultDeliveryPrice: string;
  defaultTotalAmount: string;
  defaultOrderNoteTime: string;
  defaultAssignedCourierId: string;
  defaultPrepaidAll: boolean;
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
  const [locBusy, setLocBusy] = useState(false);
  const [confirmClearLoc, setConfirmClearLoc] = useState(false);
  const [confirmReplaceLoc, setConfirmReplaceLoc] = useState(false);
  const router = useRouter();
  const [orderSubtotal, setOrderSubtotal] = useState(defaultOrderSubtotal);
  const [deliveryPrice, setDeliveryPrice] = useState(defaultDeliveryPrice);
  const [totalAmount, setTotalAmount] = useState(defaultTotalAmount);
  const [summaryText, setSummaryText] = useState(defaultSummary);
  const [prepaidAllEnabled, setPrepaidAllEnabled] = useState(defaultPrepaidAll);
  const [reversePickupEnabled, setReversePickupEnabled] = useState(isReversePickupOrderType(defaultOrderType));
  const formRef = useRef<HTMLFormElement>(null);
  const orderImgRef = useRef<HTMLInputElement>(null);

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

  const courierRadioOptions = useMemo(
    () => [
      { value: "", label: "بدون إسناد" },
      ...couriers.map((c) => ({ value: c.id, label: c.name })),
    ],
    [couriers],
  );

  const imgSrc = resolvePublicAssetSrc(defaultImageUrl);
  const customerDoorSrc = resolvePublicAssetSrc(defaultCustomerDoorPhotoUrl);
  const voiceSrc = resolvePublicAssetSrc(defaultVoiceNoteUrl);

  return (
    <>
    <div
      className={`relative pb-24 ${
        prepaidAllEnabled || reversePickupEnabled
          ? "rounded-2xl border-2 border-red-300/85 bg-gradient-to-b from-red-50/90 to-red-50/35 p-4 shadow-inner shadow-red-100/40 sm:p-5"
          : ""
      } ${!custLocationUrl.trim() && !prepaidAllEnabled ? "rounded-xl ring-2 ring-rose-300 ring-offset-2 ring-offset-white" : ""}`}
    >
    <form
      id="admin-order-edit-form"
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4"
    >
      <p className={`text-sm ${ad.muted}`}>
        رقم الطلب الظاهر:{" "}
        <strong className="text-sky-800 tabular-nums">#{orderNumber}</strong>
        <span className="mx-2 text-slate-500">|</span>
        <span className="text-slate-600">
          معرّف النظام (للإدارة):{" "}
          <code
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800"
            dir="ltr"
          >
            {orderId}
          </code>
        </span>
      </p>

      {!custLocationUrl.trim() ? (
        <div
          className="rounded-xl border-2 border-rose-400 bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-900"
          role="status"
        >
          لا يوجد رابط لوكيشن للزبون — أضف الرابط في الحقل أدناه أو عيّنه عند الإسناد.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/shops/${shopId}/edit`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
        >
          تعديل بيانات المحل
        </Link>
        <span className="text-sm text-slate-500">هذه الصفحة: تعديل الطلب</span>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
        <span className={ad.label}>بصمة مُدخل الطلب</span>
        <p className={`mt-1 text-xs ${ad.muted}`}>
          ما سجّله موظف المحل (أو مُدخل الطلب) أثناء الإنشاء. يمكن للمندوب الاستماع من صفحة الطلب.
        </p>
        {voiceSrc ? (
          <div className="mt-3 space-y-2">
            <VoiceNoteAudio
              src={voiceSrc}
              streamKey={`${orderId}-submitter-voice`}
              className="w-full max-w-md rounded-lg"
            />
            <DeleteVoiceNoteButton orderId={orderId} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">لا يوجد تسجيل صوتي لهذا الطلب.</p>
        )}
      </div>

      <AdminVoiceNoteSection
        orderId={orderId}
        defaultAdminVoiceNoteUrl={defaultAdminVoiceNoteUrl}
      />

      <OrderStatusRadioGroup
        name="assignedCourierId"
        defaultValue={defaultAssignedCourierId}
        options={courierRadioOptions}
        legend="المندوب"
        legendClassName={ad.label}
      />

      <div className="space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>المحل</span>
          <select
            name="shopId"
            required
            value={shopId}
            onChange={(e) => onShopChange(e.target.value)}
            className={ad.select}
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <OrderStatusRadioGroup
          name="status"
          defaultValue={defaultStatus}
          options={STATUS_OPTIONS}
          legend="حالة الطلبية"
          legendClassName={ad.label}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className={ad.label}>عميل المحل (موظف رفع الطلب)</span>
        <select
          name="submittedByEmployeeId"
          value={submittedByEmployeeId}
          onChange={(e) => setSubmittedByEmployeeId(e.target.value)}
          className={ad.select}
        >
          <option value="">— بدون ربط بموظف محدد (من رفع الطلب من داخل المحل) —</option>
          {employeesForShop.map((e) => (
            <option key={e.id} value={e.id}>
              {(e.name || "").trim() ? e.name.trim() : "موظف بدون اسم"}
            </option>
          ))}
        </select>
        <span className={`text-xs ${ad.muted}`}>
          يحدّد من داخل المحل المختار رفع هذا الطلب إلى النظام. منفصل عن «زبون التوصيل» (المستلم) أدناه.
          عند اختيار موظف يُلغى ارتباط «مُدخل شركة التجهيز» إن وُجد لأن المصدر يصبح موظف المحل.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className={ad.label}>ربط الطلب بزبون التوصيل من سجلات هذا المحل</span>
        <select
          name="customerId"
          value={customerId}
          onChange={(e) => onCustomerPick(e.target.value)}
          className={ad.select}
        >
          <option value="">— اختر زبون توصيل مسجّلاً لهذا المحل (أو اتركه بدون ربط) —</option>
          {customersForShop.map((c) => (
            <option key={c.id} value={c.id}>
              {(c.name || "").trim() ? c.name.trim() : "زبون بدون اسم"}
            </option>
          ))}
        </select>
        <span className={`text-xs ${ad.muted}`}>
          زبون التوصيل هو مستلم الشحنة (هاتف ومنطقة وموقع). بعد اختيار المحل تظهر أسماء الزبائن المسجّلين
          لذلك المحل فقط. عند اختيار سجل، يُعبَّى رقمه ومنطقته وموقعه تلقائياً — هذا ليس موظف المحل.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className={ad.label}>نوع الطلب</span>
        <input
          name="orderType"
          defaultValue={defaultOrderType}
          className={ad.input}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>سعر الطلب  (بدون التوصيل)</span>
          <input
            name="orderSubtotal"
            value={orderSubtotal}
            onChange={(e) => onOrderSubtotalChange(e.target.value)}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>التوصيل </span>
          <input
            name="deliveryPrice"
            value={deliveryPrice}
            onChange={(e) => onDeliveryChange(e.target.value)}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>المجموع </span>
          <input
            name="totalAmount"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className={ad.input}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm text-slate-800 ${
            prepaidAllEnabled
              ? "border-red-400 bg-red-50/90"
              : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <input
            type="checkbox"
            name="prepaidAll"
            value="on"
            checked={prepaidAllEnabled}
            onChange={(e) => setPrepaidAllEnabled(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 rounded border-red-400 accent-red-600"
          />
          <span>
            <span className={`font-bold ${prepaidAllEnabled ? "text-red-950" : "text-slate-900"}`}>
              كل شي واصل
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-700">
              المندوب لا يستلم نقداً من الزبون (دفع مسبق).
            </span>
          </span>
        </label>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm text-slate-800 ${
            reversePickupEnabled
              ? "border-amber-400 bg-amber-50/90"
              : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <input
            type="checkbox"
            name="reversePickup"
            value="on"
            checked={reversePickupEnabled}
            onChange={(e) => setReversePickupEnabled(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 rounded border-amber-400 accent-amber-600"
          />
          <span>
            <span className={`font-bold ${reversePickupEnabled ? "text-amber-950" : "text-slate-900"}`}>
              طلب عكسي
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-700">
              استلام من الزبون وتسليم للعميل.
            </span>
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className={ad.label}>وقت الطلب</span>
        <input
          name="orderNoteTime"
          defaultValue={defaultOrderNoteTime}
          required
          className={ad.input}
          placeholder="إجباري"
        />
      </label>

      <div className="space-y-1.5">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>منطقة الزبون</span>
          <AdminRegionSearchPicker
            name="customerRegionId"
            regions={regions.map((r) => ({ id: r.id, name: r.name }))}
            value={customerRegionId}
            onValueChange={onCustomerRegionChange}
            allowEmpty
            placeholder="اكتب جزءاً من اسم المنطقة للبحث…"
          />
        </label>
        <p className={`text-xs leading-relaxed ${ad.muted}`}>
          يُحسب أجر التوصيل كأعلى قيمة بين أجر توصيل منطقة المحل ومنطقة الزبون.
          {selectedRegionName ? (
            <>
              {" "}
              المنطقة الحالية: <strong className="text-slate-900">{selectedRegionName}</strong>.
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>رقم الزبون (الأول)</span>
          <input
            name="customerPhone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className={ad.input}
            dir="ltr"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>رقم الزبون (الثاني)</span>
          <input
            name="alternatePhone"
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(e.target.value)}
            className={ad.input}
            dir="ltr"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm">
          <label className="flex flex-col gap-1">
            <span className={ad.label}>موقع الزبون (رابط خرائط) — اختياري</span>
            <input
              name="customerLocationUrl"
              value={custLocationUrl}
              onChange={(e) => setCustLocationUrl(e.target.value)}
              className={ad.input}
              dir="ltr"
            />
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onClearCustomerLocation}
                disabled={locBusy || pending || !custLocationUrl.trim()}
                className={`${ad.btnDanger} ${confirmClearLoc ? "animate-pulse ring-2 ring-rose-600" : ""}`}
              >
                {confirmClearLoc ? "تأكيد المسح؟" : "مسح اللوكيشن"}
              </button>
              {confirmClearLoc && (
                <button
                  type="button"
                  onClick={() => setConfirmClearLoc(false)}
                  className="text-[10px] font-bold text-rose-600 underline"
                >
                  إلغاء
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onReplaceCustomerLocationGps}
                disabled={locBusy || pending}
                className={`rounded-xl border-2 px-3 py-1.5 text-sm font-bold text-white shadow-md ring-2 ring-white/30 transition disabled:opacity-50 ${
                  confirmReplaceLoc
                    ? "animate-pulse border-orange-600 bg-orange-600"
                    : "border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                }`}
              >
                {locBusy
                  ? "جارٍ التحديث…"
                  : confirmReplaceLoc
                    ? "تأكيد التبديل؟"
                    : "تبديل الموقع (GPS)"}
              </button>
              {confirmReplaceLoc && (
                <button
                  type="button"
                  onClick={() => setConfirmReplaceLoc(false)}
                  className="text-[10px] font-bold text-orange-700 underline"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>
          <ImageUploaderCaption name={defaultCustomerLocationUploadedByName} />
          <p className={`text-xs ${ad.muted}`}>
            يطلب مسح أو استبدال الموقع تأكيداً قبل التنفيذ. الاستبدال يستخدم موقعك الحالي من المتصفح.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>أقرب نقطة دالة — اختياري</span>
          <input
            name="customerLandmark"
            value={custLandmark}
            onChange={(e) => setCustLandmark(e.target.value)}
            className={ad.input}
          />
        </label>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={ad.label}>صورة باب الزبون</span>
          <CustomerDoorPhotoQuick orderId={orderId} hasImage={!!defaultCustomerDoorPhotoUrl} />
        </div>
        {customerDoorSrc ? (
          <div className="mt-3">
            <a href={customerDoorSrc} target="_blank" rel="noopener noreferrer" className="block">
              <div className="aspect-square max-w-xs overflow-hidden rounded-lg border border-sky-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={customerDoorSrc} alt="صورة باب الزبون" className="h-full w-full object-cover" />
              </div>
            </a>
            <ImageUploaderCaption name={defaultCustomerDoorPhotoUploadedByName} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">لا توجد صورة باب زبون مرفوعة حالياً.</p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className={summaryText.trim() ? "text-sm font-bold text-rose-800" : ad.label}>
          ملاحظة مُدخل الطلب
        </span>
        <span className={`text-xs ${ad.muted}`}>
          ما كتبه موظف المحل أو مُدخل الطلب في خانة الملاحظات؛ تبقى فارغة إن لم يُكتب.
        </span>
        <textarea
          name="summary"
          rows={5}
          value={summaryText}
          onChange={(e) => setSummaryText(e.target.value)}
          className={
            summaryText.trim()
              ? `${ad.input} border-rose-400 bg-rose-50/90 ring-2 ring-rose-200 focus:border-rose-500 focus:ring-rose-300`
              : ad.input
          }
        />
      </label>

      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={ad.label}>صورة الطلب</span>
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
              className="rounded-lg border border-sky-400 bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-200 disabled:opacity-60"
              onClick={() => {
                const el = orderImgRef.current;
                if (!el) return;
                el.setAttribute("capture", "environment");
                el.click();
              }}
            >
              {pending ? "جارٍ الرفع..." : "كاميرا"}
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              onClick={() => {
                const el = orderImgRef.current;
                if (!el) return;
                el.removeAttribute("capture");
                el.click();
              }}
            >
              {pending ? "جارٍ الرفع..." : "معرض"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          JPG أو PNG أو Webp — حتى 10 ميجابايت. عند اختيار صورة يُحفظ الطلب تلقائياً.
        </p>
        {imgSrc ? (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-600">الصورة الحالية:</p>
            <div className="mt-2 aspect-square max-w-sm overflow-hidden rounded-lg border border-sky-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt="صورة الطلب"
                className="h-full w-full object-contain"
              />
            </div>
            <ImageUploaderCaption name={defaultOrderImageUploadedByName} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">لا توجد صورة مرفوعة لهذا الطلب.</p>
        )}
      </div>

      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}

      {state.pendingCustomerImport ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">
          يوجد طلب تأكيد أدناه — اختر أحد الخيارات لإكمال الحفظ.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !!state.pendingCustomerImport}
        className={ad.btnPrimary}
      >
        {pending
          ? "جارٍ التحديث…"
          : state.pendingCustomerImport
            ? "أكمل من النافذة أعلاه"
            : "تحديث"}
      </button>
    </form>
    </div>

    <AdminOrderFloatingBar
      pending={pending}
      hasCustomerImportChoice={!!state.pendingCustomerImport}
    />

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
          {state.pendingCustomerImport.customerName ? (
            <p className="mt-2 text-xs text-slate-600">
              الاسم في السجل:{" "}
              <span className="font-semibold">{state.pendingCustomerImport.customerName}</span>
            </p>
          ) : null}
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
