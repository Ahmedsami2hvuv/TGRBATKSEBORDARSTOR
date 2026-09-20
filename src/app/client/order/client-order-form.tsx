"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { resolvePublicImageSrc } from "@/lib/image-url";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { ClientVoiceNoteField } from "./client-voice-note-field";
import "leaflet/dist/leaflet.css";
import { submitOrder, type ClientOrderState } from "./actions";
import { withoutReversePickupPrefix, isReversePickupOrderType } from "@/lib/order-type-flags";
import {
  Phone,
  MapPin,
  Package,
  Clock,
  Camera,
  Image as ImageIcon,
  Mic,
  Car,
  Bike,
  Check,
  X,
  ChevronDown,
  Sparkles,
  AlertCircle,
  CreditCard,
  FileText,
  Headphones,
  RotateCcw,
  Plus,
  Minus,
  Navigation,
  Send,
  Loader2,
  Store,
} from "lucide-react";

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
  recentOrderTypes?: string[];
  recentOrderTimes?: string[];
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
  portalUrl,
  botStartParam,
  shopId,
  noCarsMode = "off",
  employeePhone = "",
  recentOrderTypes = [],
  recentOrderTimes = [],
  initialOrder,
  onResetForNewOrder,
}: PropsInner) {
  const [state, formAction, pending] = useActionState(submitOrder, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const [isOtherDetailsOpen, setIsOtherDetailsOpen] = useState(false);

  const orderTypeRef = useRef<HTMLInputElement>(null);
  const orderPriceRef = useRef<HTMLInputElement>(null);
  const customerPhoneRef = useRef<HTMLInputElement>(null);
  const orderTimeRef = useRef<HTMLInputElement>(null);
  const regionSearchRef = useRef<HTMLInputElement>(null);
  const regionContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const [q, setQ] = useState(initialOrder?.customerRegion.name ?? "");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [showRegionHits, setShowRegionHits] = useState(false);
  const [selected, setSelected] = useState<RegionHit | null>(initialOrder?.customerRegion ?? null);
  const latestRegionSearchRequestIdRef = useRef(0);

  const [previousRegions, setPreviousRegions] = useState<RegionHit[]>([]);

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (regionContainerRef.current && !regionContainerRef.current.contains(ev.target as Node)) {
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
  const greetingName = viewerName || employeeName || "العميل";
  const [alternatePhone, setAlternatePhone] = useState(initialOrder?.alternatePhone ?? "");
  const [orderTime, setOrderTime] = useState(initialOrder?.orderTime ?? "");
  const [notes, setNotes] = useState(initialOrder?.notes ?? "");
  const [vehiclePreference, setVehiclePreference] = useState("auto");
  const [deliveryPriceAdd, setDeliveryPriceAdd] = useState<number | null>(null);

  const [showNoPriceConfirm, setShowNoPriceConfirm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lastSubmittedOrder, setLastSubmittedOrder] = useState<{
    phone: string;
    regionName: string;
    totalAlf: string;
  } | null>(null);

  // مراقبة كتابة المستخدم لتحريك زر النانو بنانا
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerTypingAnimation = () => {
    setIsUserTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsUserTyping(false);
    }, 1600);
  };

  // موضع الزر العائم مع السحب وتخزينه
  const STORAGE_KEY_BTN = "kse_client_submit_ak_btn_pos";
  const STORAGE_KEY_BTN_HINT = "kse_client_seen_ak_gold_btn_hint_v3";
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number }>({ x: 20, y: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [showNewBtnHint, setShowNewBtnHint] = useState(false);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BTN);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(10, window.innerWidth - 85);
          const maxY = Math.max(10, window.innerHeight - 85);
          const clampedX = Math.max(10, Math.min(parsed.x, maxX));
          const clampedY = Math.max(10, Math.min(parsed.y, maxY));
          setFloatingPos({ x: clampedX, y: clampedY });
        }
      } else {
        const defaultX = Math.max(15, window.innerWidth - 105);
        const defaultY = Math.max(15, window.innerHeight - 150);
        setFloatingPos({ x: defaultX, y: defaultY });
      }

      // فحص التنبيه الإرشادي للزر الجديد
      const seen = localStorage.getItem(STORAGE_KEY_BTN_HINT);
      if (!seen) {
        const timer = setTimeout(() => {
          setShowNewBtnHint(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // fallback
    }
  }, []);

  const handleAcknowledgeBtnHint = () => {
    setShowNewBtnHint(false);
    try {
      localStorage.setItem(STORAGE_KEY_BTN_HINT, "true");
    } catch {
      // ignore
    }
  };

  const handlePointerDown = (ev: React.PointerEvent<HTMLButtonElement>) => {
    if (pending) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragOffsetRef.current = {
      offsetX: ev.clientX - floatingPos.x,
      offsetY: ev.clientY - floatingPos.y,
    };
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
  };

  const handlePointerMove = (ev: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) return;
    const newX = ev.clientX - dragOffsetRef.current.offsetX;
    const newY = ev.clientY - dragOffsetRef.current.offsetY;
    const maxX = Math.max(10, window.innerWidth - 100);
    const maxY = Math.max(10, window.innerHeight - 100);
    const clampedX = Math.max(10, Math.min(newX, maxX));
    const clampedY = Math.max(10, Math.min(newY, maxY));
    setFloatingPos({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (ev: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    try {
      localStorage.setItem(STORAGE_KEY_BTN, JSON.stringify(floatingPos));
    } catch {
      // ignore
    }
  };

  // نافذة تنبيه نقص الحقول
  const [fieldErrorModal, setFieldErrorModal] = useState<{
    title: string;
    message: string;
    targetRef: React.RefObject<HTMLInputElement | null>;
  } | null>(null);

  // جلب المناطق عند البحث
  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const requestId = ++latestRegionSearchRequestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/regions/search?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) return;
        const data = await res.json();
        if (requestId === latestRegionSearchRequestIdRef.current) {
          setHits(data.regions || []);
        }
      } catch {
        // ignore
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [q]);

  // جلب المناطق السابقة للزبون عند إدخال الهاتف
  useEffect(() => {
    const clean = sanitizePhone(customerPhone);
    if (clean.length < 8) {
      setPreviousRegions([]);
      return;
    }
    let isCancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customers/regions-by-phone?phone=${encodeURIComponent(clean)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled && Array.isArray(data.regions)) {
          setPreviousRegions(
            data.regions.map((r: any) => ({
              id: r.id,
              name: r.name,
              deliveryPrice: r.deliveryPrice ? String(r.deliveryPrice) : "0",
            }))
          );
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [customerPhone]);

  // معالجة نتيجة الرفع
  useEffect(() => {
    if (state.ok) {
      const calcTotal = (
        (Number(orderPrice) || 0) +
        (selected ? Number(selected.deliveryPrice) / ALF_PER_DINAR : 0) +
        (deliveryPriceAdd || 0)
      ).toFixed(0);

      setLastSubmittedOrder({
        phone: customerPhone,
        regionName: selected?.name || q,
        totalAlf: calcTotal,
      });
      setShowSuccessModal(true);
      toast.success("تم إرسال الطلبية بنجاح");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  const validateForm = (): boolean => {
    const phoneClean = sanitizePhone(customerPhone);
    if (!customerPhone.trim() || phoneClean.length < 10) {
      setFieldErrorModal({
        title: "رقم الزبون ناقص أو غير صحيح 📱",
        message: "يرجى إدخال رقم هاتف زبون صحيح مكون من 11 رقم يبدأ بـ 07",
        targetRef: customerPhoneRef,
      });
      return false;
    }

    if (!selected || q !== selected.name) {
      setFieldErrorModal({
        title: "المنطقة مطلوبة 📍",
        message: "يرجى البحث واختيار منطقة الزبون من القائمة المنسدلة",
        targetRef: regionSearchRef,
      });
      return false;
    }

    if (!orderType.trim()) {
      setFieldErrorModal({
        title: "نوع الطلب مطلوب 📦",
        message: "يرجى إدخال أو اختيار نوع الطلب (مثل: طعام، ملابس)",
        targetRef: orderTypeRef,
      });
      return false;
    }

    if (!orderTime.trim()) {
      setFieldErrorModal({
        title: "وقت الاستلام مطلوب ⏰",
        message: "يرجى تحديد وقت استلام الطلب (مثل: فوراً، بعد ساعة)",
        targetRef: orderTimeRef,
      });
      return false;
    }

    return true;
  };

  const handleSubmitAttempt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    if (!orderPrice.trim() && !showNoPriceConfirm) {
      setShowNoPriceConfirm(true);
      return;
    }

    formRef.current?.requestSubmit();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const resetFormForNew = () => {
    setCustomerPhone("");
    setQ("");
    setSelected(null);
    setOrderType("");
    setOrderPrice("");
    setOrderTime("");
    setIsPrepaidAll(false);
    setIsReverse(false);
    setNotes("");
    setAlternatePhone("");
    setVehiclePreference("auto");
    setDeliveryPriceAdd(null);
    setImagePreview(null);
    setShowSuccessModal(false);
    setShowNoPriceConfirm(false);
    setFieldErrorModal(null);
    if (onResetForNewOrder) onResetForNewOrder();
  };

  const baseDeliveryAlf = selected ? Number(selected.deliveryPrice) / ALF_PER_DINAR : 0;
  const currentTotalDeliveryAlf = (deliveryPriceAdd !== null ? deliveryPriceAdd : baseDeliveryAlf);

  return (
    <div dir="rtl" className="min-h-screen w-full bg-[#FFFEFB] relative overflow-x-hidden">
      {/* الأنماط الخاصة بالتصميم المرجعي */}
      <style jsx global>{`
        * {
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
        }
        .islamic-pattern {
          background-image: url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23C9A86A' fill-opacity='0.06'%3E%3Cpath d='M40 0l5 15 15 5-15 5-5 15-5-15L20 20l15-5L40 0zM0 40l15-5 5-15 5 15 15 5-15 5-5 15-5-15L0 40zM80 40l-15-5-5-15-5 15-15 5 15 5 5 15 5-15L80 40zM40 80l-5-15-15-5 15-5 5-15 5 15 15 5-15 5-5 15z'/%3E%3C/g%3E%3C/svg%3E");
        }
        .card-gold {
          background: #FFFEFB;
          border: 2px solid rgba(201, 168, 106, 0.4);
          border-radius: 28px;
          box-shadow: 0 8px 32px rgba(5, 40, 28, 0.12), 0 2px 0 0 rgba(201, 168, 106, 0.15) inset;
          position: relative;
        }
        .card-gold::before {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 26px;
          border: 1px solid rgba(201, 168, 106, 0.25);
          pointer-events: none;
        }
        .focus-ring:focus {
          border-color: #0A3D2E !important;
          box-shadow: 0 0 0 3px rgba(10, 61, 46, 0.18), 0 0 0 6px rgba(201, 168, 106, 0.18);
        }
        @keyframes goldShimmer {
          0% { transform: translateX(-120%) skewX(-12deg); }
          100% { transform: translateX(220%) skewX(-12deg); }
        }
        @keyframes fabFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes fabGlow {
          0%, 100% {
            filter: drop-shadow(0 0 10px rgba(245, 215, 127, 0.45));
          }
          50% {
            filter: drop-shadow(0 0 18px rgba(201, 168, 106, 0.75));
          }
        }
        @keyframes typingDance {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.08) rotate(-4deg); }
          50% { transform: scale(1.12) rotate(4deg); }
          75% { transform: scale(1.08) rotate(-2deg); }
        }
      `}</style>

      {/* خلفية التدرج والزخرفة */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFFEFB] via-[#FFFFFF] to-[#FFF8F0] pointer-events-none" />
      <div className="absolute inset-0 islamic-pattern opacity-[0.22] pointer-events-none" />
      <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-gradient-to-b from-[#C9A86A]/12 via-[#F5D77F]/10 to-transparent blur-[70px] pointer-events-none" />

      {/* الحاوية الأساسية */}
      <div className="relative mx-auto max-w-[480px] px-[14px] py-[14px] pb-[140px]">
        {/* الهيدر العلوي */}
        <div className="rounded-[20px] bg-[#FFFFFF] border border-[#C9A86A]/25 shadow-[0_4px_20px_rgba(5,40,28,0.06)] px-[12px] py-[10px] mb-[12px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[8px]">
              <div className="w-[36px] h-[36px] rounded-full bg-[#FFFEFB] border-[1.5px] border-[#C9A86A]/60 flex items-center justify-center shadow-sm">
                <Store className="w-[18px] h-[18px] text-[#0A3D2E]" />
              </div>
              <div className="flex flex-col leading-[1]">
                <span className="text-[#0A3D2E] font-black text-[13px] tracking-wide">
                  أبو الأكبر
                </span>
                <span className="text-[#0A3D2E]/60 font-bold text-[9px] tracking-[0.18em]">
                  للتوصيل السريع
                </span>
              </div>
            </div>

            <div className="flex items-center gap-[6px]">
              <div className="h-[26px] px-[10px] rounded-full bg-[#FFF8F0] border border-[#C9A86A]/35 flex items-center gap-[5px]">
                <span className="w-[6px] h-[6px] rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                <span className="text-[#0A3D2E] text-[11px] font-bold">
                  {shopRegionName || "المنصور"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* بطاقة الترحيب بالمحل والمستخدم */}
        <div className="card-gold p-[14px] flex items-center gap-[14px] mb-[10px]">
          <div className="relative shrink-0">
            <div className="w-[64px] h-[64px] rounded-full overflow-hidden border-[2.5px] border-[#C9A86A] shadow-[0_4px_16px_rgba(201,168,106,0.35)] bg-[#FFF8F0] flex items-center justify-center">
              {photoUrl ? (
                <img
                  src={resolvePublicImageSrc(photoUrl)}
                  alt={shopName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-[32px] h-[32px] text-[#0A3D2E]" />
              )}
            </div>
            <div className="absolute -bottom-[4px] -right-[2px] w-[22px] h-[22px] rounded-full bg-[#0A3D2E] border-[2px] border-[#F5D77F] flex items-center justify-center shadow-sm">
              <Check className="w-[12px] h-[12px] text-[#F5D77F] stroke-[3]" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-[#0A3D2E] font-black text-[18px] leading-[1.1] truncate">
              {shopName || "محلات أبو الأكبر"}
            </h1>
            <p className="text-[#1E293B]/70 font-bold text-[12px] mt-[2px]">
              أهلاً يا{" "}
              <span className="text-[#0A3D2E] font-black underline decoration-[#C9A86A] decoration-2 underline-offset-[4px]">
                {greetingName}
              </span>
            </p>
            {/* شريط العبارة المضيئة المشرقة */}
            <div className="mt-[8px] h-[28px] rounded-full bg-gradient-to-r from-[#C9A86A]/15 via-[#F5D77F]/25 to-[#C9A86A]/15 border border-[#C9A86A]/30 flex items-center justify-center px-[10px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent w-[45%] animate-[goldShimmer_2.8s_ease-in-out_infinite]" />
              <span className="text-[#0A3D2E] font-black text-[11px] tracking-wide relative z-10">
                خدمتكم تسعدنا وطلباتكم أمانة لدينا
              </span>
            </div>
          </div>
        </div>

        {/* أزرار الوصول السريع الثلاثية */}
        <div className="rounded-[16px] bg-[#FFFEFB] border border-[#C9A86A]/15 p-[8px] mb-[12px]">
          <div className="flex items-center gap-[8px]">
            <Link
              href={`/client/order/account?e=${e}&exp=${exp}&s=${sig}`}
              className="flex-1 h-[40px] px-[10px] rounded-[12px] bg-[#FFFFFF] border-[1.5px] border-[#C9A86A]/40 shadow-[0_2px_8px_rgba(5,40,28,0.05)] flex items-center justify-center gap-[6px] active:scale-[0.97] transition hover:shadow-[0_4px_12px_rgba(5,40,28,0.08)] hover:border-[#C9A86A]/60"
            >
              <CreditCard className="w-[16px] h-[16px] text-[#0A3D2E]" />
              <span className="text-[#0A3D2E] font-bold text-[12px]">سجل الديون</span>
            </Link>

            <Link
              href={`/client/orders?e=${e}&exp=${exp}&s=${sig}`}
              className="flex-1 h-[40px] px-[10px] rounded-[12px] bg-[#FFFFFF] border-[1.5px] border-[#C9A86A]/40 shadow-[0_2px_8px_rgba(5,40,28,0.05)] flex items-center justify-center gap-[6px] active:scale-[0.97] transition hover:shadow-[0_4px_12px_rgba(5,40,28,0.08)] hover:border-[#C9A86A]/60"
            >
              <FileText className="w-[16px] h-[16px] text-[#0A3D2E]" />
              <span className="text-[#0A3D2E] font-bold text-[12px]">السجل</span>
            </Link>

            <a
              href={
                botUsername
                  ? `https://t.me/${botUsername}${botStartParam ? `?start=${botStartParam}` : ""}`
                  : "https://wa.me/9647733921468"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-[40px] px-[10px] rounded-[12px] bg-[#FFFFFF] border-[1.5px] border-[#C9A86A]/40 shadow-[0_2px_8px_rgba(5,40,28,0.05)] flex items-center justify-center gap-[6px] active:scale-[0.97] transition hover:shadow-[0_4px_12px_rgba(5,40,28,0.08)] hover:border-[#C9A86A]/60"
            >
              <Headphones className="w-[16px] h-[16px] text-[#0A3D2E]" />
              <span className="text-[#0A3D2E] font-bold text-[12px]">الدعم</span>
            </a>
          </div>
        </div>

        {/* بطاقة النموذج الرئيسية الفاخرة */}
        <div className="card-gold p-[16px] sm:p-[18px]">
          <form ref={formRef} action={formAction}>
            {/* الحقول المخفية للربط بالسيرفر */}
            <input type="hidden" name="e" value={e} />
            <input type="hidden" name="exp" value={exp} />
            <input type="hidden" name="s" value={sig} />
            <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
            <input type="hidden" name="orderType" value={orderType} />
            <input type="hidden" name="orderSubtotal" value={orderPrice} />
            <input type="hidden" name="customerPhone" value={customerPhone} />
            <input type="hidden" name="orderTime" value={orderTime} />
            <input type="hidden" name="prepaidAll" value={isPrepaidAll ? "on" : "off"} />
            <input type="hidden" name="reversePickup" value={isReverse ? "on" : "off"} />
            <input type="hidden" name="alternatePhone" value={alternatePhone} />
            <input type="hidden" name="vehiclePreference" value={vehiclePreference} />
            <input
              type="hidden"
              name="deliveryPrice"
              value={deliveryPriceAdd !== null ? (deliveryPriceAdd * ALF_PER_DINAR).toString() : ""}
            />
            {initialOrder?.orderNumber && (
              <input type="hidden" name="editOrderNumber" value={initialOrder.orderNumber} />
            )}

            {/* رأس البطاقة */}
            <div className="flex items-center justify-between mb-[14px]">
              <div className="flex items-center gap-[8px]">
                <div className="w-[28px] h-[28px] rounded-[9px] bg-[#0A3D2E] border border-[#C9A86A]/50 flex items-center justify-center">
                  <Package className="w-[14px] h-[14px] text-[#F5D77F]" />
                </div>
                <h2 className="text-[#0A3D2E] font-black text-[14px]">
                  بيانات الطلبية الجديدة
                </h2>
              </div>
              <span className="text-[10px] font-bold text-[#C9A86A] bg-[#FFF8F0] border border-[#C9A86A]/30 px-[8px] py-[2px] rounded-full">
                * مطلوب
              </span>
            </div>

            <div className="h-[2px] w-full bg-gradient-to-r from-[#C9A86A] via-[#F5D77F]/60 to-transparent rounded-full mb-[14px]" />

            {/* السطر الأول: رقم الزبون بجانب منطقة الزبون */}
            <div className="grid grid-cols-[135px_1fr] gap-[8px] items-end">
              {/* رقم الزبون (مكبر ومريح) */}
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-black text-[#1E293B] pr-[4px] flex items-center gap-[4px]">
                  <span className="w-[14px] h-[14px] rounded-[5px] bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center">
                    <Phone className="w-[9px] h-[9px] text-[#0A3D2E]" />
                  </span>
                  رقم الزبون
                </label>
                <div className="relative">
                  <input
                    ref={customerPhoneRef}
                    value={customerPhone}
                    onChange={(ev) => {
                      setCustomerPhone(ev.target.value);
                      triggerTypingAnimation();
                    }}
                    onBlur={() => handlePhoneBlur(customerPhone, setCustomerPhone)}
                    placeholder="07XXXXXXXX"
                    inputMode="numeric"
                    className="focus-ring w-full h-[44px] rounded-[14px] border-[1.8px] border-[#C9A86A]/40 bg-white px-[8px] text-center font-mono font-black text-[14px] text-[#1E293B] outline-none placeholder:text-[#94A3B8] placeholder:font-bold"
                  />
                  <span className="pointer-events-none absolute left-[8px] top-1/2 -translate-y-1/2 opacity-60">
                    <Phone className="w-[12px] h-[12px] text-[#94A3B8]" />
                  </span>
                </div>
              </div>

              {/* منطقة الزبون */}
              <div className="flex flex-col gap-[6px] relative" ref={regionContainerRef}>
                <div className="flex items-center justify-between pr-[4px]">
                  <label className="text-[11px] font-black text-[#1E293B] flex items-center gap-[4px]">
                    <span className="w-[14px] h-[14px] rounded-[5px] bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center">
                      <MapPin className="w-[9px] h-[9px] text-[#0A3D2E]" />
                    </span>
                    منطقة الزبون
                  </label>
                  {selected && (
                    <span className="text-[9px] font-black bg-[#0A3D2E] text-[#F5D77F] px-[6px] py-[1px] rounded-full border border-[#C9A86A] flex items-center gap-[3px]">
                      {Number(selected.deliveryPrice) / ALF_PER_DINAR} الف توصيل
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    ref={regionSearchRef}
                    value={q}
                    onChange={(ev) => {
                      setQ(ev.target.value);
                      setShowRegionHits(true);
                      triggerTypingAnimation();
                    }}
                    onFocus={() => setShowRegionHits(true)}
                    placeholder="ابحث عن المنطقة..."
                    className={`focus-ring w-full h-[44px] rounded-[14px] border-[1.8px] bg-white pr-[10px] pl-[56px] text-[13px] font-black outline-none placeholder:text-[#94A3B8] ${
                      selected && q === selected.name
                        ? "border-[#0A3D2E] text-[#0A3D2E] font-black"
                        : "border-[#C9A86A]/40 text-[#1E293B]"
                    }`}
                  />
                  <div className="absolute left-[6px] top-1/2 -translate-y-1/2 flex items-center gap-[4px]">
                    {q && (
                      <button
                        type="button"
                        onClick={() => {
                          setQ("");
                          setSelected(null);
                          setHits([]);
                        }}
                        className="w-[22px] h-[22px] rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0]"
                      >
                        <X className="w-[12px] h-[12px]" />
                      </button>
                    )}
                    <div className="w-[22px] h-[22px] rounded-full bg-[#FFF8F0] border border-[#C9A86A]/30 flex items-center justify-center">
                      <MapPin className="w-[12px] h-[12px] text-[#0A3D2E]" />
                    </div>
                  </div>
                </div>

                {/* قائمة نتائج البحث */}
                {showRegionHits && hits.length > 0 && (
                  <div className="absolute z-[40] top-[64px] left-0 right-0 rounded-[18px] overflow-hidden border-[2px] border-[#C9A86A] bg-[#FFFEFB] shadow-[0_16px_40px_rgba(5,40,28,0.22)]">
                    <div className="bg-[#0A3D2E] px-[12px] py-[7px] flex items-center justify-between">
                      <span className="text-[#F5D77F] font-black text-[10px]">اختر المنطقة</span>
                      <span className="text-[#C9A86A] font-bold text-[9px]">{hits.length} نتائج</span>
                    </div>
                    <div className="max-h-[160px] overflow-auto divide-y divide-[#C9A86A]/10">
                      {hits.map((hit) => (
                        <button
                          key={hit.id}
                          type="button"
                          onClick={() => {
                            setSelected(hit);
                            setQ(hit.name);
                            setShowRegionHits(false);
                            setDeliveryPriceAdd(null);
                          }}
                          className="w-full flex items-center justify-between px-[12px] py-[10px] hover:bg-[#FFF8F0] text-right transition"
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-[13px] font-black text-[#1E293B]">{hit.name}</span>
                            <span className="text-[10px] font-bold text-[#0A3D2E]/70">
                              {Number(hit.deliveryPrice) / ALF_PER_DINAR} الف د.ع توصيل
                            </span>
                          </div>
                          <span className="text-[10px] font-black bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#0A3D2E] px-[8px] py-[3px] rounded-full">
                            اختيار
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* مناطق سابقة لهذا الزبون إن وجدت */}
            {previousRegions.length > 0 && (
              <div className="mt-[10px] rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/30 p-[8px]">
                <p className="text-[10px] font-black text-[#0A3D2E] mb-[6px] flex items-center gap-[4px]">
                  <Sparkles className="w-[10px] h-[10px] text-[#C9A86A]" />
                  مناطق سابقة لهذا الزبون:
                </p>
                <div className="flex flex-wrap gap-[6px]">
                  {previousRegions.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => {
                        setSelected(reg);
                        setQ(reg.name);
                        setShowRegionHits(false);
                      }}
                      className={`px-[10px] py-[5px] rounded-full text-[11px] font-black border transition flex items-center gap-[4px] ${
                        selected?.id === reg.id
                          ? "bg-[#0A3D2E] text-[#F5D77F] border-[#C9A86A]"
                          : "bg-white text-[#1E293B] border-[#C9A86A]/40 hover:bg-[#FFF8F0]"
                      }`}
                    >
                      <MapPin className="w-[10px] h-[10px]" />
                      {reg.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* السطر الثاني: نوع الطلب وسعر الطلب بجانب بعضهما */}
            <div className="grid grid-cols-2 gap-[10px] mt-[14px]">
              {/* نوع الطلب */}
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-black text-[#1E293B] pr-[4px]">
                  نوع الطلب
                </label>
                {/* اقتراحان سريعان من آخر طلبيتين مرفوعتين */}
                <div className="flex flex-wrap gap-[5px]">
                  {(recentOrderTypes.length > 0 ? recentOrderTypes.slice(0, 2) : ["طعام", "ملابس"]).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setOrderType(tag);
                        triggerTypingAnimation();
                      }}
                      className={`px-[8px] py-[3px] rounded-full text-[10px] font-black border transition ${
                        orderType === tag
                          ? "bg-[#0A3D2E] text-[#F5D77F] border-[#C9A86A]"
                          : "bg-[#FFF8F0] text-[#0A3D2E] border-[#C9A86A]/30"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    ref={orderTypeRef}
                    value={orderType}
                    onChange={(ev) => {
                      setOrderType(ev.target.value);
                      triggerTypingAnimation();
                    }}
                    placeholder="طعام، ملابس..."
                    className="focus-ring w-full h-[44px] rounded-[14px] border-[1.8px] border-[#C9A86A]/40 bg-white px-[12px] text-[13px] font-black text-[#1E293B] outline-none placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>

              {/* سعر الطلب */}
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-black text-[#1E293B] pr-[4px]">
                  سعر الطلب
                </label>
                {/* اقتراحان سريعان */}
                <div className="flex flex-wrap gap-[5px]">
                  {["15", "25"].map((priceTag) => (
                    <button
                      key={priceTag}
                      type="button"
                      onClick={() => {
                        setOrderPrice(priceTag);
                        triggerTypingAnimation();
                      }}
                      className={`px-[8px] py-[3px] rounded-full text-[10px] font-black border transition ${
                        orderPrice === priceTag
                          ? "bg-[#0A3D2E] text-[#F5D77F] border-[#C9A86A]"
                          : "bg-[#FFF8F0] text-[#0A3D2E] border-[#C9A86A]/30"
                      }`}
                    >
                      {priceTag} الف
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    ref={orderPriceRef}
                    value={orderPrice}
                    onChange={(ev) => {
                      setOrderPrice(ev.target.value.replace(/[^0-9.]/g, ""));
                      triggerTypingAnimation();
                    }}
                    placeholder="15"
                    inputMode="decimal"
                    className="focus-ring w-full h-[44px] rounded-[14px] border-[1.8px] border-[#C9A86A]/40 bg-white px-[12px] pl-[38px] text-center font-mono font-black text-[15px] text-[#1E293B] outline-none"
                  />
                  <span className="absolute left-[6px] top-1/2 -translate-y-1/2 h-[30px] px-[8px] rounded-[10px] bg-[#FFF8F0] border border-[#C9A86A]/30 flex items-center justify-center text-[10px] font-black text-[#0A3D2E]">
                    الف
                  </span>
                </div>
              </div>
            </div>

            {/* شريط الإجمالي وسعر الطلب الكلي المباشر */}
            {(orderPrice || selected) && (
              <div className="mt-[12px] rounded-[16px] bg-gradient-to-r from-[#05281C] via-[#0A3D2E] to-[#05281C] border-[1.5px] border-[#C9A86A] p-[10px] px-[14px] flex items-center justify-between shadow-[0_4px_16px_rgba(10,61,46,0.25)]">
                <div className="flex items-center gap-[8px]">
                  <div className="w-[28px] h-[28px] rounded-[8px] bg-[#F5D77F] flex items-center justify-center">
                    <CreditCard className="w-[14px] h-[14px] text-[#0A3D2E]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#F5D77F] font-black text-[12px] leading-[1]">
                      السعر الكلي للطلب
                    </span>
                    <span className="text-white/75 font-bold text-[10px] mt-[2px]">
                      الطلب: {(Number(orderPrice) || 0)} الف + التوصيل: {currentTotalDeliveryAlf} الف
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-[3px]">
                  <span className="text-[#F5D77F] font-black text-[18px] font-mono leading-[1]">
                    {(Number(orderPrice) || 0) + currentTotalDeliveryAlf}
                  </span>
                  <span className="text-white font-black text-[11px]">الف د.ع</span>
                </div>
              </div>
            )}

            {/* السطر الثالث: شوكت تحب نستلم الطلب */}
            <div className="mt-[14px] rounded-[18px] bg-[#FFF8F0] border-[1.5px] border-[#C9A86A]/30 p-[12px] flex items-center gap-[12px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
              <div className="w-[44px] h-[44px] rounded-[14px] bg-white border border-[#C9A86A]/30 shadow-sm flex items-center justify-center shrink-0">
                <Clock className="w-[20px] h-[20px] text-[#0A3D2E]" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-black text-[#0A3D2E] leading-[1]">
                  شوكت تحب نستلم الطلب
                </p>
                {/* اقتراحان سريعان من آخر طلبيتين مرفوعتين */}
                <div className="flex gap-[6px] mt-[6px]">
                  {(recentOrderTimes.length > 0 ? recentOrderTimes.slice(0, 2) : ["فوراً", "بعد ساعة"]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setOrderTime(t);
                        triggerTypingAnimation();
                      }}
                      className={`px-[8px] py-[2px] rounded-full border text-[10px] font-bold transition ${
                        orderTime === t
                          ? "bg-[#0A3D2E] text-[#F5D77F] border-[#C9A86A]"
                          : "bg-white border-[#C9A86A]/30 text-[#0A3D2E]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 max-w-[150px]">
                <input
                  ref={orderTimeRef}
                  value={orderTime}
                  onChange={(ev) => {
                    setOrderTime(ev.target.value);
                    triggerTypingAnimation();
                  }}
                  placeholder="الآن..."
                  className="focus-ring w-full h-[38px] rounded-[12px] border-[1.5px] border-[#C9A86A]/40 bg-white px-[10px] text-[12px] font-bold text-[#1E293B] outline-none"
                />
              </div>
            </div>

            {/* السطر الرابع: مفتاحا "كلشي واصل" و "طلب عكسي" */}
            <div className="mt-[14px] grid grid-cols-2 gap-[10px]">
              {/* كلشي واصل */}
              <div className="rounded-[16px] bg-[#FFF8F0] border border-[#C9A86A]/30 p-[10px] flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[12px] font-black text-[#1E293B] leading-[1]">
                    كلشي واصل
                  </span>
                  <span className="text-[10px] font-bold text-[#64748B] mt-[3px]">
                    مدفوع بالكامل
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrepaidAll(!isPrepaidAll)}
                  className={`relative w-[44px] h-[26px] rounded-full border transition-colors ${
                    isPrepaidAll
                      ? "bg-[#0A3D2E] border-[#C9A86A]/50"
                      : "bg-[#E2E8F0] border-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white border border-black/5 transition-all ${
                      isPrepaidAll ? "right-[2px]" : "right-[20px]"
                    }`}
                  />
                </button>
              </div>

              {/* طلب عكسي */}
              <div className="rounded-[16px] bg-[#FFF8F0] border border-[#C9A86A]/30 p-[10px] flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[12px] font-black text-[#1E293B] leading-[1]">
                    طلب عكسي
                  </span>
                  <span className="text-[10px] font-bold text-[#64748B] mt-[3px]">
                    إرجاع للمركز
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReverse(!isReverse)}
                  className={`relative w-[44px] h-[26px] rounded-full border transition-colors ${
                    isReverse
                      ? "bg-[#6D28D9] border-[#C9A86A]/50"
                      : "bg-[#E2E8F0] border-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white border border-black/5 transition-all ${
                      isReverse ? "right-[2px]" : "right-[20px]"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* القائمة المنسدلة: تفاصيل أخرى (اختياري) */}
            <div className="mt-[14px] rounded-[18px] overflow-hidden border border-[#C9A86A]/30 bg-gradient-to-r from-[#FFFEFB] via-[#FFF8F0] to-[#FDF6E8] p-[1px]">
              <button
                type="button"
                onClick={() => setIsOtherDetailsOpen(!isOtherDetailsOpen)}
                className="w-full h-[46px] px-[14px] bg-white flex items-center justify-between rounded-[17px] hover:bg-[#FFF8F0] transition"
              >
                <div className="flex items-center gap-[8px]">
                  <div className="w-[20px] h-[20px] rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#C9A86A]" />
                  </div>
                  <span className="text-[12px] font-black text-[#0A3D2E]">
                    تفاصيل أخرى (اختياري)
                  </span>
                </div>
                <div className="flex items-center gap-[8px]">
                  <span className="text-[10px] font-bold text-[#8B6B2A] bg-white border border-[#C9A86A]/30 px-[8px] py-[2px] rounded-full">
                    {isOtherDetailsOpen ? "إخفاء" : "عرض"}
                  </span>
                  <span
                    className={`w-[24px] h-[24px] rounded-full bg-[#0A3D2E] text-[#F5D77F] flex items-center justify-center transition-transform ${
                      isOtherDetailsOpen ? "rotate-180" : ""
                    }`}
                  >
                    <ChevronDown className="w-[14px] h-[14px]" />
                  </span>
                </div>
              </button>

              {isOtherDetailsOpen && (
                <div className="p-[12px] grid grid-cols-1 gap-[12px] bg-[#FFFEFB]/80">
                  {/* رفع أجر التوصيل ورقم ثاني */}
                  <div className="grid grid-cols-2 gap-[10px]">
                    {/* رفع أجر التوصيل */}
                    <div className="rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/20 p-[10px]">
                      <p className="text-[11px] font-black text-[#1E293B] mb-[8px]">
                        رفع أجر التوصيل
                      </p>
                      <div className="flex items-center justify-between gap-[8px]">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = deliveryPriceAdd !== null ? deliveryPriceAdd : baseDeliveryAlf;
                            setDeliveryPriceAdd(Math.max(0, cur - 1));
                          }}
                          className="w-[34px] h-[34px] rounded-[10px] bg-white border border-[#C9A86A]/40 text-[#0A3D2E] font-black text-[16px] shadow-sm active:scale-95"
                        >
                          -
                        </button>
                        <div className="flex-1 h-[34px] rounded-[10px] bg-white border border-[#C9A86A]/30 flex items-center justify-center font-mono font-black text-[13px] text-[#0A3D2E]">
                          {currentTotalDeliveryAlf} الف
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = deliveryPriceAdd !== null ? deliveryPriceAdd : baseDeliveryAlf;
                            setDeliveryPriceAdd(cur + 1);
                          }}
                          className="w-[34px] h-[34px] rounded-[10px] bg-[#0A3D2E] border border-[#C9A86A] text-[#F5D77F] font-black text-[16px] shadow-sm active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* رقم ثاني للزبون */}
                    <div className="rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/20 p-[10px]">
                      <p className="text-[11px] font-black text-[#1E293B] mb-[8px]">رقم ثاني</p>
                      <input
                        value={alternatePhone}
                        onChange={(ev) => setAlternatePhone(ev.target.value)}
                        placeholder="07XXXXXXXX"
                        className="focus-ring w-full h-[34px] rounded-[10px] border border-[#C9A86A]/30 bg-white px-[10px] text-[12px] font-mono font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* نوع المركبة المفضلة */}
                  <div>
                    <p className="text-[11px] font-black text-[#1E293B] mb-[8px]">
                      نوع المركبة المفضلة
                    </p>
                    <div className="grid grid-cols-3 gap-[8px]">
                      {[
                        { id: "auto", label: "تلقائي", Icon: Navigation },
                        { id: "bike", label: "دراجة", Icon: Bike },
                        { id: "car", label: "سيارة", Icon: Car },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setVehiclePreference(item.id)}
                          className={`rounded-[14px] border-[1.8px] p-[10px] flex flex-col items-center gap-[6px] transition ${
                            vehiclePreference === item.id
                              ? "bg-[#0A3D2E] border-[#C9A86A] shadow-[0_6px_16px_rgba(10,61,46,0.25)] text-[#F5D77F]"
                              : "bg-[#FFF8F0] border-[#C9A86A]/25 text-[#1E293B]"
                          }`}
                        >
                          <item.Icon className="w-[18px] h-[18px]" />
                          <span
                            className={`text-[11px] font-black ${
                              vehiclePreference === item.id ? "text-[#F5D77F]" : "text-[#1E293B]"
                            }`}
                          >
                            {item.label}
                          </span>
                          {vehiclePreference === item.id && (
                            <span className="w-[18px] h-[18px] rounded-full bg-[#F5D77F] flex items-center justify-center">
                              <Check className="w-[10px] h-[10px] text-[#0A3D2E] stroke-[3]" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* صورة الطلب */}
                  <div>
                    <p className="text-[11px] font-black text-[#1E293B] mb-[8px]">صورة الطلب</p>
                    <div className="grid grid-cols-2 gap-[8px]">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-[42px] rounded-[12px] border-[1.5px] border-dashed border-[#C9A86A] bg-[#FFF8F0] flex items-center justify-center gap-[6px] text-[12px] font-black text-[#0A3D2E] active:scale-[0.98]"
                      >
                        <Camera className="w-[16px] h-[16px]" />
                        كاميرا
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-[42px] rounded-[12px] border-[1.5px] border-dashed border-[#C9A86A] bg-[#FFF8F0] flex items-center justify-center gap-[6px] text-[12px] font-black text-[#0A3D2E] active:scale-[0.98]"
                      >
                        <ImageIcon className="w-[16px] h-[16px]" />
                        المعرض
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="orderImage"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />

                    {imagePreview ? (
                      <div className="mt-[10px] relative rounded-[16px] overflow-hidden border-[1.5px] border-[#C9A86A]/40">
                        <img
                          src={imagePreview}
                          alt="معاينة الطلب"
                          className="w-full h-[140px] object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setImagePreview(null)}
                          className="absolute top-[8px] right-[8px] w-[26px] h-[26px] rounded-full bg-[#0A3D2E] text-white flex items-center justify-center"
                        >
                          <X className="w-[14px] h-[14px]" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-[10px] h-[72px] rounded-[14px] border-[1.2px] border-dashed border-[#C9A86A]/40 bg-[#FFFEFB] flex items-center justify-center gap-[8px] text-[#94A3B8]">
                        <ImageIcon className="w-[18px] h-[18px]" />
                        <span className="text-[11px] font-bold">لم يتم اختيار صورة</span>
                      </div>
                    )}
                  </div>

                  {/* ملاحظة صوتية */}
                  <div>
                    <ClientVoiceNoteField />
                  </div>

                  {/* ملاحظة كتابية للمندوب */}
                  <div>
                    <p className="text-[11px] font-black text-[#1E293B] mb-[6px]">
                      ملاحظة كتابية للمندوب
                    </p>
                    <textarea
                      name="notes"
                      value={notes}
                      onChange={(ev) => setNotes(ev.target.value)}
                      rows={3}
                      placeholder="اكتب تعليمات إضافية للمندوب..."
                      className="focus-ring w-full rounded-[14px] border-[1.5px] border-[#C9A86A]/30 bg-[#FFF8F0] p-[10px] text-[12px] font-bold text-[#1E293B] outline-none resize-none placeholder:text-[#94A3B8]"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* الزر العائم لرفع الطلب بالختم الملكي الذهبي الفاخر AK */}
      <button
        ref={fabRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => handleSubmitAttempt()}
        disabled={pending}
        style={{
          left: `${floatingPos.x}px`,
          top: `${floatingPos.y}px`,
          touchAction: "none",
          animation: isDragging
            ? "none"
            : showNewBtnHint
            ? "fabGlow 1.2s ease-in-out infinite"
            : isUserTyping
            ? "typingDance 0.5s ease-in-out infinite, fabGlow 2.8s ease-in-out infinite"
            : "fabFloat 2.8s ease-in-out infinite, fabGlow 2.8s ease-in-out infinite",
        }}
        className={`fixed z-[60] w-[96px] h-[96px] sm:w-[104px] sm:h-[104px] rounded-full flex flex-col items-center justify-center select-none active:scale-[0.95] transition-transform duration-150 bg-transparent border-0 p-0 ${
          showNewBtnHint ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-[#0A3D2E] scale-105" : ""
        } ${
          isDragging
            ? "cursor-grabbing scale-[1.08] filter drop-shadow-[0_0_24px_rgba(201,168,106,0.9)]"
            : "cursor-grab"
        }`}
      >
        {/* صورة الختم الملكي الذهبي AK المفرغة بدقة ووضوح عالي مع عبارة رفع الطلب المدمجة */}
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/images/order-luxury/ak-submit-btn-v3.webp"
            alt="رفع الطلب"
            fill
            priority
            unoptimized
            className="object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
          />
        </div>

        {/* مؤشر التحميل أثناء الرفع */}
        {pending && (
          <div className="absolute inset-0 rounded-full bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-20 pointer-events-none">
            <Loader2 className="w-[38px] h-[38px] text-[#F5D77F] animate-spin" />
          </div>
        )}
      </button>

      {/* نافذة التنبيه الإرشادية لزر رفع الطلب الجديد */}
      {showNewBtnHint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-[16px] bg-[#05281C]/75 backdrop-blur-[8px] animate-in fade-in duration-300" dir="rtl">
          <div className="relative w-full max-w-[350px] rounded-[30px] border-[2.5px] border-[#C9A86A] bg-gradient-to-b from-[#FFFEFB] via-[#FFFDF7] to-[#FAF6EE] p-[24px] text-center shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
            {/* أيقونة الختم الملكي مع هالة ذهبية */}
            <div className="relative mx-auto w-[92px] h-[92px] rounded-full p-1 bg-gradient-to-b from-[#FAF0D7] to-[#E8D39E] border-2 border-[#C9A86A] flex items-center justify-center shadow-lg mb-[14px]">
              <div className="relative w-full h-full rounded-full overflow-hidden">
                <Image
                  src="/images/order-luxury/ak-submit-btn-v3.webp"
                  alt="زر رفع الطلب الجديد"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#0A3D2E] border border-[#F5D77F] text-white flex items-center justify-center text-xs shadow-md">
                👑
              </div>
            </div>

            <h3 className="text-[17px] font-black text-[#0A3D2E] tracking-tight">
              زر رفع الطلب الجديد 👑
            </h3>
            
            <p className="text-[12.5px] font-bold text-[#475569] mt-[8px] leading-[1.6] px-2">
              هذا هو زر رفع الطلبيات الجديد! يمكنك النقر عليه فور اكتمال البيانات، أو سحبه وتحريكه بحرية إلى أي مكان يريحك على الشاشة.
            </p>

            <div className="mt-[18px]">
              <button
                type="button"
                onClick={handleAcknowledgeBtnHint}
                className="w-full h-[48px] rounded-[16px] bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0F4D3A] border-2 border-[#C9A86A] text-[#F5D77F] font-black text-[15px] shadow-[0_4px_16px_rgba(10,61,46,0.35),inset_0_1px_0_rgba(245,215,127,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>حسناً، فهمت</span>
                <span className="text-base">👍</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تنبيه نقص الحقول */}
      {fieldErrorModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-[16px] bg-[#05281C]/60 backdrop-blur-[10px]">
          <div className="w-full max-w-[340px] rounded-[28px] border-[2px] border-[#C9A86A] bg-[#FFFEFB] p-[22px] text-center shadow-[0_24px_64px_rgba(0,0,0,0.35)] animate-in fade-in zoom-in-95">
            <div className="mx-auto w-[64px] h-[64px] rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center shadow-inner mb-[14px]">
              <AlertCircle className="w-[32px] h-[32px] text-[#C9A86A]" />
            </div>
            <h3 className="text-[16px] font-black text-[#0A3D2E]">
              {fieldErrorModal.title}
            </h3>
            <p className="text-[13px] font-bold text-[#475569] mt-[6px] leading-[1.5]">
              {fieldErrorModal.message}
            </p>
            <button
              type="button"
              onClick={() => {
                const ref = fieldErrorModal.targetRef;
                setFieldErrorModal(null);
                setTimeout(() => {
                  ref?.current?.focus();
                  ref?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
              className="mt-[16px] w-full h-[46px] rounded-[14px] bg-[#0A3D2E] border border-[#C9A86A] text-[#F5D77F] font-black text-[14px] shadow-md active:scale-95 transition"
            >
              حسناً، سأكمل الحقل
            </button>
          </div>
        </div>
      )}

      {/* نافذة تأكيد الإرسال بدون سعر */}
      {showNoPriceConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-[16px] bg-[#05281C]/55 backdrop-blur-[8px]">
          <div className="w-full max-w-[340px] rounded-[28px] border-[2px] border-[#C9A86A] bg-[#FFFEFB] p-[20px] text-center shadow-xl animate-in fade-in zoom-in-95">
            <div className="mx-auto w-[56px] h-[56px] rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center shadow-inner mb-[12px]">
              <span className="w-[10px] h-[10px] rounded-full bg-[#C9A86A]" />
            </div>
            <h3 className="text-[15px] font-black text-[#0A3D2E]">بدون سعر طلب</h3>
            <p className="text-[12px] font-bold text-[#475569] mt-[6px] leading-[1.5]">
              لم تدخل سعراً للطلب، هل تود الإرسال وترك التسعير لاحقاً للإدارة؟
            </p>
            <div className="mt-[14px] grid gap-[8px]">
              <button
                type="button"
                onClick={() => {
                  setShowNoPriceConfirm(false);
                  formRef.current?.requestSubmit();
                }}
                className="w-full h-[44px] rounded-[14px] bg-[#0A3D2E] border border-[#C9A86A] text-[#F5D77F] font-black text-[13px] shadow-sm active:scale-95 transition"
              >
                نعم، إرسال الطلب الآن
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNoPriceConfirm(false);
                  orderPriceRef.current?.focus();
                }}
                className="w-full h-[42px] rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/40 text-[#334155] font-black text-[13px] active:scale-95 transition"
              >
                تعديل السعر أولاً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة نجاح رفع الطلب */}
      {showSuccessModal && lastSubmittedOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-[16px] bg-[#05281C]/65 backdrop-blur-[12px]">
          <div className="w-full max-w-[360px] rounded-[28px] border-[2px] border-[#C9A86A] bg-[#FFFEFB] p-[24px] text-center shadow-[0_24px_64px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95">
            <div className="mx-auto w-[72px] h-[72px] rounded-full bg-[#0A3D2E] border-[2px] border-[#F5D77F] flex items-center justify-center shadow-lg mb-[12px]">
              <Check className="w-[32px] h-[32px] text-[#F5D77F] stroke-[3]" />
            </div>
            <h2 className="text-[18px] font-black text-[#0A3D2E]">تم رفع الطلب بنجاح</h2>
            <p className="text-[12px] font-bold text-[#475569] mt-[8px] leading-[1.6]">
              تم حفظ وإرسال تفاصيل طلبك للإدارة بنجاح، سيتم إسناد المندوب والتوصيل قريباً
            </p>

            <div className="mt-[16px] rounded-[16px] bg-[#FFF8F0] border border-[#C9A86A]/30 p-[10px] grid grid-cols-3 text-center divide-x divide-[#C9A86A]/20 divide-x-reverse">
              <div>
                <p className="text-[9px] font-bold text-[#94A3B8]">الزبون</p>
                <p className="text-[11px] font-black text-[#1E293B] mt-[2px]">
                  {lastSubmittedOrder.phone.slice(-4) || "-"}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-[#94A3B8]">المنطقة</p>
                <p className="text-[11px] font-black text-[#1E293B] mt-[2px] truncate px-[4px]">
                  {lastSubmittedOrder.regionName || "-"}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-[#94A3B8]">الإجمالي</p>
                <p className="text-[13px] font-black text-[#8B6B2A] mt-[2px]">
                  {lastSubmittedOrder.totalAlf} الف
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetFormForNew}
              className="mt-[14px] w-full h-[46px] rounded-[14px] bg-gradient-to-r from-[#05281C] via-[#0A3D2E] to-[#05281C] border border-[#C9A86A] text-[#F5D77F] font-black text-[14px] shadow-md active:scale-95 transition"
            >
              رفع طلب جديد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
