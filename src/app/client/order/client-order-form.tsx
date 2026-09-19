"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { resolvePublicImageSrc } from "@/lib/image-url";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { ClientVoiceNoteField } from "./client-voice-note-field";
import "leaflet/dist/leaflet.css";
import { submitOrder, sendNoCarsAlertTelegram, type ClientOrderState } from "./actions";
import { withoutReversePickupPrefix, isReversePickupOrderType } from "@/lib/order-type-flags";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initial: ClientOrderState = {};

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

function formatMatchingRegionsCountText(count: number): string {
  if (count === 1) return "منطقة مطابقة";
  if (count === 2) return "منطقتين متطابقتين";
  if (count >= 3 && count <= 10) return `${count} مناطق مطابقة`;
  return `${count} منطقة مطابقة`;
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
  viewerName,
  botUsername,
  botStartParam,
  shopId,
  noCarsMode = "off",
  employeePhone = "",
  initialOrder,
  onResetForNewOrder,
}: PropsInner) {
  const [state, formAction, pending] = useActionState(submitOrder, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const [waRedirectEnabled, setWaRedirectEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("kse_wa_redirect_enabled");
      return stored !== "false";
    }
    return true;
  });

  const [isOtherDetailsOpen, setIsOtherDetailsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("kse_wa_redirect_enabled", String(waRedirectEnabled));
  }, [waRedirectEnabled]);

  const orderTypeRef = useRef<HTMLInputElement>(null);
  const orderPriceRef = useRef<HTMLInputElement>(null);
  const customerPhoneRef = useRef<HTMLInputElement>(null);
  const orderTimeRef = useRef<HTMLInputElement>(null);
  const regionSearchRef = useRef<HTMLInputElement>(null);
  const regionContainerRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState(initialOrder?.customerRegion.name ?? "");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [showRegionHits, setShowRegionHits] = useState(true);
  const [selected, setSelected] = useState<RegionHit | null>(initialOrder?.customerRegion ?? null);
  const latestRegionSearchRequestIdRef = useRef(0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (regionContainerRef.current && !regionContainerRef.current.contains(e.target as Node)) {
        setShowRegionHits(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // حالة رصد كتابة وتفاعل العميل مع تفاصيل الطلب
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsUserTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsUserTyping(false);
    }, 1500);
  }, [customerPhone, q, orderType, orderPrice, orderTime, isPrepaidAll, isReverse, notes, alternatePhone, vehiclePreference, deliveryPriceOverride]);

  // إعداد موضع الزر العائم
  const STORAGE_KEY_BTN = "kse_client_submit_btn_pos_v2";
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // قراءة موضع الزر العائم من LocalStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BTN);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(10, window.innerWidth - 80);
          const maxY = Math.max(10, window.innerHeight - 80);
          const clampedX = Math.max(10, Math.min(parsed.x, maxX));
          const clampedY = Math.max(10, Math.min(parsed.y, maxY));
          setFloatingPos({ x: clampedX, y: clampedY });
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load submit button position:", e);
    }
    const defaultX = Math.max(15, window.innerWidth - 85);
    const defaultY = Math.max(15, window.innerHeight - 110);
    setFloatingPos({ x: defaultX, y: defaultY });
  }, []);

  // تنبيه الحقول الناقصة أو الخاطئة
  const [fieldErrorModal, setFieldErrorModal] = useState<{
    title: string;
    message: string;
    targetRef: React.RefObject<HTMLInputElement | null>;
  } | null>(null);

  const validateAndScrollToMissingField = (): boolean => {
    const phoneClean = sanitizePhone(customerPhone);
    if (!customerPhone.trim() || phoneClean.length < 10) {
      setFieldErrorModal({
        title: "رقم الزبون ناقص أو غير صحيح 📱",
        message: "يرجى إدخال رقم هاتف زبون صحيح مكون من 11 رقم (مثال: 07XXXXXXXXX)",
        targetRef: customerPhoneRef,
      });
      return false;
    }

    if (!selected || q !== selected.name) {
      setFieldErrorModal({
        title: "منطقة الزبون غير محددة 📍",
        message: "يرجى البحث واختيار منطقة الزبون (المستلم) من القائمة المنسدلة",
        targetRef: regionSearchRef,
      });
      return false;
    }

    if (!orderType.trim()) {
      setFieldErrorModal({
        title: "نوع الطلب مطلوب 📦",
        message: "يرجى إدخال أو اختيار نوع الطلب (مثال: طعام، ملابس، كوزمتك...)",
        targetRef: orderTypeRef,
      });
      return false;
    }

    if (orderPrice.trim() && !isPriceValid) {
      setFieldErrorModal({
        title: "سعر الطلب غير صالح 💰",
        message: "يرجى كتابة سعر الطلب بالأرقام فقط بدون حروف أو رموز",
        targetRef: orderPriceRef,
      });
      return false;
    }

    if (!orderTime.trim()) {
      setFieldErrorModal({
        title: "وقت استلام الطلب مطلوب ⏰",
        message: "يرجى تحديد متى تحب أن نستلم ونسلم الطلب (مثال: الآن، بعد الظهر، بـ 4...)",
        targetRef: orderTimeRef,
      });
      return false;
    }

    return true;
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    if (!floatingPos) return;
    isDraggingRef.current = false;
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: floatingPos.x,
      initialY: floatingPos.y,
    };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    const deltaX = clientX - dragStartRef.current.startX;
    const deltaY = clientY - dragStartRef.current.startY;

    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      isDraggingRef.current = true;
    }

    if (isDraggingRef.current) {
      const maxX = Math.max(10, window.innerWidth - 80);
      const maxY = Math.max(10, window.innerHeight - 80);
      const newX = Math.max(10, Math.min(dragStartRef.current.initialX + deltaX, maxX));
      const newY = Math.max(10, Math.min(dragStartRef.current.initialY + deltaY, maxY));
      setFloatingPos({ x: newX, y: newY });
    }
  };

  const handlePointerUp = () => {
    if (isDraggingRef.current && floatingPos) {
      try {
        localStorage.setItem(STORAGE_KEY_BTN, JSON.stringify(floatingPos));
      } catch (err) {
        console.error("Failed to save button position", err);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !customerPhone) {
      const storedPhone = localStorage.getItem("kse_customer_phone");
      if (storedPhone) setCustomerPhone(storedPhone);
    }
  }, [customerPhone]);

  const [showCarAlert, setShowCarAlert] = useState(() => {
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
        .then((res) => res.json())
        .then((data) => {
          if (data.regions && data.regions.length > 0) {
            setPreviousRegions(data.regions);
            setIsOldCustomer(true);
          } else {
            setPreviousRegions([]);
            setIsOldCustomer(false);
          }
        })
        .catch((err) => {
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

  const [suggestions, setSuggestions] = useState<{ types: string[]; subtotals: string[]; times: string[] }>({
    types: [],
    subtotals: [],
    times: [],
  });

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
          if (requestId !== latestRegionSearchRequestIdRef.current) return;
          const res = j.regions ?? [];
          setHits(res);
          if (res.length > 0) setShowRegionHits(true);
        } catch {
          if (requestId !== latestRegionSearchRequestIdRef.current) return;
          setHits([]);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [q, selected]);

  useEffect(() => {
    if (state.ok && !initialOrder && state.waUrl && waRedirectEnabled) {
      if (state.waUrl !== "#") {
        window.location.href = state.waUrl;
        return;
      }
    }
  }, [state.ok, initialOrder, state.waUrl, waRedirectEnabled]);

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

  useEffect(() => {
    if (state.error) {
      const err = state.error;
      let target: HTMLElement | null = null;
      if (err.includes("رقم الزبون")) target = customerPhoneRef.current;
      else if (err.includes("نوع الطلب")) target = orderTypeRef.current;
      else if (err.includes("سعر الطلب")) target = orderPriceRef.current;
      else if (err.includes("منطقة")) target = regionSearchRef.current;
      else if (err.includes("وقت الطلب") || err.includes("وقت التوصيل") || err.includes("شوكت")) target = orderTimeRef.current;

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
  const dPrice = selected ? parseFloat(selected.deliveryPrice) / ALF_PER_DINAR : 0;

  const isPriceValid = !orderPrice || /^\d+(\.\d+)?$/.test(orderPrice.replace(/,/g, "."));

  const historyHrefNav = `/client/order/history?${new URLSearchParams({ e, exp, s: sig, phone: customerPhone }).toString()}`;
  const accountHrefNav = `/client/order/account?${new URLSearchParams({ e, exp, s: sig }).toString()}`;

  if (state.ok) {
    return (
      <div className="mx-auto max-w-lg" role="status" aria-live="polite">
        <div className="rounded-3xl border-2 border-[#C9A86A] bg-[#FFFEFB] p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#0A3D2E] text-[#F5D77F] text-4xl shadow-md">
            ✓
          </div>
          <h2 className="text-2xl font-black text-[#0A3D2E]">
            {initialOrder ? "تم تعديل الطلب بنجاح" : "تم رفع الطلب بنجاح"}
          </h2>
          <p className="mt-3 text-sm font-bold text-slate-600 leading-relaxed">
            {initialOrder
              ? "سيتم غلق هذه الصفحة تلقائياً خلال لحظات..."
              : waRedirectEnabled
                ? "سيتم تحويلك تلقائياً إلى واتساب..."
                : "تم حفظ وإرسال تفاصيل طلبك للإدارة بنجاح."}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={onResetForNewOrder || (() => window.location.reload())}
              className="w-full rounded-2xl bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] border border-[#C9A86A] px-4 py-4 text-base font-black text-[#F5D77F] shadow-lg transition active:scale-[0.98]"
            >
              رفع طلب جديد ✨
            </button>
            <Link
              href={historyHrefNav}
              prefetch={false}
              className="flex w-full items-center justify-center rounded-2xl border-2 border-[#C9A86A]/40 bg-[#FFF8F0] px-4 py-3.5 text-sm font-black text-[#0A3D2E] shadow-sm transition hover:bg-[#FDF8EE] active:scale-[0.98]"
            >
              📜 سجل الطلبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    if (!validateAndScrollToMissingField()) {
      e.preventDefault();
      return;
    }
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
      {/* مودال تنبيه الحقول الناقصة */}
      {fieldErrorModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="relative bg-[#FFFEFB] rounded-3xl border-2 border-[#C9A86A] shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#0A3D2E] text-4xl shadow-inner animate-bounce">
              ⚠️
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-[#0A3D2E]">
                {fieldErrorModal.title}
              </h3>
              <p className="text-sm font-bold text-slate-700 leading-relaxed px-2">
                {fieldErrorModal.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const target = fieldErrorModal.targetRef.current;
                setFieldErrorModal(null);
                if (target) {
                  setTimeout(() => {
                    target.focus();
                    target.scrollIntoView({ behavior: "smooth", block: "center" });
                    target.classList.add("ring-4", "ring-[#C9A86A]", "border-[#0A3D2E]");
                    setTimeout(() => {
                      target.classList.remove("ring-4", "ring-[#C9A86A]", "border-[#0A3D2E]");
                    }, 2500);
                  }, 100);
                }
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] border border-[#C9A86A] text-[#F5D77F] py-4 font-black text-base shadow-lg active:scale-[0.98] transition-all"
            >
              الانتقال للحقل وتعديله 🎯
            </button>
          </div>
        </div>
      )}

      {/* تنبيه السيارات */}
      {showCarAlert && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="relative bg-[#FFFEFB] rounded-3xl border-2 border-[#C9A86A] shadow-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-5xl animate-bounce">
              🚫
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-[#0A3D2E]">تنبيه بخصوص التوصيل</h3>
              <p className="text-sm font-bold text-slate-600">
                مرحباً بك عزيزنا العميل
              </p>
            </div>
            <div className="bg-[#FFF8F0] rounded-2xl p-4 border border-[#C9A86A]/40 text-slate-800 font-bold text-sm leading-relaxed">
              اليوم ليس لدينا سيارات للتوصيل
              {noCarsMode === "morning" && " (الفترة الصباحية)"}
              {noCarsMode === "evening" && " (الفترة المسائية)"}
              <br />
              <span className="text-xs font-semibold text-slate-500 mt-1 block">هل تود توصيل طلبك بالدراجة النارية بدلاً من السيارة؟</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCarAlertYes}
                disabled={alertSending}
                className="w-full rounded-2xl bg-[#0A3D2E] border border-[#C9A86A] text-[#F5D77F] py-3.5 font-black text-sm shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
              >
                👍 نعم، بالدراجة
              </button>
              <button
                type="button"
                onClick={handleCarAlertNo}
                disabled={alertSending}
                className="w-full rounded-2xl bg-rose-600 text-white py-3.5 font-black text-sm shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {alertSending ? "جاري الإرسال..." : "👎 لا، أحتاج سيارة"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-lg text-slate-800">
        <form ref={formRef} action={formAction} onSubmit={onFormSubmit} encType="multipart/form-data" className="space-y-4">
          <input type="hidden" name="e" value={e} />
          <input type="hidden" name="exp" value={exp} />
          <input type="hidden" name="s" value={sig} />
          <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
          {initialOrder && <input type="hidden" name="editOrderNumber" value={initialOrder.orderNumber} />}
          <input type="hidden" name="prepaidAll" value={isPrepaidAll ? "on" : "off"} />
          <input type="hidden" name="reversePickup" value={isReverse ? "on" : "off"} />
          <input type="hidden" name="customerName" value={customerName} />

          {/* الهيدر العلوي الملكي الفاخر */}
          <header className="rounded-3xl border-2 border-[#C9A86A]/40 bg-[#FFFEFB] p-5 text-center shadow-md relative overflow-hidden">
            {/* الشعار واسم النظام */}
            <div className="flex items-center justify-between pb-3 border-b border-[#C9A86A]/20">
              <span className="text-xs font-black text-[#0A3D2E] tracking-wider uppercase flex items-center gap-1.5">
                <span>👑</span> أبو الأكبر للتوصيل
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black bg-[#FFF8F0] text-[#0A3D2E] border border-[#C9A86A]/40">
                📍 {shopRegionName}
              </span>
            </div>

            {/* صورة المحل واسمه */}
            <div className="my-4 text-center">
              {resolvePublicImageSrc(photoUrl) ? (
                <img
                  src={resolvePublicImageSrc(photoUrl)!}
                  alt={shopName}
                  className="mx-auto h-20 w-20 rounded-2xl object-cover ring-2 ring-[#C9A86A] shadow-md border-2 border-white mb-3"
                />
              ) : (
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF8F0] border-2 border-[#C9A86A]/40 text-3xl shadow-sm">
                  🏪
                </div>
              )}

              <h1 className="text-xl font-black text-[#0A3D2E]">{shopName}</h1>
              <p className="text-xs font-bold text-slate-600 mt-1">
                أهلاً بك يا <span className="text-[#0A3D2E] font-black underline decoration-[#C9A86A] underline-offset-4">{greetingName}</span>
              </p>
            </div>

            {/* العبارة الملكية الفاخرة */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] p-3 shadow-md text-[#F5D77F] border border-[#C9A86A]/50 mb-4">
              <p className="text-center text-xs sm:text-sm font-black italic tracking-wide">
                "خدمتكم تسعدنا وطلباتكم أمانة لدينا"
              </p>
            </div>

            {/* الأزرار العلوية: سجل الديون + السجل */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={accountHrefNav}
                prefetch={false}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#FFF8F0] border-2 border-[#C9A86A]/40 py-3 text-xs font-black text-[#0A3D2E] shadow-xs transition hover:bg-[#FDF8EE] active:scale-95"
              >
                <span>📒</span> سجل الديون
              </Link>
              <Link
                href={historyHrefNav}
                prefetch={false}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#FFF8F0] border-2 border-[#C9A86A]/40 py-3 text-xs font-black text-[#0A3D2E] shadow-xs transition hover:bg-[#FDF8EE] active:scale-95"
              >
                <span>📜</span> السجل
              </Link>
            </div>

            {/* تفعيل البوت إذا كان موجوداً */}
            {botUsername && botStartParam && (
              <div className="mt-3">
                <a
                  href={`https://t.me/${botUsername.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "").trim()}?start=${botStartParam}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0088cc] py-3 text-xs font-black text-white shadow-md transition-all hover:bg-[#0077b5] active:scale-95"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.2z" />
                  </svg>
                  تفعيل البوت الآن
                </a>
              </div>
            )}
          </header>

          {/* بطاقة إدخال الطلب الأساسية */}
          <section className="rounded-3xl border-2 border-[#C9A86A]/40 bg-[#FFFEFB] p-4 sm:p-5 shadow-md space-y-4">
            <h2 className="text-sm font-black text-[#0A3D2E] flex items-center gap-2 pb-2 border-b border-[#C9A86A]/20">
              <span className="h-2.5 w-2.5 rounded-full bg-[#0A3D2E] ring-2 ring-[#C9A86A]"></span>
              {initialOrder ? "تعديل تفاصيل الطلب" : "بيانات الطلبية الجديدة"}
            </h2>

            {/* الصف 1: خانة منطقة الزبون بجانب خانة رقم الزبون */}
            <div className="grid grid-cols-12 gap-2 sm:gap-3 items-end">
              {/* خانة رقم الزبون (مصغرة بنسبة مناسبة لمنع التراكب) */}
              <div className="col-span-5">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-black text-slate-700">رقم الزبون *</span>
                  <input
                    ref={customerPhoneRef}
                    name="customerPhone"
                    required
                    autoFocus={!initialOrder}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(sanitizePhone(e.target.value))}
                    onBlur={(e) => handlePhoneBlur(e.target.value, setCustomerPhone)}
                    inputMode="numeric"
                    className="w-full rounded-2xl border-2 border-[#C9A86A]/40 bg-white px-2.5 py-2.5 text-center font-mono text-xs sm:text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-[#0A3D2E] focus:ring-2 focus:ring-[#0A3D2E]/20"
                    placeholder="07XXXXXXXXX"
                  />
                </label>
              </div>

              {/* خانة منطقة الزبون */}
              <div className="col-span-7 relative" ref={regionContainerRef}>
                <label className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700">منطقة الزبون *</span>
                    {selected && q === selected.name && (
                      <span className="text-[10px] font-bold text-[#0A3D2E] bg-[#FFF8F0] px-1.5 py-0.5 rounded-md border border-[#C9A86A]/40">
                        محددة ✓
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      ref={regionSearchRef}
                      value={q}
                      onFocus={() => setShowRegionHits(true)}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setShowRegionHits(true);
                        if (selected && e.target.value !== selected.name) {
                          setSelected(null);
                        }
                      }}
                      className={`w-full rounded-2xl border-2 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 shadow-sm outline-none transition ${
                        selected && q === selected.name
                          ? "border-[#0A3D2E] bg-[#FFF8F0] font-black text-[#0A3D2E] ring-2 ring-[#C9A86A]/30 pl-8"
                          : "border-[#C9A86A]/40 focus:border-[#0A3D2E] focus:ring-2 focus:ring-[#0A3D2E]/20 pl-8"
                      }`}
                      placeholder="ابحث عن المنطقة..."
                      required
                      autoComplete="off"
                    />

                    {q && (
                      <button
                        type="button"
                        onClick={() => {
                          setQ("");
                          setSelected(null);
                          setHits([]);
                          regionSearchRef.current?.focus();
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-slate-400 hover:text-rose-600 text-xs font-bold"
                        title="مسح"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </label>

                {/* قائمة نتائج البحث للمناطق */}
                {hits.length > 0 && showRegionHits && !(selected && q === selected.name) && (
                  <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl border-2 border-[#C9A86A] bg-[#FFFEFB] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="bg-[#FFF8F0] px-3 py-1.5 border-b border-[#C9A86A]/30 flex items-center justify-between">
                      <span className="text-[10px] font-black text-[#0A3D2E]">اختر المنطقة:</span>
                      <span className="text-[9px] font-bold text-slate-500">
                        {formatMatchingRegionsCountText(hits.length)}
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-[#C9A86A]/10">
                      {hits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            setSelected(h);
                            setQ(h.name);
                            setHits([]);
                            setShowRegionHits(false);
                          }}
                          className="group flex w-full items-center justify-between px-3 py-2 text-right transition-all hover:bg-[#FFF8F0] active:bg-[#FDF8EE]"
                        >
                          <div className="flex flex-col text-right">
                            <span className="text-xs font-black text-slate-900 group-hover:text-[#0A3D2E]">
                              {h.name}
                            </span>
                            {h.deliveryPrice ? (
                              <span className="text-[10px] font-bold text-[#0A3D2E]">
                                التوصيل: {formatDinarAsAlfWithUnit(h.deliveryPrice)}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[10px] font-bold text-[#0A3D2E]">اختيار ⬅️</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* مناطق الزبون السابقة إن وجدت */}
            {isOldCustomer && previousRegions.length > 0 && (
              <div className="rounded-2xl bg-[#FFF8F0] border border-[#C9A86A]/40 p-2.5 shadow-xs">
                <p className="text-[11px] font-black text-[#0A3D2E] mb-1.5 flex items-center gap-1">
                  <span>🕒</span> مناطق هذا الزبون المسجلة سابقاً:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previousRegions.map((r, i) => {
                    const isThisSelected = selected?.id === r.id || (selected && q === selected.name && q === r.name);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelected(r);
                          setQ(r.name);
                          setHits([]);
                          setShowRegionHits(false);
                        }}
                        className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition shadow-2xs active:scale-95 ${
                          isThisSelected
                            ? "bg-[#0A3D2E] text-[#F5D77F] border-[#C9A86A]"
                            : "bg-white text-[#0A3D2E] border-[#C9A86A]/40 hover:bg-[#FDF8EE]"
                        }`}
                      >
                        📍 {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* الصف 2: خانة نوع الطلب بجانب خانة سعر الطلب (اقتراحين فقط لكل منهما) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 items-start">
              {/* خانة نوع الطلب */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black text-slate-700">نوع الطلب *</span>
                {suggestions.types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {suggestions.types.slice(0, 2).map((type, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOrderType(type)}
                        className="px-2 py-0.5 text-[10px] font-bold bg-[#FFF8F0] text-[#0A3D2E] hover:bg-[#0A3D2E] hover:text-[#F5D77F] rounded-lg border border-[#C9A86A]/40 transition active:scale-95"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  ref={orderTypeRef}
                  name="orderType"
                  required
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="w-full rounded-2xl border-2 border-[#C9A86A]/40 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-[#0A3D2E] focus:ring-2 focus:ring-[#0A3D2E]/20"
                  placeholder="مثال: طعام، ملابس..."
                />
              </div>

              {/* خانة سعر الطلب */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black text-slate-700">سعر الطلب</span>
                {suggestions.subtotals.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-0.5">
                    {suggestions.subtotals.slice(0, 2).map((sub, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setOrderPrice(sub)}
                        className="px-2 py-0.5 text-[10px] font-bold bg-[#FFF8F0] text-[#0A3D2E] hover:bg-[#0A3D2E] hover:text-[#F5D77F] rounded-lg border border-[#C9A86A]/40 transition active:scale-95"
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  ref={orderPriceRef}
                  name="orderSubtotal"
                  inputMode="decimal"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  className="w-full rounded-2xl border-2 border-[#C9A86A]/40 bg-white px-3 py-2.5 font-mono text-center text-xs sm:text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-[#0A3D2E] focus:ring-2 focus:ring-[#0A3D2E]/20"
                  placeholder="مثال: 15"
                />
              </div>
            </div>

            {/* الصف 3: وقت استلام الطلب (مرفوع للأعلى قبل زري كلشي واصل وطلب عكسي) */}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                <span>⏰</span>
                <span>شوكت تحب نستلم الطلب *</span>
              </span>
              {suggestions.times.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-0.5">
                  {suggestions.times.slice(0, 2).map((time, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setOrderTime(time)}
                      className="px-2 py-0.5 text-[10px] font-bold bg-[#FFF8F0] text-[#0A3D2E] hover:bg-[#0A3D2E] hover:text-[#F5D77F] rounded-lg border border-[#C9A86A]/40 transition active:scale-95"
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
              <input
                ref={orderTimeRef}
                name="orderTime"
                required
                value={orderTime}
                onChange={(e) => setOrderTime(e.target.value)}
                className="w-full rounded-2xl border-2 border-[#C9A86A]/40 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-[#0A3D2E] focus:ring-2 focus:ring-[#0A3D2E]/20"
                placeholder="مثال: الآن، العصر بـ 4، غداً..."
              />
            </label>

            {/* الصف 4: زري كلشي واصل وطلب عكسي */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsPrepaidAll(!isPrepaidAll)}
                className={`flex items-center justify-center gap-1.5 rounded-2xl py-3 text-xs font-black transition-all shadow-xs border-2 ${
                  isPrepaidAll
                    ? "bg-[#0A3D2E] border-[#C9A86A] text-[#F5D77F] shadow-sm"
                    : "bg-[#FFF8F0] border-[#C9A86A]/40 text-slate-700 hover:bg-[#FDF8EE]"
                }`}
              >
                {isPrepaidAll ? "✓ " : ""}كلشي واصل
              </button>
              <button
                type="button"
                onClick={() => setIsReverse(!isReverse)}
                className={`flex items-center justify-center gap-1.5 rounded-2xl py-3 text-xs font-black transition-all shadow-xs border-2 ${
                  isReverse
                    ? "bg-purple-900 border-[#C9A86A] text-[#F5D77F] shadow-sm"
                    : "bg-[#FFF8F0] border-[#C9A86A]/40 text-slate-700 hover:bg-[#FDF8EE]"
                }`}
              >
                {isReverse ? "🔄 " : ""}طلب عكسي
              </button>
            </div>

            {/* ملخص السعر والتوصيل */}
            <div className="flex flex-col gap-1.5 rounded-2xl bg-[#FFF8F0] border border-[#C9A86A]/40 p-3 text-xs font-black text-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">سعر الطلب: <strong className="text-slate-900 font-mono text-sm">{subtotal ?? 0}</strong></span>
                <span className="text-slate-600">التوصيل: <strong className="text-slate-900 font-mono text-sm">{deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice}</strong></span>
              </div>
              <div className="pt-1.5 border-t border-[#C9A86A]/30 flex items-center justify-between text-[#0A3D2E]">
                <span className="text-xs font-black">السعر الإجمالي:</span>
                <span dir="ltr" className="text-base font-black font-mono text-[#0A3D2E]">
                  {(subtotal || 0) + (deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice)} ألف
                </span>
              </div>
            </div>

            {/* تفاصيل أخرى (قائمة منسدلة قابلة للطي) */}
            <div className="rounded-2xl border-2 border-[#C9A86A]/40 bg-white overflow-hidden shadow-xs transition-all">
              <button
                type="button"
                onClick={() => setIsOtherDetailsOpen(!isOtherDetailsOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#FFF8F0] hover:bg-[#FDF8EE] transition-colors font-black text-xs text-[#0A3D2E]"
              >
                <span className="flex items-center gap-1.5">
                  <span>✨</span>
                  <span>تفاصيل أخرى (اختياري)</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white border border-[#C9A86A]/40 text-[#0A3D2E]">
                  {isOtherDetailsOpen ? "إخفاء التفاصيل ▲" : "عرض التفاصيل ▼"}
                </span>
              </button>

              {isOtherDetailsOpen && (
                <div className="p-3.5 space-y-3.5 border-t border-[#C9A86A]/20 bg-white animate-in slide-in-from-top-2 duration-200">
                  {/* رفع أجر التوصيل إن رغب العميل */}
                  {selected && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-black text-slate-700 block">رفع أجر التوصيل (اختياري لتعجيل الطلب):</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const current = deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice;
                            if (current > dPrice) {
                              setDeliveryPriceOverride((current - 1).toString());
                            }
                          }}
                          className="flex h-9 w-11 items-center justify-center rounded-xl border border-[#C9A86A]/40 bg-[#FFF8F0] text-lg font-bold text-slate-600 shadow-2xs transition active:scale-95"
                        >
                          −
                        </button>
                        <div className="flex-1 text-center font-mono font-black text-sm text-[#0A3D2E] bg-[#FFF8F0] py-1.5 rounded-xl border border-[#C9A86A]/40">
                          {deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice} ألف
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const current = deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice;
                            setDeliveryPriceOverride((current + 1).toString());
                          }}
                          className="flex h-9 w-11 items-center justify-center rounded-xl bg-[#0A3D2E] text-[#F5D77F] text-lg font-bold border border-[#C9A86A] shadow-2xs transition active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                  <input type="hidden" name="deliveryPrice" value={deliveryPriceOverride || dPrice.toFixed(0)} />

                  {/* نوع المركبة */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-slate-700 block">نوع المركبة المفضلة</span>
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
                              ? "border-[#0A3D2E] bg-[#0A3D2E] text-[#F5D77F] shadow-2xs"
                              : "border-[#C9A86A]/30 bg-[#FFF8F0] text-slate-600 hover:border-[#C9A86A]"
                          }`}
                        >
                          <span className="text-sm">{v.icon}</span>
                          <span className="text-[10px] font-black">{v.label}</span>
                        </button>
                      ))}
                    </div>
                    <input type="hidden" name="vehiclePreference" value={vehiclePreference} />
                  </div>

                  {/* صورة الطلب */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-black text-slate-700 block">صورة الطلب (اختياري)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C9A86A] bg-[#FFF8F0] py-2 text-xs font-black text-[#0A3D2E] hover:bg-[#FDF8EE] transition active:scale-95"
                      >
                        <span>📸</span>
                        <span>الكاميرا</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C9A86A] bg-[#FFF8F0] py-2 text-xs font-black text-[#0A3D2E] hover:bg-[#FDF8EE] transition active:scale-95"
                      >
                        <span>🖼️</span>
                        <span>المعرض</span>
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
                      <div className="relative mt-2">
                        <img src={imagePreview} alt="Preview" className="w-full h-36 object-cover rounded-xl border border-[#C9A86A]/50 shadow-xs" />
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview(null);
                            if (cameraInputRef.current) cameraInputRef.current.value = "";
                            if (galleryInputRef.current) galleryInputRef.current.value = "";
                          }}
                          className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-rose-600 text-white shadow-md flex items-center justify-center font-bold text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ملاحظة صوتية */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-slate-700 block">ملاحظة صوتية للمندوب</span>
                    <ClientVoiceNoteField fieldName="voiceNote" />
                  </div>

                  {/* رقم ثاني */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-slate-700 block">رقم ثاني للزبون (اختياري)</span>
                    <input
                      name="alternatePhone"
                      value={alternatePhone}
                      onChange={(e) => setAlternatePhone(e.target.value)}
                      inputMode="numeric"
                      className="w-full rounded-xl border border-[#C9A86A]/40 bg-[#FFF8F0] px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-[#0A3D2E]"
                      placeholder="07XXXXXXXXX"
                    />
                  </div>

                  {/* ملاحظة كتابية */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-black text-slate-700 block">ملاحظة كتابية للمندوب</span>
                    <textarea
                      name="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-[#C9A86A]/40 bg-[#FFF8F0] p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-[#0A3D2E] resize-none"
                      placeholder="اكتب أي تعليمات إضافية للمندوب..."
                    />
                  </div>

                  {/* التحويل للواتساب */}
                  <div className="pt-2 border-t border-[#C9A86A]/20 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">التحويل إلى واتساب تلقائياً</span>
                    <button
                      type="button"
                      onClick={() => setWaRedirectEnabled(!waRedirectEnabled)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                        waRedirectEnabled ? "bg-[#0A3D2E]" : "bg-slate-300"
                      }`}
                      dir="ltr"
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          waRedirectEnabled ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {state.error && !state.error.includes("محظور") && (
              <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-center text-xs font-black text-rose-800 animate-shake">
                ⚠️ {state.error}
              </div>
            )}
          </section>
        </form>

        {/* الزر العائم الملكي المشرق والذكي لرفع الطلب للإدارة */}
        {floatingPos && !state.ok && (
          <div
            style={{
              position: "fixed",
              left: `${floatingPos.x}px`,
              top: `${floatingPos.y}px`,
              zIndex: 9999,
            }}
            className={`touch-none select-none cursor-grab active:cursor-grabbing transition-transform duration-200 ${
              isUserTyping ? "animate-typing-dance" : "animate-royal-float"
            }`}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) handlePointerDown(t.clientX, t.clientY);
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (t) handlePointerMove(t.clientX, t.clientY);
            }}
            onTouchEnd={() => {
              const dragged = isDraggingRef.current;
              handlePointerUp();
              if (!dragged && !pending) {
                if (validateAndScrollToMissingField()) {
                  formRef.current?.requestSubmit();
                }
              }
            }}
            onMouseDown={(e) => {
              handlePointerDown(e.clientX, e.clientY);
              const onMouseMove = (ev: MouseEvent) => handlePointerMove(ev.clientX, ev.clientY);
              const onMouseUp = () => {
                const dragged = isDraggingRef.current;
                handlePointerUp();
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                if (!dragged && !pending) {
                  if (validateAndScrollToMissingField()) {
                    formRef.current?.requestSubmit();
                  }
                }
              };
              window.addEventListener("mousemove", onMouseMove);
              window.addEventListener("mouseup", onMouseUp);
            }}
          >
            <div className="relative group">
              {/* موجة التوهج النبضية لجذب النظر */}
              <div className="absolute inset-0 -m-1.5 rounded-full bg-gradient-to-r from-[#C9A86A] via-[#10B981] to-[#F5D77F] opacity-75 blur-md animate-glow-wave pointer-events-none" />

              {/* شارة تفاعلية عند الكتابة */}
              {isUserTyping && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D77F] border border-white px-2 py-0.5 text-[8px] font-black text-[#06281D] shadow-md animate-bounce">
                  جاهز للرفع ✨
                </span>
              )}

              {/* الزر الرئيسي المشرق والفاخر */}
              <button
                type="button"
                disabled={pending}
                className="relative flex h-18 w-18 sm:h-20 sm:w-20 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] via-[#059669] to-[#0A3D2E] border-2 border-[#F5D77F] text-[#FFF8F0] shadow-[0_10px_28px_rgba(16,185,129,0.5)] ring-4 ring-[#C9A86A]/50 transition-all hover:scale-110 active:scale-95 disabled:opacity-50 overflow-hidden"
                title="رفع الطلب للإدارة (يمكنك سحب وتحريك الزر لأي مكان)"
              >
                {/* تأثير لمعان شعاع الضوء الذهبي */}
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/35 to-transparent animate-gold-shimmer pointer-events-none" />

                {pending ? (
                  <span className="h-6 w-6 animate-spin rounded-full border-3 border-[#F5D77F] border-t-transparent" />
                ) : (
                  <>
                    <span className="text-xl sm:text-2xl leading-none mb-0.5 filter drop-shadow">
                      🚀
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-black leading-tight text-center px-1 text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      رفع الطلب<br />للإدارة
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* تنبيه الزبون المحظور */}
        {blockedPhone && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl border-2 border-rose-200 bg-white p-6 shadow-2xl text-center animate-in zoom-in duration-300">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <span className="text-3xl">🚫</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">زبون محظور!</h3>
              <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">
                عذراً، هذا الرقم محظور من التوصيل حالياً.
                <br />
                <span className="font-mono text-rose-600 mt-1 block" dir="ltr">{blockedPhone}</span>
              </p>
              <button
                type="button"
                onClick={() => setBlockedPhone(null)}
                className="mt-6 w-full rounded-2xl bg-[#0A3D2E] border border-[#C9A86A] py-3 text-sm font-black text-[#F5D77F] shadow-lg active:scale-95 transition"
              >
                فهمت ذلك
              </button>
            </div>
          </div>
        )}

        {/* تأكيد إرسال بدون سعر */}
        {showNoPriceConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl border-2 border-[#C9A86A] bg-[#FFFEFB] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#0A3D2E] mb-4">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="text-lg font-black text-[#0A3D2E]">بدون سعر طلب؟</h3>
                <p className="mt-2 text-sm font-bold text-slate-600 leading-relaxed">
                  لم تقم بإدخال سعر للطلب. هل تود الإرسال وترك السعر للمندوب؟
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAllowNoPriceSubmit(true);
                    setTimeout(() => formRef.current?.requestSubmit(), 0);
                    setShowNoPriceConfirm(false);
                  }}
                  className="w-full rounded-2xl bg-[#0A3D2E] border border-[#C9A86A] py-3.5 text-sm font-black text-[#F5D77F] shadow-md transition active:scale-95"
                >
                  نعم، إرسال الطلب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNoPriceConfirm(false);
                    orderPriceRef.current?.focus();
                  }}
                  className="w-full rounded-2xl bg-[#FFF8F0] border border-[#C9A86A]/40 py-3 text-sm font-black text-slate-700 transition hover:bg-[#FDF8EE]"
                >
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
