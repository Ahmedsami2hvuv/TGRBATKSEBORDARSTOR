"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import {
  uploadPreparerPortalOrderImage,
  uploadPreparerPortalShopDoorPhoto,
} from "./actions";

const ACCEPT = "image/jpeg,image/png,image/webp";

type Auth = { p: string; exp: string; s: string };

export function PreparerDetailPhotoUploadRow({
  auth,
  orderId,
  field,
  onUploaded,
}: {
  auth: Auth;
  orderId: string;
  field: "orderImage" | "shopDoorPhoto";
  onUploaded?: (newUrl: string, uploaderName?: string) => void;
}) {
  const router = useRouter();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submitFile(file: File) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      let toSend = file;
      try {
        toSend = await compressImageFileForUpload(file);
      } catch {
        /* الملف الأصلي */
      }
      const fd = new FormData();
      fd.set("p", auth.p);
      fd.set("exp", auth.exp);
      fd.set("s", auth.s);
      fd.set("orderId", orderId);
      if (field === "orderImage") fd.set("orderImage", toSend);
      else fd.set("shopDoorPhoto", toSend);

      const res =
        field === "orderImage"
          ? await uploadPreparerPortalOrderImage({}, fd)
          : await uploadPreparerPortalShopDoorPhoto({}, fd);

      if (res?.error) {
        setError(res.error);
      } else {
        const uploadedUrl = res?.imageUrl || res?.shopDoorPhotoUrl;
        if (uploadedUrl && onUploaded) {
          onUploaded(uploadedUrl, res?.uploaderName);
        }
        setSuccess(field === "orderImage" ? "تم رفع صورة الطلبية بنجاح ✓" : "تم رفع صورة باب المحل بنجاح ✓");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError("تعذر رفع الصورة، يرجى المحاولة مجدداً.");
    } finally {
      setBusy(false);
      if (camRef.current) camRef.current.value = "";
      if (galRef.current) galRef.current.value = "";
    }
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await submitFile(f);
  }

  const fieldLabel = field === "orderImage" ? "صورة الطلبية" : "صورة باب المحل";
  const camInputId = `prep-cam-${orderId}-${field}`;
  const galInputId = `prep-gal-${orderId}-${field}`;

  return (
    <div className="mt-3 space-y-2 select-none" dir="rtl">
      {/* مدخلات الكاميرا والمعرض المباشرة للجهاز */}
      <input
        id={camInputId}
        ref={camRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={onPick}
      />
      <input
        id={galInputId}
        ref={galRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={onPick}
      />
      <div className="grid grid-cols-2 gap-2">
        {/* زر الكاميرا الملكي الزمردي المباشر */}
        <button
          type="button"
          disabled={busy}
          onClick={() => camRef.current?.click()}
          aria-label={`التقاط ${fieldLabel} بالكاميرا`}
          className={`h-[38px] rounded-[11px] bg-gradient-to-b from-[#0E3D2B] via-[#0A3525] to-[#07281C] border border-[#C9A86A] text-[#E8C77E] hover:text-[#FFF8E1] hover:border-[#E8C77E] flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(10,46,32,0.3),inset_0_1px_0_rgba(232,199,126,0.2)] active:scale-95 transition-all cursor-pointer font-black text-[12px] sm:text-[13px] ${
            busy ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <svg
            className="w-4 h-4 shrink-0 text-[#E8C77E]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3.2" />
          </svg>
          <span>كاميرا</span>
        </button>

        {/* زر المعرض الملكي العاجي المذهب المباشر */}
        <button
          type="button"
          disabled={busy}
          onClick={() => galRef.current?.click()}
          aria-label={`اختيار ${fieldLabel} من المعرض`}
          className={`h-[38px] rounded-[11px] bg-gradient-to-b from-[#FFFDF9] via-[#FBF4E4] to-[#F3E7CA] border border-[#C9A86A] text-[#0A3D2E] hover:text-[#000] hover:border-[#8B6A2A] flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(201,168,106,0.25),inset_0_1px_0_white] active:scale-95 transition-all cursor-pointer font-black text-[12px] sm:text-[13px] ${
            busy ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <svg
            className="w-4 h-4 shrink-0 text-[#8B6A2A]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="3" ry="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span>المعرض</span>
        </button>
      </div>

      {busy ? (
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#8B6A2A] pt-1">
          <div className="w-3.5 h-3.5 border-2 border-[#C9A86A] border-t-transparent rounded-full animate-spin" />
          <span>جارٍ رفع الصورة...</span>
        </div>
      ) : null}
      {error ? <p className="text-center text-xs font-bold text-rose-600 bg-rose-50 py-1 px-2 rounded-lg border border-rose-200">{error}</p> : null}
      {success ? <p className="text-center text-xs font-black text-emerald-700 bg-emerald-50 py-1 px-2 rounded-lg border border-emerald-300 animate-in fade-in">{success}</p> : null}
    </div>
  );
}
