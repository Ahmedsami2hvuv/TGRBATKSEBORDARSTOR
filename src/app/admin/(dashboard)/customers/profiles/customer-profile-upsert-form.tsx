"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { type AdminRegionOption } from "@/components/admin-region-search-picker";
import {
  compressImageForMandoubUpload,
  assignFileToInput,
} from "@/lib/client-image-compress";
import {
  upsertCustomerPhoneProfile,
  getCustomerProfileFormHint,
  type CustomerProfileFormHint,
  type CustomerProfileFormState,
} from "./actions";

const initial: CustomerProfileFormState = {};

const initialHint: CustomerProfileFormHint = {
  canCheck: false,
  regionResolved: false,
  currentRegionName: null,
  inCurrentRegion: false,
  currentRegionMissingPhoto: false,
  otherRegionNames: [],
};

export function CustomerProfileUpsertForm({
  regions,
}: {
  regions: AdminRegionOption[];
}) {
  const [state, formAction, pending] = useActionState(
    upsertCustomerPhoneProfile,
    initial,
  );
  
  const formRef = useRef<HTMLFormElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  const [rawText, setRawText] = useState("");
  const [hint, setHint] = useState<CustomerProfileFormHint>(initialHint);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [remotePhotoUrlInput, setRemotePhotoUrlInput] = useState("");
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setRawText("");
      setHint(initialHint);
      setSelectedPhoto(null);
      setRemotePhotoUrlInput("");
      setDragActive(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.ok, state.timestamp]);

  useEffect(() => {
    let active = true;
    const t = rawText.trim();
    if (!t) {
      setHint(initialHint);
      setIsChecking(false);
      return;
    }
    setIsChecking(true);
    getCustomerProfileFormHint(rawText).then((h) => {
      if (active) {
        setHint(h);
        setIsChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [rawText]);

  const handleChoosePhoto = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleDroppedOrSelectedFile(file);
  };

  const handleDroppedOrSelectedFile = async (file: File) => {
    try {
      const compressed = await compressImageForMandoubUpload(file);
      assignFileToInput(photoInputRef.current!, compressed);
      setSelectedPhoto(compressed);
      setRemotePhotoUrlInput("");
    } catch (err) {
      console.error("خطأ في ضغط الصورة:", err);
      assignFileToInput(photoInputRef.current!, file);
      setSelectedPhoto(file);
      setRemotePhotoUrlInput("");
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await handleDroppedOrSelectedFile(droppedFile);
      return;
    }

    const textUriList = e.dataTransfer.getData("text/uri-list")?.trim();
    const plainText = e.dataTransfer.getData("text/plain")?.trim();
    const urlText = textUriList || plainText;
    if (urlText && /^https?:\/\//i.test(urlText)) {
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      setSelectedPhoto(null);
      setRemotePhotoUrlInput(urlText.trim());
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawText(text);
    } catch (err) {
      alert('فشل في اللصق. تأكد من السماح بالوصول للحافظة أو استخدم Ctrl+V.');
    }
  };

  if (regions.length === 0) {
    return (
      <p className={ad.warn}>
        أضف منطقة واحدة على الأقل من صفحة «المناطق» قبل حفظ تفاصيل الزبائن.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="space-y-6"
    >
      <div className="space-y-6">
        <div
          className={
            "sticky top-0 z-30 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 " +
            "bg-slate-100 dark:bg-slate-800/95 p-4 rounded-xl border border-slate-200 dark:border-slate-600 " +
            "shadow-sm backdrop-blur-sm"
          }
        >
          <div className="shrink-0 sm:pt-0.5">
            <button
              type="submit"
              disabled={pending}
              className={`${ad.btnPrimary} w-full sm:w-auto text-lg py-3 px-8 shadow-md`}
            >
              {pending ? "جارٍ الحفظ…" : "حفظ البيانات"}
            </button>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {state.error ? (
              <p className={`${ad.error} mb-0`} role="alert">
                {state.error}
              </p>
            ) : null}
            {state.ok ? (
              <p className={`${ad.success} mb-0`}>تم حفظ الزبون بنجاح، الصفحة تمت إعادة تعيينها.</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {selectedPhoto ? (
                <span className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 px-3 py-2 rounded-md border border-green-300 dark:border-green-700 text-sm font-medium">
                  <span className="text-lg leading-none">✓</span>
                  <span>تم اختيار صورة: {selectedPhoto.name}</span>
                </span>
              ) : null}
              {isChecking ? (
                <span className="text-sm font-bold text-sky-600 dark:text-sky-400 animate-pulse">
                  جاري التحقق من الرقم والمنطقة...
                </span>
              ) : null}
              {!isChecking && hint.regionNotFound ? (
                <span className="text-sm text-amber-800 dark:text-amber-200 font-bold bg-amber-100 dark:bg-amber-950/50 px-3 py-1 rounded-md border border-amber-300 dark:border-amber-700 inline-block shadow-sm max-w-full">
                  ⚠️ المنطقة «{hint.regionNotFound}» غير موجودة في القائمة. صحّح الاسم كما في صفحة المناطق.
                </span>
              ) : null}
              {!isChecking &&
              hint.regionResolved &&
              hint.inCurrentRegion &&
              hint.currentRegionMissingPhoto &&
              !selectedPhoto &&
              !remotePhotoUrlInput.trim() ? (
                <span className="text-sm text-amber-800 dark:text-amber-200 font-bold bg-amber-100 dark:bg-amber-950/50 px-3 py-2 rounded-md border border-amber-300 dark:border-amber-700 inline-block shadow-sm max-w-full">
                  هذا الزبون موجود في منطقة «{hint.currentRegionName}» لكن بلا صورة. أرفق صورة أو رابط ثم احفظ لتحديث
                  السجل.
                </span>
              ) : null}
              {!isChecking &&
              hint.regionResolved &&
              !hint.inCurrentRegion &&
              hint.otherRegionNames.length > 0 ? (
                <span className="text-sm text-sky-900 dark:text-sky-100 font-bold bg-sky-100 dark:bg-sky-950/50 px-3 py-2 rounded-md border border-sky-300 dark:border-sky-700 inline-block shadow-sm max-w-full">
                  هذا الزبون مسجّل في منطقة/مناطق: {hint.otherRegionNames.join("، ")}. يمكنك حفظ البيانات لإضافته أيضاً
                  إلى «{hint.currentRegionName}».
                </span>
              ) : null}
              {!isChecking &&
              hint.regionResolved &&
              hint.inCurrentRegion &&
              (!hint.currentRegionMissingPhoto || !!selectedPhoto || !!remotePhotoUrlInput.trim()) ? (
                <span className="text-sm text-slate-700 dark:text-slate-200 font-bold bg-slate-200/80 dark:bg-slate-700/80 px-3 py-1 rounded-md border border-slate-300 dark:border-slate-600 inline-block shadow-sm">
                  {hint.otherRegionNames.length > 0
                    ? `مسجّل أيضاً في: ${hint.otherRegionNames.join("، ")}. `
                    : ""}
                  سيتم تحديث بيانات الزبون في «{hint.currentRegionName}» عند الحفظ.
                </span>
              ) : null}
              {!isChecking &&
              hint.regionResolved &&
              !hint.inCurrentRegion &&
              hint.otherRegionNames.length === 0 ? (
                <span className="text-sm text-green-700 dark:text-green-300 font-bold bg-green-100 dark:bg-green-950/50 px-3 py-1 rounded-md border border-green-300 dark:border-green-700 inline-block shadow-sm">
                  ✓ الرقم جديد لمنطقة «{hint.currentRegionName}».
                </span>
              ) : null}
              {!isChecking && hint.canCheck && !hint.regionResolved && !hint.regionNotFound ? (
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  أدخل اسم المنطقة في السطر «المنطقة: …» لإكمال التحقق.
                </span>
              ) : null}
              {!isChecking &&
              hint.regionResolved &&
              (hint.inCurrentRegion || hint.otherRegionNames.length > 0) ? (
                <button
                  type="button"
                  onClick={() => {
                    setRawText("");
                    setRemotePhotoUrlInput("");
                    setSelectedPhoto(null);
                    if (photoInputRef.current) photoInputRef.current.value = "";
                    formRef.current?.reset();
                  }}
                  className="text-sm bg-slate-500 text-white hover:bg-slate-600 px-3 py-2 rounded-md shadow-sm transition-colors"
                >
                  تصفير المربع
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 bg-sky-50 rounded-xl border border-sky-200 shadow-sm">
          <div
            className={`rounded-xl border-2 border-dashed p-4 bg-white transition-colors ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
          >
            <div className="space-y-2 text-sm">
              <input
                type="url"
                name="remoteImageUrl"
                value={remotePhotoUrlInput}
                onChange={(e) => setRemotePhotoUrlInput(e.target.value)}
                placeholder="رابط صورة مباشر (اختياري)"
                className={`${ad.input} w-full bg-white`}
                dir="ltr"
              />
              {remotePhotoUrlInput.trim() && !selectedPhoto ? (
                <p className="text-slate-600 text-xs">
                  يُنزَّل ويُرفَع إلى التخزين تلقائياً عند الضغط على «حفظ البيانات».
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex gap-2 items-end">
              <textarea
                name="rawText"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                className={`${ad.input} flex-1 min-h-[8rem] resize-y bg-white font-normal`}
                placeholder="مثال:&#10;المنطقة: باب عباس&#10;لكيشن الزبون: https://maps.app.goo.gl/...&#10;اقرب نقطة دالة: نهاية باب عباس&#10;رقم الهاتف: 077xxxxxxxx&#10;رقم الهاتف الآخر: 077xxxxxxxx"
                dir="auto"
              />
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleChoosePhoto}
                  className="bg-slate-600 text-white hover:bg-slate-700 px-4 py-2 rounded-md shadow-sm transition-colors text-sm font-medium"
                >
                  صورة
                </button>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="bg-blue-500 text-white hover:bg-blue-600 px-4 py-2 rounded-md shadow-sm transition-colors text-sm font-medium"
                >
                  لصق
                </button>
              </div>
            </div>
          </div>
          <input
            ref={photoInputRef}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>
      </div>
    </form>
  );
}
