"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Loader2 } from "lucide-react";
import { assignFileToInput, compressImageFileForUpload } from "@/lib/client-image-compress";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { updatePreparerOrderFields, type PreparerActionState } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

const initial: PreparerActionState = {};

export function PreparerOrderEditForm({
  auth,
  orderId,
  defaults,
}: {
  auth: { p: string; exp: string; s: string };
  orderId: string;
  defaults: {
    orderType: string;
    customerPhone: string;
    orderSubtotalAlf: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updatePreparerOrderFields, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  // موضع زر التحديث العائم
  const STORAGE_KEY_PREP_UPDATE_BTN = "kse_preparer_update_order_btn_pos";
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number }>({ x: 20, y: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREP_UPDATE_BTN);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(10, window.innerWidth - 100);
          const maxY = Math.max(10, window.innerHeight - 100);
          const clampedX = Math.max(10, Math.min(parsed.x, maxX));
          const clampedY = Math.max(10, Math.min(parsed.y, maxY));
          setFloatingPos({ x: clampedX, y: clampedY });
          return;
        }
      }
      const defaultX = Math.max(15, window.innerWidth - 110);
      const defaultY = Math.max(15, window.innerHeight - 150);
      setFloatingPos({ x: defaultX, y: defaultY });
    } catch {}
  }, []);

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
      localStorage.setItem(STORAGE_KEY_PREP_UPDATE_BTN, JSON.stringify(floatingPos));
    } catch {}
  };

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  async function onPickImageFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const out = await compressImageFileForUpload(f);
      assignFileToInput(input, out);
    } catch {
      assignFileToInput(input, f);
    }
  }

  useEffect(() => {
    if (state?.ok && formRef.current) {
      formRef.current.reset();
    }
  }, [state?.ok]);

  const homeHref = preparerPath("/preparer", auth);

  if (state?.ok) {
    return (
      <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center">
        <div className="flex justify-center mb-4">
          <DynamicIcon
            iconKey="ui_success"
            config={icons}
            className="h-12 w-12 text-emerald-600"
            fallback={<span className="text-4xl">✓</span>}
          />
        </div>
        <h2 className="mt-3 text-xl font-bold text-emerald-800">تم حفظ التعديلات</h2>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={homeHref}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            العودة للطلبات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="p" value={auth.p} />
      <input type="hidden" name="exp" value={auth.exp} />
      <input type="hidden" name="s" value={auth.s} />
      <input type="hidden" name="orderId" value={orderId} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">نوع الطلب *</span>
        <input
          name="orderType"
          required
          defaultValue={defaults.orderType}
          className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm"
        />
      </label>



      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">سعر الطلب </span>
        <input
          name="orderSubtotal"
          defaultValue={defaults.orderSubtotalAlf}
          className="rounded-xl border-2 border-slate-400 bg-amber-50/50 px-3 py-2.5 text-base font-bold text-slate-900 shadow-inner focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="اتركه فارغاً لعدم التغيير"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">تفضيل المركبة</span>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "none", label: "تلقائي", icon: "⚙️" },
            { id: "bike", label: "دراجة", icon: "🏍️" },
            { id: "car", label: "سيارة", icon: "🚗" },
          ].map((v) => (
            <label
              key={v.id}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-slate-200 bg-white p-2 transition hover:border-sky-300"
            >
              <input
                type="radio"
                name="vehiclePreference"
                value={v.id === "none" ? "" : v.id}
                className="hidden"
                defaultChecked={v.id === "none"}
              />
              <span className="text-xl">{v.icon}</span>
              <span className="text-[10px] font-bold">{v.label}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">تعديل سعر التوصيل الأساسي (اختياري)</span>
        <input
          name="deliveryPriceOverride"
          className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm font-mono"
          placeholder="مثلاً: 3"
        />
        <p className="text-[10px] text-slate-500">* بالألف. سيتم مقارنته بسعر المحل واعتماد الأكبر.</p>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">صورة الطلبية (استبدال)</span>
        <input
          name="orderImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
          onChange={onPickImageFile}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">صورة باب المحل (استبدال)</span>
        <input
          name="shopDoorPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="text-sm"
          onChange={onPickImageFile}
        />
      </label>

      {state?.error ? <p className="text-sm font-bold text-rose-700">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
      </button>
      {pending ? (
        <p className="text-center text-xs leading-relaxed text-slate-500">
          قد يستغرق الحفظ وقتاً أطول مع الصور؛ انتظر ولا تغلق الصفحة.
        </p>
      ) : null}

      {/* الزر العائم الملكي لتحديث وحفظ الطلب للمجهز */}
      <button
        ref={fabRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => {
          if (!pending) {
            formRef.current?.requestSubmit();
          }
        }}
        disabled={pending}
        style={{
          left: `${floatingPos.x}px`,
          top: `${floatingPos.y}px`,
          touchAction: "none",
        }}
        className={`fixed z-[90] w-[94px] h-[94px] sm:w-[102px] sm:h-[102px] rounded-full flex flex-col items-center justify-center select-none active:scale-[0.95] transition-transform duration-150 bg-transparent border-0 p-0 ${
          isDragging
            ? "cursor-grabbing scale-[1.08] filter drop-shadow-[0_0_24px_rgba(201,168,106,0.9)]"
            : "cursor-grab animate-[fabFloat_3s_ease-in-out_infinite,fabGlow_3s_ease-in-out_infinite]"
        }`}
        title="تحديث الطلب"
      >
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/images/order-luxury/ak-update-order-btn.webp"
            alt="تحديث الطلب"
            fill
            priority
            unoptimized
            className="object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
          />
        </div>

        {pending && (
          <div className="absolute inset-0 rounded-full bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-20 pointer-events-none">
            <Loader2 className="w-[38px] h-[38px] text-[#F5D77F] animate-spin" />
          </div>
        )}
      </button>
    </form>
  );
}
