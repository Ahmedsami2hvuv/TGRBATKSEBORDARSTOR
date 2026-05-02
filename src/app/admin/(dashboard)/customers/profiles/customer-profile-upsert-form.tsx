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
  checkCustomerExistsByPhone,
  uploadCustomerProfilePhotoFromUrl,
  type CustomerProfileFormState,
} from "./actions";

const initial: CustomerProfileFormState = {};

function extractPhoneFromText(rawText: string) {
  const match = rawText.match(/07\d{9}/g) || [];
  return match[0] ?? "";
}

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
  const [customerExists, setCustomerExists] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [remotePhotoUrlInput, setRemotePhotoUrlInput] = useState("");
  const [uploadedRemotePhotoUrl, setUploadedRemotePhotoUrl] = useState("");
  const [isUploadingRemotePhoto, setIsUploadingRemotePhoto] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (state.ok || (state.error && state.error.includes("موجود"))) {
      formRef.current?.reset();
      setRawText("");
      setCustomerExists(false);
      setSelectedPhoto(null);
      setRemotePhotoUrlInput("");
      setUploadedRemotePhotoUrl("");
      setIsUploadingRemotePhoto(false);
      setDragActive(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state.ok, state.error, state.timestamp]);

  useEffect(() => {
    let active = true;
    const phone = extractPhoneFromText(rawText);
    if (phone.length >= 10) {
      setIsChecking(true);
      checkCustomerExistsByPhone(phone).then((exists) => {
        if (active) {
          setCustomerExists(exists);
          setIsChecking(false);
        }
      });
    } else {
      setCustomerExists(false);
      setIsChecking(false);
    }
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
      setUploadedRemotePhotoUrl("");
    } catch (err) {
      console.error("خطأ في ضغط الصورة:", err);
      assignFileToInput(photoInputRef.current!, file);
      setSelectedPhoto(file);
      setUploadedRemotePhotoUrl("");
    }
  };

  const uploadImageUrlToStorage = async (raw: string) => {
    const imageUrl = raw.trim();
    if (!imageUrl || isUploadingRemotePhoto) return;
    setIsUploadingRemotePhoto(true);
    const res = await uploadCustomerProfilePhotoFromUrl(imageUrl);
    if (!res.ok) {
      alert(res.error);
      setIsUploadingRemotePhoto(false);
      return;
    }
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    setSelectedPhoto(null);
    setUploadedRemotePhotoUrl(res.photoUrl);
    setRemotePhotoUrlInput(imageUrl);
    setIsUploadingRemotePhoto(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (isUploadingRemotePhoto) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      await handleDroppedOrSelectedFile(droppedFile);
      return;
    }

    const textUriList = e.dataTransfer.getData("text/uri-list")?.trim();
    const plainText = e.dataTransfer.getData("text/plain")?.trim();
    const urlText = textUriList || plainText;
    if (urlText && /^https?:\/\//i.test(urlText)) {
      await uploadImageUrlToStorage(urlText);
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-slate-100 p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex-1">
            {state.error ? (
              <p className={`${ad.error} mb-0`} role="alert">
                {state.error}
              </p>
            ) : null}
            {state.ok ? (
              <p className={`${ad.success} mb-0`}>تم حفظ الزبون بنجاح، الصفحة تمت إعادة تعيينها.</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={pending}
            className={`${ad.btnPrimary} w-full sm:w-auto text-lg py-3 px-8 shadow-md`}
          >
            {pending ? "جارٍ الحفظ…" : "حفظ البيانات"}
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4 bg-sky-50 rounded-xl border border-sky-200 shadow-sm">
          <label className="flex flex-col gap-3 text-sm font-bold text-slate-900">
            <span className="text-lg">معلومات الزبون (لصق النص هنا)</span>
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
              <div className="flex flex-col gap-2">
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
          </label>
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
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-slate-900">
                مربع الصورة (سحب وإفلات):
              </p>
              <p className="text-slate-600">
                اسحب صورة أو رابط صورة مباشر هنا. النظام ينزّل الصورة ويرفعها إلى R2 تلقائيًا.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={remotePhotoUrlInput}
                  onChange={(e) => setRemotePhotoUrlInput(e.target.value)}
                  placeholder="مثال: https://d.ksebstor.site/assets/img/door/1770902492.jpg"
                  className={`${ad.input} flex-1 bg-white`}
                  dir="ltr"
                />
                <button
                  type="button"
                  disabled={isUploadingRemotePhoto}
                  onClick={() => uploadImageUrlToStorage(remotePhotoUrlInput)}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 px-4 py-2 rounded-md shadow-sm transition-colors text-sm font-medium"
                >
                  {isUploadingRemotePhoto ? "جاري الرفع..." : "رفع الرابط"}
                </button>
              </div>
              {uploadedRemotePhotoUrl ? (
                <p className="text-green-700 font-semibold bg-green-100 px-3 py-2 rounded-md border border-green-300">
                  ✓ تم رفع صورة الرابط بنجاح وربطها بالنموذج.
                </p>
              ) : null}
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
          <input type="hidden" name="preUploadedPhotoUrl" value={uploadedRemotePhotoUrl} />
          {selectedPhoto && (
            <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-2 rounded-md border border-green-300">
              <span className="text-lg">✓</span>
              <span className="text-sm font-medium">تم اختيار صورة: {selectedPhoto.name}</span>
            </div>
          )}
          <div className="text-sm text-slate-600">
            اختر صورة الباب بالضغط على "صورة" أو ألصق البيانات بالضغط على "لصق".
          </div>
          <div className="text-sm text-slate-600">
            ألصق رسالة الزبون كاملة هنا، ثم اضغط حفظ. سيقوم النظام بتحليل النص وحفظ الزبون مباشرةً.
          </div>
          <div className="min-h-[1.25rem] mt-1">
            {isChecking && (
              <span className="text-sm font-bold text-sky-600 animate-pulse">جاري التحقق من الرقم...</span>
            )}
            {!isChecking && customerExists && rawText.includes("07") && (
              <div className="space-y-2">
                <span className="text-sm text-amber-700 font-bold bg-amber-100 px-3 py-1 rounded-md border border-amber-300 inline-block shadow-sm">
                  ⚠️ هذا الرقم مسجل مسبقاً في النظام.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRawText("");
                    formRef.current?.reset();
                  }}
                  className="text-sm bg-slate-500 text-white hover:bg-slate-600 px-3 py-1 rounded-md shadow-sm transition-colors"
                >
                  تصفير المربع
                </button>
              </div>
            )}
            {!isChecking && !customerExists && rawText.includes("07") && (
              <span className="text-sm text-green-700 font-bold bg-green-100 px-3 py-1 rounded-md border border-green-300 inline-block shadow-sm">
                ✓الرقم مقبول .
              </span>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
