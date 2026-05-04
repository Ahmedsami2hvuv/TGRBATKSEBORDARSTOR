"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { type AdminRegionOption } from "@/components/admin-region-search-picker";
import {
  compressImageForMandoubUpload,
  assignFileToInput,
} from "@/lib/client-image-compress";
import { toast } from "sonner";
import { parseAndValidateLegacyOrderPageUrl } from "@/lib/legacy-kse-order-door-extract";
import {
  upsertCustomerPhoneProfile,
  getCustomerProfileFormHint,
  importLegacyOrderDetailsFromUrl,
  type CustomerProfileFormHint,
  type CustomerProfileFormState,
} from "./actions";

const LEGACY_URL_AUTO_IMPORT_MS = 750;
const LEGACY_COOKIE_SESSION_KEY = "kse_legacy_order_cookie_v1";

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
  const [legacyOrderPageUrl, setLegacyOrderPageUrl] = useState("");
  const [legacySessionCookie, setLegacySessionCookie] = useState("");
  const [legacyCookieStamp, setLegacyCookieStamp] = useState(0);
  const [legacyFetchBusy, setLegacyFetchBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const legacyOrderPageUrlRef = useRef(legacyOrderPageUrl);
  const legacySessionCookieRef = useRef("");
  const lastAutoImportedLegacyHref = useRef<string | null>(null);
  legacyOrderPageUrlRef.current = legacyOrderPageUrl;
  legacySessionCookieRef.current = legacySessionCookie;

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(LEGACY_COOKIE_SESSION_KEY);
      if (v) setLegacySessionCookie(v);
    } catch {
      /* وضع خاص أو منع التخزين */
    }
  }, []);

  const persistLegacySessionCookie = () => {
    try {
      const t = legacySessionCookie.trim();
      if (t) {
        sessionStorage.setItem(LEGACY_COOKIE_SESSION_KEY, t);
        toast.success("تم حفظ Cookie في هذا المتصفح (جلسة فقط — لا يُرسل لقاعدة بيانات).");
      } else {
        sessionStorage.removeItem(LEGACY_COOKIE_SESSION_KEY);
        toast.success("تم المسح. ألصق Cookie جديداً إن احتجت.");
      }
      lastAutoImportedLegacyHref.current = null;
      setLegacyCookieStamp((n) => n + 1);
    } catch {
      toast.error("المتصفح يمنع التخزين المحلي.");
    }
  };

  const clearLegacySessionCookie = () => {
    setLegacySessionCookie("");
    try {
      sessionStorage.removeItem(LEGACY_COOKIE_SESSION_KEY);
    } catch {
      /* ignore */
    }
    lastAutoImportedLegacyHref.current = null;
    setLegacyCookieStamp((n) => n + 1);
    toast.success("تم مسح Cookie المحفوظ من هذا المتصفح.");
  };

  /** عند الخروج من المربع: يحفظ تلقائياً إن تغيّر النص (بدون ما تضغط زر كل مرة). */
  const handleLegacyCookieBlur = () => {
    try {
      const t = legacySessionCookie.trim();
      if (!t) return;
      const prev = sessionStorage.getItem(LEGACY_COOKIE_SESSION_KEY) ?? "";
      if (t === prev) return;
      sessionStorage.setItem(LEGACY_COOKIE_SESSION_KEY, t);
      lastAutoImportedLegacyHref.current = null;
      setLegacyCookieStamp((n) => n + 1);
    } catch {
      /* ignore */
    }
  };

  const legacyCookieReady = legacySessionCookie.trim().length > 0;

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setRawText("");
      setHint(initialHint);
      setSelectedPhoto(null);
      setRemotePhotoUrlInput("");
      setLegacyOrderPageUrl("");
      lastAutoImportedLegacyHref.current = null;
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

  useEffect(() => {
    const t0 = legacyOrderPageUrl.trim();
    const parsed0 = parseAndValidateLegacyOrderPageUrl(t0);
    if (!parsed0.ok) {
      lastAutoImportedLegacyHref.current = null;
      return;
    }
    if (lastAutoImportedLegacyHref.current === parsed0.href) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const t = legacyOrderPageUrlRef.current.trim();
      const parsed = parseAndValidateLegacyOrderPageUrl(t);
      if (!parsed.ok || parsed.href !== parsed0.href) {
        return;
      }
      if (lastAutoImportedLegacyHref.current === parsed.href) {
        return;
      }

      setLegacyFetchBusy(true);
      try {
        const r = await importLegacyOrderDetailsFromUrl(
          parsed.href,
          legacySessionCookieRef.current || undefined,
        );
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        lastAutoImportedLegacyHref.current = parsed.href;
        setRawText(r.rawText);
        if (r.doorImageUrl) {
          setRemotePhotoUrlInput(r.doorImageUrl);
          setSelectedPhoto(null);
          if (photoInputRef.current) photoInputRef.current.value = "";
          toast.success("استيراد تلقائي: معلومات الزبون + رابط صورة باب الزبون.");
        } else {
          toast.success(
            "استيراد تلقائي: معلومات الزبون فقط (لا رابط صورة باب في الصفحة). يمكنك إضافة صورة يدوياً.",
          );
        }
      } finally {
        setLegacyFetchBusy(false);
      }
    }, LEGACY_URL_AUTO_IMPORT_MS);

    return () => window.clearTimeout(timer);
  }, [legacyOrderPageUrl, legacyCookieStamp]);

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

  const handleImportLegacyOrder = async () => {
    const u = legacyOrderPageUrlRef.current.trim();
    if (!u) {
      toast.error("أدخل رابط صفحة تفاصيل الطلب من الموقع القديم.");
      return;
    }
    const parsed = parseAndValidateLegacyOrderPageUrl(u);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    lastAutoImportedLegacyHref.current = null;
    setLegacyFetchBusy(true);
    try {
      const r = await importLegacyOrderDetailsFromUrl(
        parsed.href,
        legacySessionCookieRef.current || undefined,
      );
      if (r.ok) {
        lastAutoImportedLegacyHref.current = parsed.href;
        setRawText(r.rawText);
        if (r.doorImageUrl) {
          setRemotePhotoUrlInput(r.doorImageUrl);
          setSelectedPhoto(null);
          if (photoInputRef.current) photoInputRef.current.value = "";
          toast.success("تم الجلب: معلومات الزبون + رابط صورة باب الزبون.");
        } else {
          toast.success(
            "تم الجلب: معلومات الزبون فقط (لم يُعثر على رابط صورة باب في الصفحة). يمكنك إرفاق صورة يدوياً أو لصق رابط الصورة.",
          );
        }
      } else {
        toast.error(r.error);
      }
    } finally {
      setLegacyFetchBusy(false);
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
        <div className="rounded-xl border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50/90 p-4 shadow-md dark:border-amber-400 dark:from-amber-950/50 dark:to-orange-950/30">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <h2 className="text-base font-black text-amber-950 dark:text-amber-100 leading-snug">
              ① هنا تضع Cookie الموقع القديم — مرة واحدة فقط
            </h2>
            {legacyCookieReady ? (
              <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ✓ جاهز — لصق روابط طلبات متعددة بدون إعادة الخطوة
              </span>
            ) : (
              <span className="shrink-0 text-xs font-bold text-amber-800 dark:text-amber-200">
                لصق ثم اضغط «حفظ» أو اخرج من المربع ليحفظ تلقائياً
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-amber-950/90 dark:text-amber-100/90 leading-relaxed">
            من d.ksebstor بعد تسجيل الدخول: <strong>F12</strong> → <strong>Network</strong> → اضغط طلب الصفحة (مثل رقم
            الطلب) → <strong>Headers</strong> → انسخ قيمة <strong>Cookie</strong> كاملة والصقها في المربع أدناه.{" "}
            <strong>نفس الكوكي يخدم كل روابط الطلبات</strong> إلى أن تنتهي الجلسة على الموقع القديم.
          </p>
          <textarea
            value={legacySessionCookie}
            onChange={(e) => setLegacySessionCookie(e.target.value)}
            onBlur={handleLegacyCookieBlur}
            rows={3}
            className={`${ad.input} mt-3 w-full bg-white font-mono text-xs leading-relaxed`}
            dir="ltr"
            spellCheck={false}
            autoComplete="off"
            placeholder="مثال: PHPSESSID=xxxxxxxx; ..."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={persistLegacySessionCookie}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-black text-white shadow hover:bg-amber-700"
            >
              حفظ بالجلسة (هذا المتصفح فقط)
            </button>
            <button
              type="button"
              onClick={clearLegacySessionCookie}
              className="rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              مسح الكوكي المحفوظ
            </button>
          </div>
        </div>

        <div
          className={
            "sticky top-0 z-30 flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:gap-4 " +
            "bg-slate-100 dark:bg-slate-800/95 p-4 rounded-xl border border-slate-200 dark:border-slate-600 " +
            "shadow-sm backdrop-blur-sm"
          }
        >
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
          <div className="shrink-0 sm:pt-0.5 sm:self-start">
            <button
              type="submit"
              disabled={pending}
              className={`${ad.btnPrimary} w-full sm:w-auto text-lg py-3 px-8 shadow-md`}
            >
              {pending ? "جارٍ الحفظ…" : "حفظ البيانات"}
            </button>
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
                placeholder="رابط صورة مباشر (اختياري — يُملأ تلقائياً بعد لصق رابط الطلب إن وُجدت صورة باب)"
                className={`${ad.input} w-full bg-white`}
                dir="ltr"
              />
              {remotePhotoUrlInput.trim() && !selectedPhoto ? (
                <p className="text-slate-600 text-xs">
                  يُنزَّل ويُرفَع إلى التخزين تلقائياً عند الضغط على «حفظ البيانات».
                </p>
              ) : null}
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 space-y-3 dark:border-slate-600 dark:bg-slate-900/40">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-1.5">
                  <span className="block font-bold text-slate-800 dark:text-slate-100">
                    ② رابط الطلب من الموقع القديم (d.ksebstor)
                  </span>
                  <span className="block">
                    الصق رابط <strong>تفاصيل الطلبية</strong> (مثل{" "}
                    <span className="font-mono text-[11px]" dir="ltr">
                      …/orders_status/details/13923
                    </span>
                    ) — بعد ثانية يُستورد <strong>تلقائياً</strong> إن كان مربع الكوكي في الأعلى جاهزاً. زر{" "}
                    <strong>«إعادة جلب من الرابط»</strong> لتحديث نفس الرابط.
                  </span>
                  <span className="block">
                    النتيجة: <strong>معلومات الزبون + رابط صورة باب الزبون</strong> إن وُجدت الصورة في الصفحة، أو{" "}
                    <strong>معلومات الزبون فقط</strong>.
                  </span>
                  <span className="block text-slate-500 dark:text-slate-500">
                    نسخ «تحديد الكل» لا يضم روابط الصور. بدون الكوكي في المربع الأصفر يمكن ضبط{" "}
                    <code className="text-[11px]">LEGACY_KSE_ORDER_PAGE_COOKIE</code> على الخادم.
                  </span>
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="url"
                    value={legacyOrderPageUrl}
                    onChange={(e) => setLegacyOrderPageUrl(e.target.value)}
                    placeholder="https://d.ksebstor.site/dashboard/orders_status/details/13923"
                    className={`${ad.input} w-full flex-1 bg-white text-sm`}
                    dir="ltr"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void handleImportLegacyOrder()}
                    disabled={legacyFetchBusy}
                    className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {legacyFetchBusy ? "جارٍ الجلب…" : "إعادة جلب من الرابط"}
                  </button>
                </div>
              </div>
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
                placeholder="اكتب يدوياً أو الصق نصاً، أو الصق رابط تفاصيل الطلب في الحقل أعلاه فيُستورد هنا تلقائياً. إن لصقت كامل نص صفحة الطلب القديمة يُستخرج قسم «معلومات الزبون» تلقائياً."
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
