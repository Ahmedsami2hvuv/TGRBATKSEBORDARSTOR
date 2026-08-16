"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { resolvePublicImageSrc } from "@/lib/image-url";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { ClientVoiceNoteField } from "./client-voice-note-field";
import "leaflet/dist/leaflet.css";
import { submitOrder, updateCustomerUiMode, sendNoCarsAlertTelegram, type ClientOrderState } from "./actions";
import { clientOrderAccountPath } from "@/lib/client-order-portal-nav";
import { withoutReversePickupPrefix, isReversePickupOrderType } from "@/lib/order-type-flags";
import { whatsappMeUrl } from "@/lib/whatsapp";

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

const inputErrorClass = "border-rose-500 ring-2 ring-rose-200 focus:border-rose-600 focus:ring-rose-300";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initial: ClientOrderState = {};
const OWNER_WHATSAPP_PHONE = "+9647733921468";

function sanitizePhone(value: string): string {
  const arabicDigits = /[٠١٢٣٤٥٦٧٨٩]/g;
  const persianDigits = /[۰۱۲۳۴۵۶۷٨٩]/g;
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


function buildCustomerCheckoutMessage(productsText: string): string {
  const productLines = productsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const orderedProducts =
    productLines.length > 0
      ? productLines.map((line, index) => `${index + 1}- ${line}`).join("\n")
      : "1- (لم يتم إدخال تفاصيل المنتجات)";
  return [
    "مرحبا لقد طلبت من خصيب ستور",
    "منتجاتي هي",
    orderedProducts,
    "",
    "ارجو تجهيز الطلب",
    "شكرا لكم",
  ].join("\n");
}

type PropsInner = {
  e: string;
  exp: string;
  sig: string;
  shopName: string;
  employeeName: string;
  photoUrl: string | null;
  shopRegionName: string;
  shopDeliveryAlf: number;
  viewerName: string;
  botUsername?: string;
  portalUrl?: string;
  botStartParam?: string;
  shopId: string;
  noCarsMode?: string;
  employeePhone?: string;
  initialOrder: {
    orderNumber: number;
    customerPhone: string;
    customerName: string;
    orderType: string;
    orderSubtotal: string;
    alternatePhone: string;
    orderTime: string;
    notes: string;
    customerLocationUrl: string;
    customerLandmark: string;
    prepaidAll: boolean;
    customerRegion: { id: string; name: string; deliveryPrice: string };
  } | null;
  onResetForNewOrder?: () => void;
  initialUiMode?: string;
};

export function ClientOrderForm(props: PropsInner) {
  return <ClientOrderFormInner {...props} />;
}

function ClientOrderFormInner({
  e,
  exp,
  sig,
  shopName,
  employeeName,
  photoUrl,
  shopRegionName,
  shopDeliveryAlf,
  viewerName,
  botUsername,
  portalUrl,
  botStartParam,
  shopId,
  noCarsMode = "off",
  employeePhone = "",
  initialOrder,
  onResetForNewOrder,
  initialUiMode = "learn",
}: PropsInner) {
  const [state, formAction, pending] = useActionState(submitOrder, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const [uiMode, setUiMode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kse_ui_mode") || initialUiMode;
    }
    return initialUiMode;
  });

  const [learnStep, setLearnStep] = useState(0);

  const [waRedirectEnabled, setWaRedirectEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("kse_wa_redirect_enabled");
      return stored !== "false";
    }
    return true;
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("kse_wa_redirect_enabled", String(waRedirectEnabled));
  }, [waRedirectEnabled]);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const handleUiModeChange = async (mode: string) => {
    setUiMode(mode);
    if (mode === "learn") setLearnStep(0);
    localStorage.setItem("kse_ui_mode", mode);

    if (customerPhone.trim()) {
      const fd = new FormData();
      fd.append("phone", customerPhone);
      fd.append("shopId", shopId);
      fd.append("uiMode", mode);
      await updateCustomerUiMode(fd);
    }
  };

  useEffect(() => {
    localStorage.setItem("kse_ui_mode", uiMode);
  }, [uiMode]);

  const orderTypeRef = useRef<HTMLInputElement>(null);
  const orderPriceRef = useRef<HTMLInputElement>(null);
  const customerPhoneRef = useRef<HTMLInputElement>(null);
  const orderTimeRef = useRef<HTMLInputElement>(null);
  const regionSearchRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState(initialOrder?.customerRegion.name ?? "");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(initialOrder?.customerRegion ?? null);
  const latestRegionSearchRequestIdRef = useRef(0);

  const [orderPrice, setOrderPrice] = useState(initialOrder?.orderSubtotal ?? "");
  const [orderType, setOrderType] = useState(
    initialOrder ? withoutReversePickupPrefix(initialOrder.orderType) : ""
  );
  const [customerPhone, setCustomerPhone] = useState(initialOrder?.customerPhone ?? "");
  const [isPrepaidAll, setIsPrepaidAll] = useState(initialOrder?.prepaidAll ?? false);
  const [isReverse, setIsReverse] = useState(
    initialOrder ? isReversePickupOrderType(initialOrder.orderType) : false
  );
  const [customerName] = useState(initialOrder?.customerName || "");
  const greetingName = viewerName || employeeName || "العميل";
  const [alternatePhone, setAlternatePhone] = useState(initialOrder?.alternatePhone ?? "");
  const [orderTime, setOrderTime] = useState(initialOrder?.orderTime ?? "");
  const [notes, setNotes] = useState(initialOrder?.notes ?? "");
  const [vehiclePreference, setVehiclePreference] = useState("");
  const [deliveryPriceOverride, setDeliveryPriceOverride] = useState<string>("");

  const [showNoPriceConfirm, setShowNoPriceConfirm] = useState(false);
  const [allowNoPriceSubmit, setAllowNoPriceSubmit] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [blockedPhone, setBlockedPhone] = useState<string | null>(null);

  // قراءة الهاتف والاسم من التخزين المحلي في البداية لتسهيل ملء البيانات
  useEffect(() => {
    if (typeof window !== "undefined" && !customerPhone) {
      const storedPhone = localStorage.getItem("kse_customer_phone");
      if (storedPhone) setCustomerPhone(storedPhone);
    }
  }, [customerPhone]);

  // حالة التحكم في الـ Modal لتنبيه عدم وجود سيارات
  const [showCarAlert, setShowCarAlert] = useState(() => {
    // تفعيل التنبيه إذا كانت وضعية السيارات مفعلة وليست off
    return noCarsMode !== "off";
  });
  const [alertSending, setAlertSending] = useState(false);

  const [previousRegions, setPreviousRegions] = useState<RegionHit[]>([]);
  const [isOldCustomer, setIsOldCustomer] = useState(false);

  useEffect(() => {
    if (!customerPhone || customerPhone.length < 10) {
      setPreviousRegions([]);
      setIsOldCustomer(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/customers/regions-by-phone?phone=${encodeURIComponent(customerPhone)}`)
        .then(res => res.json())
        .then(data => {
          if (data.regions && data.regions.length > 0) {
            setPreviousRegions(data.regions);
            setIsOldCustomer(true);
          } else {
            setPreviousRegions([]);
            setIsOldCustomer(false);
          }
        })
        .catch(err => {
          console.error("Failed to fetch previous regions", err);
          setPreviousRegions([]);
          setIsOldCustomer(false);
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [customerPhone]);

  const handleCarAlertYes = () => {
    setShowCarAlert(false);
  };

  const handleCarAlertNo = async () => {
    // نستخدم هاتف الموظف المفتوح حسابه كخيار أول، أو هاتف الزبون المدخل كخيار ثانٍ
    const activePhone = employeePhone.trim() || customerPhone.trim() || "07700000000";
    const activeName = employeeName.trim() || "موظف المحل";

    setAlertSending(true);
    try {
      const fd = new FormData();
      fd.append("customerPhone", activePhone);
      fd.append("customerName", activeName);
      fd.append("shopName", shopName);
      fd.append("noCarsMode", noCarsMode);
      await sendNoCarsAlertTelegram(fd);
      toast.success("تم إرسال الإشعار للإدارة بنجاح");
    } catch (err) {
      console.error("Failed to send no-cars telegram alert:", err);
      toast.error("حدث خطأ في إرسال الإشعار");
    } finally {
      setAlertSending(false);
      setShowCarAlert(false);
    }
  };

  const [suggestions, setSuggestions] = useState<{ types: string[], subtotals: string[], times: string[] }>({ types: [], subtotals: [], times: [] });

  useEffect(() => {
    if (!shopId) return;

    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/shops/${shopId}/suggestions`);
        if (!res.ok) throw new Error("Failed to fetch suggestions");
        const data = await res.json();
        if (active) {
          setSuggestions({
            types: data.types || [],
            subtotals: data.subtotals || [],
            times: data.times || [],
          });
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        if (active) {
          setSuggestions({ types: [], subtotals: [], times: [] });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [shopId]);

  useEffect(() => {
    if (state.error && state.error.includes("محظور")) {
      setBlockedPhone(customerPhone);
    }
  }, [state.error, customerPhone]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    if (selected && q === selected.name) {
      setHits([]);
      return;
    }

    const requestId = ++latestRegionSearchRequestIdRef.current;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(query)}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          // إذا كانت نتيجة قديمة رجعت بعد ما غيّر المستخدم الكتابة/اختيار المنطقة
          // نمنعها من إعادة فتح القائمة.
          if (requestId !== latestRegionSearchRequestIdRef.current) return;
          setHits(j.regions ?? []);
        } catch {
          if (requestId !== latestRegionSearchRequestIdRef.current) return;
          setHits([]);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [q, selected]);

  // بعد نجاح رفع الطلب الجديد: التحويل التلقائي إلى واتساب مع رسالة جاهزة
  useEffect(() => {
    if (state.ok && !initialOrder && state.waUrl && waRedirectEnabled) {
      if (state.waUrl !== "#") {
        window.location.href = state.waUrl;
        return;
      }
    }
  }, [state.ok, initialOrder, state.waUrl, waRedirectEnabled]);

  // غلق الصفحة تلقائياً بعد نجاح الإرسال بـ 3 ثواني (كتحويل احتياطي)
  useEffect(() => {
    if (state.ok && (initialOrder || waRedirectEnabled)) {
      const t = setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.error("Failed to close window:", e);
        }
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [state.ok, initialOrder, waRedirectEnabled]);

  // التركيز التلقائي والتمرير للحقل الناقص عند وجود خطأ
  useEffect(() => {
    if (state.error) {
      const err = state.error;
      let target: HTMLElement | null = null;
      if (err.includes("رقم الزبون")) target = customerPhoneRef.current;
      else if (err.includes("نوع الطلب")) target = orderTypeRef.current;
      else if (err.includes("سعر الطلب")) target = orderPriceRef.current;
      else if (err.includes("منطقة")) target = regionSearchRef.current;
      else if (err.includes("وقت الطلب") || err.includes("وقت التوصيل")) target = orderTimeRef.current;

      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [state.error]);

  const normalizedPrice = orderPrice.replace(/,/g, ".").trim();
  const hasOrderPrice = normalizedPrice.length > 0;
  const parsedPrice = hasOrderPrice ? parseFloat(normalizedPrice) : NaN;
  const subtotal = hasOrderPrice && !Number.isNaN(parsedPrice) ? parsedPrice : null;
  const dPrice = selected ? (parseFloat(selected.deliveryPrice) / ALF_PER_DINAR) : 0;
  const totalPrice = (subtotal || 0) + dPrice;

  const isPhoneErr = state.error?.includes("رقم الزبون");
  const isOrderTypeErr = state.error?.includes("نوع الطلب");
  const isPriceErr = state.error?.includes("سعر الطلب");
  const isRegionErr = state.error?.includes("منطقة");
  const isTimeErr = state.error?.includes("وقت الطلب") || state.error?.includes("وقت التوصيل");

  const isPriceValid = !orderPrice || /^\d+(\.\d+)?$/.test(orderPrice.replace(/,/g, "."));

  const historyHrefNav = `/client/order/history?${new URLSearchParams({ e, exp, s: sig, phone: customerPhone }).toString()}`;
  const accountHrefNav = `/client/order/account?${new URLSearchParams({ e, exp, s: sig }).toString()}`;

  if (state.ok) {
    return (
      <div className="mx-auto max-w-lg" role="status" aria-live="polite">
        <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center shadow-sm">
          <p className="text-4xl">✓</p>
          <h2 className="mt-3 text-xl font-bold text-emerald-800">
            {initialOrder ? "تم تعديل الطلب بنجاح" : "تم رفع الطلب بنجاح"}
          </h2>
          <p className="mt-2 text-sm text-slate-500 italic">
            {initialOrder
              ? "سيتم غلق هذه الصفحة تلقائياً خلال ثوانٍ..."
              : waRedirectEnabled
                ? "سيتم تحويلك تلقائياً إلى واتساب خلال لحظات..."
                : "تم إرسال وحفظ تفاصيل طلبك بنجاح."}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={onResetForNewOrder || (() => window.location.reload())}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-200/40 transition hover:bg-emerald-700 active:scale-[0.99]"
            >
              رفع طلب جديد
            </button>
            <Link
              href={historyHrefNav}
              prefetch={false}
              className="flex w-full items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-50 px-4 py-3.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
            >
              سجل الطلبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    if (allowNoPriceSubmit) {
      setAllowNoPriceSubmit(false);
      return;
    }
    if (normalizedPrice) return;
    e.preventDefault();
    setShowNoPriceConfirm(true);
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      {showCarAlert && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="relative bg-white dark:bg-[#09090b] rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30 text-5xl animate-bounce">
              🚫
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-rose-600 dark:text-rose-400">تنبيه بخصوص التوصيل</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                مرحباً بك عزيزنا العميل
              </p>
            </div>
            <div className="bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl p-4 border border-rose-100/50 dark:border-rose-900/20 text-slate-700 dark:text-slate-300 font-bold text-sm leading-relaxed">
              اليوم ليس لدينا سيارات للتوصيل
              {noCarsMode === "morning" && " (الفترة الصباحية)"}
              {noCarsMode === "evening" && " (الفترة المسائية)"}
              <br />
              <span className="text-xs font-semibold text-slate-400 mt-1 block">هل تود توصيل طلبك بالدراجة النارية بدلاً من السيارة؟</span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={handleCarAlertYes}
                disabled={alertSending}
                className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-4 font-black text-base shadow-lg shadow-emerald-100 dark:shadow-none active:scale-[0.98] transition-all disabled:opacity-50"
              >
                👍 نعم، بالدراجة
              </button>
              <button
                type="button"
                onClick={handleCarAlertNo}
                disabled={alertSending}
                className="w-full rounded-2xl bg-rose-600 hover:bg-rose-700 text-white py-4 font-black text-base shadow-lg shadow-rose-100 dark:shadow-none active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {alertSending ? "جاري الإرسال..." : "👎 لا، أحتاج سيارة"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-lg text-slate-800">
      {/* settings button & dropdown */}
      <div className="absolute top-4 right-4 z-50" ref={settingsRef}>
        <button 
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-[rgba(255,255,255,0.05)] border border-slate-200 dark:border-[#00f3ff]/30 text-lg shadow-sm transition hover:scale-105 active:scale-95"
          title="الإعدادات"
        >
          ⚙️
        </button>
        
        {settingsOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] shadow-2xl p-4 z-[9999]" dir="rtl">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3 flex items-center gap-2">
              <span>⚙️</span> إعدادات الطلب
            </h3>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                التوجيه للواتساب تلقائياً
              </span>
              <button
                type="button"
                onClick={() => setWaRedirectEnabled(!waRedirectEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  waRedirectEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
                dir="ltr"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    waRedirectEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
              عند التفعيل، سيتم تحويل الزبون تلقائياً للواتساب بعد إرسال الطلب لإرسال تفاصيله للمحل.
            </p>
          </div>
        )}
      </div>

      <div className="mb-6 flex items-center justify-center gap-1 rounded-2xl bg-slate-100 p-1 shadow-inner">
        <button
          type="button"
          onClick={() => handleUiModeChange("learn")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-black transition-all ${
            uiMode === "learn" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100" : "text-slate-500 hover:bg-white/50"
          }`}
        >
          🎓 وضع التعلم
        </button>
        <button
          type="button"
          onClick={() => handleUiModeChange("professional")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-black transition-all ${
            uiMode === "professional" ? "bg-white text-sky-700 shadow-sm ring-1 ring-sky-100" : "text-slate-500 hover:bg-white/50"
          }`}
        >
          ⚡ وضع المحترف
        </button>
      </div>

      <form ref={formRef} action={formAction} onSubmit={onFormSubmit} encType="multipart/form-data" className="space-y-5">
        <input type="hidden" name="e" value={e} />
        <input type="hidden" name="exp" value={exp} />
        <input type="hidden" name="s" value={sig} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
        {initialOrder && <input type="hidden" name="editOrderNumber" value={initialOrder.orderNumber} />}
        <input type="hidden" name="prepaidAll" value={isPrepaidAll ? "on" : "off"} />
        <input type="hidden" name="reversePickup" value={isReverse ? "on" : "off"} />

        {uiMode === "learn" && (
          <>
            <input type="hidden" name="customerPhone" value={customerPhone} />
            <input type="hidden" name="orderType" value={orderType} />
            <input type="hidden" name="orderSubtotal" value={orderPrice} />
            <input type="hidden" name="orderTime" value={orderTime} />
            <input type="hidden" name="vehiclePreference" value={vehiclePreference} />
            <input type="hidden" name="deliveryPrice" value={deliveryPriceOverride || dPrice.toFixed(0)} />
            <input type="hidden" name="notes" value={notes} />
            <input type="hidden" name="alternatePhone" value={alternatePhone} />
          </>
        )}

        {uiMode === "professional" && (
          <header className="kse-glass-dark rounded-3xl border border-sky-200 p-6 text-center shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-sky-800/60">أبو الأكبر للتوصيل</p>
            {resolvePublicImageSrc(photoUrl) ? (
              <img src={resolvePublicImageSrc(photoUrl)!} alt="" className="mx-auto mt-4 h-24 w-24 rounded-3xl object-cover ring-4 ring-white shadow-lg border border-sky-100" />
            ) : null}

            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-2 text-2xl font-black text-slate-900">
                <span className="opacity-80">أهلاً بك</span>
                <span className="text-emerald-700 underline decoration-emerald-200 underline-offset-4">({greetingName})</span>
                <input type="hidden" name="customerName" value={customerName} />
              </div>
              <p className="text-base font-bold text-slate-400">من محل <span className="text-slate-700">{shopName}</span></p>

              <div className="mt-6 mx-auto max-w-[320px] relative">
                <div className="absolute inset-0 bg-emerald-600 blur-xl opacity-10 animate-pulse"></div>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 shadow-xl text-white ring-1 ring-emerald-400">
                  <p className="relative z-10 text-center text-sm font-black italic tracking-wide">
                    "خدمتكم تسعدنا وطلباتكم أمانة لدينا"
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">{shopRegionName}</p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <Link href={accountHrefNav} prefetch={false} className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-emerald-100 py-3.5 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-95">
                <span>📊</span> إحصائياتك
              </Link>
              <Link href={historyHrefNav} prefetch={false} className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-sky-100 py-3.5 text-sm font-black text-sky-700 shadow-sm transition hover:bg-sky-50 active:scale-95">
                <span>📜</span> السجل
              </Link>
            </div>

            {botUsername && botStartParam && (
              <div className="mt-4">
                <a
                  href={`https://t.me/${botUsername.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "").trim()}?start=${botStartParam}`}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0088cc] py-4 text-sm font-black text-white shadow-lg shadow-sky-200 transition-all hover:bg-[#0077b5] active:scale-95 animate-pulse"
                >
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.2z" />
                  </svg>
                  تفعيل البوت الآن
                </a>
                <p className="mt-2 text-[10px] font-bold text-slate-400 text-center">
                  سيفتح البوت مباشرة، اضغط <b>ابدأ (Start)</b> لتفعيل حسابك وظهور الأزرار.
                </p>
              </div>
            )}
          </header>
        )}

        {uiMode === "professional" ? (
          <section className="kse-glass-dark rounded-3xl border border-sky-100 p-6 shadow-sm">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 mb-6">
              <span className="h-3 w-3 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"></span>
              {initialOrder ? "تعديل تفاصيل الطلب" : "بيانات الطلبية الجديدة"}
            </h2>

            <div className="space-y-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">رقم الزبون (المستلم) *</span>
                <input ref={customerPhoneRef} name="customerPhone" required autoFocus={!initialOrder} value={customerPhone} onChange={(e) => setCustomerPhone(sanitizePhone(e.target.value))} onBlur={(e) => handlePhoneBlur(e.target.value, setCustomerPhone)} inputMode="numeric" className={`${inputClass} font-mono tabular-nums text-lg font-black ${isPhoneErr ? inputErrorClass : ""}`} placeholder="07XXXXXXXXX" />
              </label>

              {isOldCustomer && previousRegions.length > 0 && (
                <div className="rounded-2xl bg-sky-50 border border-sky-100 p-3 shadow-inner">
                  <p className="text-xs font-black text-sky-800 mb-2">هذا الزبون قديم، يرجى اختيار منطقته السابقة:</p>
                  <div className="flex flex-wrap gap-2">
                    {previousRegions.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelected(r);
                          setQ(r.name);
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-white text-sky-700 hover:bg-sky-100 rounded-xl border border-sky-200 shadow-sm transition active:scale-95"
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <label className="flex flex-col gap-1.5">
                  <span className={`text-sm font-bold px-1 ${selected && q === selected.name ? 'text-emerald-700' : 'text-slate-600'}`}>
                    منطقة الزبون (المستلم) *
                  </span>
                  <div className="relative">
                    <input ref={regionSearchRef} value={q} onChange={(e) => setQ(e.target.value)} className={`${inputClass} ${isRegionErr ? inputErrorClass : ""} ${selected && q === selected.name ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-inner pl-10' : ''}`} placeholder="ابحث عن المنطقة..." required />
                    {selected && q === selected.name && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xl animate-in zoom-in duration-300 pointer-events-none">👍</div>
                    )}
                  </div>
                </label>

                {hits.length > 0 && !(selected && q === selected.name) && (
                  <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-100">
                    {hits.map((h) => (
                      <button key={h.id} type="button" onClick={() => { setSelected(h); setQ(h.name); setHits([]); }} className="flex w-full flex-col px-4 py-3 text-right transition hover:bg-sky-50 border-b border-slate-50 last:border-0">
                        <span className="text-sm font-black text-slate-900">{h.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1.5">

                <span className="text-sm font-bold text-slate-600 px-1">نوع الطلب *</span>
                {suggestions.types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-1 px-1">
                    {suggestions.types.map((type, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOrderType(type)}
                        className="px-2.5 py-1 text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg border border-sky-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
                <input ref={orderTypeRef} name="orderType" required value={orderType} onChange={(e) => setOrderType(e.target.value)} className={`${inputClass} ${isOrderTypeErr ? inputErrorClass : ""}`} placeholder="مثال: بضاعة، طعام، …" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">سعر الطلب </span>
                {suggestions.subtotals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-1 px-1">
                    {suggestions.subtotals.map((sub, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOrderPrice(sub)}
                        className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
                <input ref={orderPriceRef} name="orderSubtotal" inputMode="decimal" value={orderPrice} onChange={(e) => setOrderPrice(e.target.value)} className={`${inputClass} font-mono tabular-nums text-lg font-black animate-placeholder ${isPriceErr ? inputErrorClass : ""}`} placeholder="اكتب السعر هنا" />
              </label>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsPrepaidAll(!isPrepaidAll)}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black transition shadow-sm border-2 ${
                    isPrepaidAll ? "bg-emerald-600 border-emerald-400 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  {isPrepaidAll ? "✓ " : ""}واصل كلشي
                </button>
                <button
                  type="button"
                  onClick={() => setIsReverse(!isReverse)}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black transition shadow-sm border-2 ${
                    isReverse ? "bg-violet-600 border-violet-400 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  {isReverse ? "🔄 " : ""}طلب عكسي
                </button>
              </div>


              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">وقت التوصيل المفضل *</span>
                {suggestions.times.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-1 px-1">
                    {suggestions.times.map((time, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOrderTime(time)}
                        className="px-2.5 py-1 text-xs bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
                <input ref={orderTimeRef} name="orderTime" required value={orderTime} onChange={(e) => setOrderTime(e.target.value)} className={`${inputClass} ${isTimeErr ? inputErrorClass : ""}`} placeholder="مثال: بعد الظهر، الساعة 4، …" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">نوع المركبة (اختياري)</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "", label: "تلقائي", icon: "✨" },
                    { id: "bike", label: "دراجة", icon: "🏍️" },
                    { id: "car", label: "سيارة", icon: "🚗" },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehiclePreference(v.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${
                        vehiclePreference === v.id
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm"
                          : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                      }`}
                    >
                      <span className="text-xl">{v.icon}</span>
                      <span className="text-[10px] font-black">{v.label}</span>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="vehiclePreference" value={vehiclePreference} />
              </label>

              <div className="flex flex-col gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-[11px] font-black text-slate-700 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <span>سعر الطلب:</span>
                    <span className="text-slate-900">{subtotal ?? 0}</span>
                  </div>
                  <div className="flex gap-1">
                    <span>التوصيل الأساسي:</span>
                    <span className="text-slate-900">{dPrice}</span>
                  </div>
                </div>

                {selected && (
                  <div className="mt-1 pt-2 border-t border-slate-200/50">
                    <span className="block mb-3 text-[11px] font-black text-sky-800 bg-sky-50 w-fit px-2 py-0.5 rounded-full shadow-sm">يمكنك رفع اجرة التوصيل ان اردت):</span>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          const current = deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice;
                          if (current > dPrice) {
                            setDeliveryPriceOverride((current - 1).toString());
                          }
                        }}
                        className="flex h-12 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-2xl font-bold text-slate-400 shadow-sm transition active:scale-95 hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50"
                      >
                        −
                      </button>

                      <div className="flex-1 relative">
                        <input
                          name="deliveryPrice"
                          type="hidden"
                          value={deliveryPriceOverride || dPrice.toFixed(0)}
                        />
                        <div dir="ltr" className="w-full rounded-2xl border-2 border-sky-200 bg-white py-2.5 text-center font-mono text-2xl font-black text-sky-900 shadow-inner ring-4 ring-sky-50/50">
                          {deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const current = deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice;
                          setDeliveryPriceOverride((current + 1).toString());
                        }}
                        className="flex h-12 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-black text-white shadow-[0_4px_0_0_rgba(5,150,105,1)] transition-all active:translate-y-1 active:shadow-none hover:bg-emerald-500"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-1 pt-2 border-t border-slate-200 flex items-center justify-between text-emerald-700">
                  <span>السعر الكلي:</span>
                  <span dir="ltr" className="text-xl font-black font-mono">
                    {(subtotal || 0) + (deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-sm font-bold text-slate-600 px-1 block mb-3">صورة الطلب (اختياري)</span>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 py-4 transition hover:bg-sky-50 hover:border-sky-300 group"
                  >
                    <span className="text-2xl group-active:scale-125 transition">📸</span>
                    <span className="text-xs font-black text-sky-800">الكاميرا</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 py-4 transition hover:bg-sky-50 hover:border-sky-300 group"
                  >
                    <span className="text-2xl group-active:scale-125 transition">🖼️</span>
                    <span className="text-xs font-black text-sky-800">المعرض</span>
                  </button>
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  name="orderImage"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  name="orderImage"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />

                {imagePreview && (
                  <div className="mt-4 relative group">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-2xl border-2 border-sky-100 shadow-sm" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        if (cameraInputRef.current) cameraInputRef.current.value = "";
                        if (galleryInputRef.current) galleryInputRef.current.value = "";
                      }}
                      className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-rose-500 text-white shadow-lg flex items-center justify-center font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <span className="text-sm font-bold text-slate-600 px-1 block mb-2">ملاحظة صوتية (اختياري)</span>
                <ClientVoiceNoteField fieldName="voiceNote" />
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">رقم ثاني للزبون (المستلم) - اختياري</span>
                <input name="alternatePhone" value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} inputMode="numeric" className={`${inputClass} font-mono tabular-nums`} placeholder="07XXXXXXXXX" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">ملاحظة كتابية</span>
                <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={`${inputClass} min-h-[100px] resize-none`} placeholder="اكتب تفاصيل المواد المطلوبة أو أي ملاحظات أخرى للمندوب..." />
              </label>
            </div>
          </section>
        ) : (
          <div className="space-y-6">
            {learnStep === 0 && (
              <div className="kse-glass-dark rounded-3xl border border-emerald-200 p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-4xl shadow-sm">📱</div>
                <h3 className="text-xl font-black text-slate-900">هنا ضع رقم الزبون</h3>
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  وليس رقمك أنت، بل رقم الشخص الذي سوف يستلم الطلب.
                  <br/>
                  يمكنك كتابته أو لصقه بأي صيغة.
                </p>
                <div className="mt-6">
                  <input
                    ref={customerPhoneRef}
                    autoFocus
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(sanitizePhone(e.target.value))}
                    onBlur={(e) => handlePhoneBlur(e.target.value, setCustomerPhone)}
                    inputMode="numeric"
                    className="w-full rounded-2xl border-2 border-emerald-200 bg-white px-4 py-4 text-center font-mono text-2xl font-black text-emerald-900 shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition"
                    placeholder="07XXXXXXXXX"
                  />
                </div>
                {isOldCustomer && previousRegions.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 shadow-inner">
                    <p className="text-sm font-black text-emerald-800 mb-3 text-center">هذا الزبون قديم، يرجى اختيار منطقته السابقة:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {previousRegions.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setSelected(r);
                            setQ(r.name);
                            setLearnStep(1);
                          }}
                          className="px-4 py-2 text-sm font-bold bg-white text-emerald-700 hover:bg-emerald-100 rounded-xl border border-emerald-200 shadow-sm transition active:scale-95"
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => customerPhone.trim() && setLearnStep(1)} className="mt-6 w-full rounded-2xl bg-emerald-600 py-4 text-lg font-black text-white shadow-lg active:scale-95 transition">تم</button>
              </div>
            )}

            {learnStep === 1 && (
              <div className="kse-glass-dark rounded-3xl border border-sky-200 p-8 text-center animate-in slide-in-from-left duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-sky-50 text-4xl shadow-sm">📦</div>
                <h3 className="text-xl font-black text-slate-900">نوع الطلب</h3>
                {suggestions.types.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-4 mb-2 px-1">
                    {suggestions.types.map((type, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOrderType(type)}
                        className="px-3 py-1.5 text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl border border-sky-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  عليك أن تكتب نوع الطلب لكي نعلم ما هي المركبة المناسبة لطلبيتك.
                  <br/>
                  مثال: كيك، ورد، كوزمتك، فراش، خضروات...
                </p>
                <div className="mt-6">
                  <input
                    ref={orderTypeRef}
                    autoFocus
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="w-full rounded-2xl border-2 border-sky-200 bg-white px-4 py-4 text-center text-xl font-black text-sky-900 shadow-sm focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition"
                    placeholder="مثال: كيك، ملابس..."
                  />
                </div>
                <button type="button" onClick={() => orderType.trim() && setLearnStep(2)} className="mt-6 w-full rounded-2xl bg-sky-600 py-4 text-lg font-black text-white shadow-lg active:scale-95 transition">تم</button>
              </div>
            )}

            {learnStep === 2 && (
              <div className="kse-glass-dark rounded-3xl border border-amber-200 p-8 text-center animate-in slide-in-from-left duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-4xl shadow-sm">💰</div>
                <h3 className="text-xl font-black text-slate-900">سعر الطلب</h3>
                {suggestions.subtotals.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-4 mb-2 px-1">
                    {suggestions.subtotals.map((sub, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOrderPrice(sub)}
                        className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl border border-emerald-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  اكتب السعر هنا، لكن انتبه: إذا كان طلبك 10 آلاف اكتب <b>10</b> فقط.
                  <br/>
                  لا تكتب "10000" ولا كلمة "ألف".
                </p>
                {!isPriceValid && (
                  <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-black text-rose-600 border border-rose-100">
                    ⚠️ عليك إزالة الأحرف وكتابة رقم فقط.
                  </div>
                )}
                <div className="mt-6">
                  <input
                    ref={orderPriceRef}
                    autoFocus
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(e.target.value)}
                    inputMode="decimal"
                    className={`w-full rounded-2xl border-2 bg-white px-4 py-4 text-center font-mono text-3xl font-black shadow-sm outline-none transition ${!isPriceValid ? 'border-rose-400 text-rose-700 ring-4 ring-rose-50' : 'border-amber-200 text-amber-900 focus:border-amber-500 focus:ring-4 focus:ring-amber-100'}`}
                    placeholder="10, 25.5, 50..."
                  />
                </div>
                <p className="mt-4 text-[11px] font-bold text-slate-400">
                  يمكنك كتابة كسور: 50.5 (خمسين ونص)، 10.25 (عشرة وربع)، 10.75 (عشرة إلا ربع).
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsPrepaidAll(!isPrepaidAll)}
                    className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black transition shadow-sm border-2 ${
                      isPrepaidAll ? "bg-emerald-600 border-emerald-400 text-white" : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    {isPrepaidAll ? "✓ " : ""}واصل كلشي
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReverse(!isReverse)}
                    className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black transition shadow-sm border-2 ${
                      isReverse ? "bg-violet-600 border-violet-400 text-white" : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    {isReverse ? "🔄 " : ""}طلب عكسي
                  </button>
                </div>
                <button type="button" onClick={() => isPriceValid && orderPrice.trim() && setLearnStep(3)} className="mt-6 w-full rounded-2xl bg-amber-600 py-4 text-lg font-black text-white shadow-lg active:scale-95 transition disabled:opacity-50" disabled={!isPriceValid}>تم</button>
              </div>
            )}

            {learnStep === 3 && (
              <div className="kse-glass-dark rounded-3xl border border-indigo-200 p-8 text-center animate-in slide-in-from-left duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-4xl shadow-sm">📍</div>
                <h3 className={`text-xl font-black ${selected && q === selected.name ? 'text-emerald-700' : 'text-slate-900'}`}>المنطقة</h3>
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  لا حاجة لكتابة اسم المنطقة كاملاً، فأنا ذكي وسأعرفها من 3 أحرف.
                  <br/>
                  جرب كتابة "عوج" للعوجة أو "حمد" لحمدان.
                </p>
                <div className="mt-6 relative">
                  <input
                    ref={regionSearchRef}
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className={`w-full rounded-2xl border-2 bg-white px-4 py-4 text-center text-xl font-black shadow-sm outline-none transition ${selected && q === selected.name ? 'border-emerald-400 text-emerald-900 bg-emerald-50 ring-4 ring-emerald-100' : 'border-indigo-200 text-indigo-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'}`}
                    placeholder="ابحث عن المنطقة..."
                  />
                  {selected && q === selected.name && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl animate-in zoom-in duration-300 pointer-events-none">👍</div>
                  )}
                  {hits.length > 0 && !(selected && q === selected.name) && (
                    <div className="absolute z-[100] mt-2 w-full overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                      <p className="bg-indigo-50 py-2 text-[10px] font-black text-indigo-600">هيا اختر إحدى هذه المناطق 👇</p>
                      {hits.map((h) => (
                        <button key={h.id} type="button" onClick={() => { setSelected(h); setQ(h.name); setHits([]); setLearnStep(4); }} className="flex w-full flex-col px-4 py-4 text-center transition hover:bg-indigo-50 border-b border-slate-50 last:border-0">
                          <span className="text-base font-black text-slate-900">{h.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {learnStep === 4 && (
              <div className="kse-glass-dark rounded-3xl border border-rose-200 p-8 text-center animate-in slide-in-from-left duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-4xl shadow-sm">⏰</div>
                <h3 className="text-xl font-black text-slate-900">وقت التوصيل</h3>
                {suggestions.times.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-4 mb-2 px-1">
                    {suggestions.times.map((time, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOrderTime(time)}
                        className="px-3 py-1.5 text-xs bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  متى تحب أن يأتي المندوب؟
                  <br/>
                  مثال: الآن، غداً صباحاً، اليوم بـ 4 العصر... يمكنك كتابة أي شيء.
                </p>
                <div className="mt-6">
                  <input
                    ref={orderTimeRef}
                    autoFocus
                    value={orderTime}
                    onChange={(e) => setOrderTime(e.target.value)}
                    className="w-full rounded-2xl border-2 border-rose-200 bg-white px-4 py-4 text-center text-xl font-black text-rose-900 shadow-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-100 outline-none transition"
                    placeholder="متى نرسل الطلب؟"
                  />
                </div>
                <button type="button" onClick={() => orderTime.trim() && setLearnStep(5)} className="mt-6 w-full rounded-2xl bg-rose-600 py-4 text-lg font-black text-white shadow-lg active:scale-95 transition">تم</button>
              </div>
            )}

            <div className={learnStep === 5 ? "block" : "hidden"}>
              <div className="kse-glass-dark rounded-3xl border border-blue-200 p-8 text-center animate-in slide-in-from-left duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-4xl shadow-sm">🎤</div>
                <h3 className="text-xl font-black text-slate-900">ملاحظة صوتية</h3>
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  هل تريد تسجيل ملاحظة صوتية سوف يسمعها المندوب؟
                  <br/>
                  يمكنك تخطي هذا الأمر.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <div className="rounded-2xl border-2 border-blue-50 bg-white p-4 shadow-sm">
                    <ClientVoiceNoteField fieldName="voiceNote" />
                    <p className="mt-2 text-[10px] font-bold text-slate-400">لديك 30 ثانية مدة التسجيل</p>
                  </div>
                  <button type="button" onClick={() => setLearnStep(6)} className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-black text-white shadow-lg active:scale-95 transition">تم / تخطي</button>
                </div>
              </div>
            </div>

            {learnStep === 6 && (
              <div className="kse-glass-dark rounded-3xl border border-emerald-200 p-8 text-center animate-in slide-in-from-left duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-4xl shadow-sm">🏍️</div>
                <h3 className="text-xl font-black text-slate-900">نوع المركبة</h3>
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  هل طلبك يمكن نقله بالدراجة أو السيارة؟
                  <br/>
                  يمكنك الاختيار أو تركه افتراضي (تلقائي).
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { id: "", label: "تلقائي", icon: "✨" },
                    { id: "bike", label: "دراجة", icon: "🏍️" },
                    { id: "car", label: "سيارة", icon: "🚗" },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehiclePreference(v.id)}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                        vehiclePreference === v.id
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-md"
                          : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                      }`}
                    >
                      <span className="text-3xl mb-1">{v.icon}</span>
                      <span className="text-xs font-black">{v.label}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setLearnStep(7)} className="mt-8 w-full rounded-2xl bg-emerald-600 py-4 text-lg font-black text-white shadow-lg active:scale-95 transition">تم / تخطي</button>
              </div>
            )}

            {learnStep === 7 && (
              <div className="kse-glass-dark rounded-3xl border border-sky-200 p-8 text-center animate-in slide-in-from-left duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-sky-50 text-4xl shadow-sm">🚚</div>
                <h3 className="text-xl font-black text-slate-900">كلفة التوصيل</h3>
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  كلفة التوصيل لهذه المنطقة هي <b>{dPrice}</b>.
                  <br/>
                  هل تريد زيادة كلفة التوصيل لتعجيل الطلب أم تخطي؟
                </p>
                {selected && (
                  <div className="mt-6 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        const current = deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice;
                        if (current > dPrice) setDeliveryPriceOverride((current - 1).toString());
                      }}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-2xl font-bold text-slate-400 shadow-sm transition active:scale-95"
                    >
                      −
                    </button>
                    <div className="flex-1 relative">
                      <div dir="ltr" className="w-full rounded-2xl border-2 border-sky-200 bg-white py-3 text-center font-mono text-3xl font-black text-sky-900 shadow-inner ring-4 ring-sky-50/50">
                        {deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const current = deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice;
                        setDeliveryPriceOverride((current + 1).toString());
                      }}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-black text-white shadow-lg active:scale-95 transition"
                    >
                      +
                    </button>
                  </div>
                )}
                <button type="button" onClick={() => setLearnStep(8)} className="mt-8 w-full rounded-2xl bg-sky-600 py-4 text-lg font-black text-white shadow-lg active:scale-95 transition">تم / تخطي</button>
              </div>
            )}

            {learnStep === 8 && (
              <div className="kse-glass-dark rounded-3xl border border-slate-200 p-8 text-center animate-in slide-in-from-left duration-300">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-4xl shadow-sm">📝</div>
                <h3 className="text-xl font-black text-slate-900">الملاحظات الكتابية</h3>
                <p className="mt-2 text-sm font-bold text-slate-500 leading-relaxed">
                  هل تريد كتابة ملاحظة ليقرأها المندوب أم تتخطى؟
                </p>
                <div className="mt-6">
                  <textarea
                    autoFocus
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-right text-base font-bold text-slate-800 shadow-sm focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition resize-none"
                    placeholder="اكتب تفاصيل إضافية هنا..."
                  />
                </div>
                <button type="button" onClick={() => setLearnStep(9)} className="mt-6 w-full rounded-2xl bg-slate-800 py-4 text-lg font-black text-white shadow-lg active:scale-95 transition">تم / تخطي</button>
              </div>
            )}

            {learnStep === 9 && (
              <div className="kse-glass-dark rounded-3xl border border-emerald-300 p-8 text-center animate-in bounce-in duration-500 shadow-2xl ring-4 ring-emerald-50">
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-5xl animate-bounce">🚀</div>
                <h3 className="text-2xl font-black text-slate-900">أنت بطل!</h3>
                <p className="mt-2 text-base font-bold text-slate-600">
                  لقد أكملت جميع البيانات بنجاح.
                  <br/>
                  الآن انقر على زر رفع الطلب لنقوم بالمهمة.
                </p>

                <div className="mt-8 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-right space-y-2">
                  <p className="text-xs font-black text-slate-400 border-b border-slate-200 pb-1 mb-2">مراجعة سريعة:</p>
                  <div className="flex justify-between text-sm font-bold"><span>رقم الزبون:</span> <span className="font-mono">{customerPhone}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span>المنطقة:</span> <span>{selected?.name}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span>السعر الكلي:</span> <span className="text-emerald-700 font-black">{(subtotal || 0) + (deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice)}</span></div>
                  {isPrepaidAll && <div className="flex justify-between text-sm font-bold text-emerald-700"><span>الحالة:</span> <span>واصل كلشي ✓</span></div>}
                  {isReverse && <div className="flex justify-between text-sm font-bold text-violet-700"><span>النوع:</span> <span>طلب عكسي 🔄</span></div>}
                </div>

                {state.error && !state.error.includes("محظور") ? (
                  <div className="mt-4 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-center text-sm font-black text-rose-800 animate-shake">
                    ⚠️ {state.error}
                  </div>
                ) : null}

                <button type="submit" disabled={pending} className="mt-8 w-full rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-800 py-5 text-xl font-black text-white shadow-xl shadow-emerald-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
                  {pending ? "جارٍ إرسال الطلب..." : "رفع الطلب للمجهزين"}
                </button>
                <button type="button" onClick={() => setLearnStep(0)} className="mt-4 text-sm font-bold text-slate-400 hover:text-slate-600 underline">تعديل البيانات</button>
              </div>
            )}
          </div>
        )}

        {uiMode === "professional" && (
          <>
            {state.error && !state.error.includes("محظور") ? (
              <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-center text-sm font-black text-rose-800 animate-shake">
                ⚠️ {state.error}
              </div>
            ) : null}

            <button type="submit" disabled={pending} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 py-4 text-lg font-black text-white shadow-xl shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
              {pending ? "جارٍ إرسال الطلب..." : initialOrder ? "تحديث الطلبية الآن" : "رفع الطلب للمجهزين"}
            </button>
          </>
        )}
      </form>

      {blockedPhone && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border-2 border-rose-100 bg-white p-6 shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <span className="text-3xl">🚫</span>
            </div>
            <h3 className="text-xl font-black text-slate-900">زبون محظور!</h3>
            <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">
              عذراً، هذا الرقم محظور من التوصيل حالياً.
              <br/>
              <span className="font-mono text-rose-600 mt-1 block" dir="ltr">{blockedPhone}</span>
            </p>
            <button
              type="button"
              onClick={() => setBlockedPhone(null)}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black text-white shadow-lg active:scale-95 transition"
            >
              فهمت ذلك
            </button>
          </div>
        </div>
      )}

      {showNoPriceConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-black text-slate-900">بدون سعر طلب؟</h3>
              <p className="mt-2 text-sm font-medium text-slate-500 leading-relaxed">
                لم تقم بإدخال سعر للطلب. هل تود الإرسال وترك السعر للمندوب؟
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button type="button" onClick={() => { setAllowNoPriceSubmit(true); setTimeout(() => formRef.current?.requestSubmit(), 0); setShowNoPriceConfirm(false); }} className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white shadow-md transition hover:bg-emerald-700">
                نعم، إرسال الطلب
              </button>
              <button type="button" onClick={() => { setShowNoPriceConfirm(false); orderPriceRef.current?.focus(); }} className="w-full rounded-2xl bg-slate-100 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200">
                تراجع، سأكتب السعر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
);
}
