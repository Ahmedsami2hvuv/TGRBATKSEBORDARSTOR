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
  parseCustomerTextAction,
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
  isGloballyBlocked: false,
  currentRegionIsBlocked: false,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // الحقول الخمسة مرتبة حسب الطلب
  const [phone, setPhone] = useState("");
  const [regionName, setRegionName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  // حالات سابقة ومستوردة
  const [rawText, setRawText] = useState("");
  const [hint, setHint] = useState<CustomerProfileFormHint>(initialHint);
  const [isChecking, setIsChecking] = useState(false);
  const [remotePhotoUrlInput, setRemotePhotoUrlInput] = useState("");
  const [legacyOrderPageUrl, setLegacyOrderPageUrl] = useState("");
  const [legacySessionCookie, setLegacySessionCookie] = useState("");
  const [legacyCookiePanelOpen, setLegacyCookiePanelOpen] = useState(false);
  const [legacyCookieStamp, setLegacyCookieStamp] = useState(0);
  const [legacyFetchBusy, setLegacyFetchBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [remotePhotoPreviewBroken, setRemotePhotoPreviewBroken] = useState(false);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);

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
      /* ignore */
    }
  }, []);

  const persistLegacySessionCookie = () => {
    try {
      const t = legacySessionCookie.trim();
      if (t) {
        sessionStorage.setItem(LEGACY_COOKIE_SESSION_KEY, t);
        setLegacyCookiePanelOpen(false);
        toast.success("تم حفظ Cookie الجلسة.");
      } else {
        sessionStorage.removeItem(LEGACY_COOKIE_SESSION_KEY);
        setLegacyCookiePanelOpen(true);
        toast.success("تم المسح.");
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
    setLegacyCookiePanelOpen(true);
    lastAutoImportedLegacyHref.current = null;
    setLegacyCookieStamp((n) => n + 1);
    toast.success("تم مسح Cookie المحفوظ.");
  };

  // مزامنة الحقول الخمسة مع rawText لتشغيل الفحص التلقائي بالخلفية
  const syncRawTextFromFields = (
    newPhone: string,
    newRegion: string,
    newLoc: string,
    newAlt: string,
  ) => {
    const parts: string[] = [];
    if (newRegion.trim()) parts.push(`المنطقة: ${newRegion.trim()}`);
    if (newPhone.trim()) parts.push(`رقم الهاتف: ${newPhone.trim()}`);
    if (newLoc.trim()) parts.push(`لكيشن الزبون: ${newLoc.trim()}`);
    if (newAlt.trim()) parts.push(`رقم الهاتف الآخر: ${newAlt.trim()}`);
    setRawText(parts.join("\n"));
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    syncRawTextFromFields(val, regionName, locationUrl, alternatePhone);
  };

  const handleRegionChange = (val: string) => {
    setRegionName(val);
    syncRawTextFromFields(phone, val, locationUrl, alternatePhone);
  };

  const handleLocationUrlChange = (val: string) => {
    setLocationUrl(val);
    syncRawTextFromFields(phone, regionName, val, alternatePhone);
  };

  const handleAlternatePhoneChange = (val: string) => {
    setAlternatePhone(val);
    syncRawTextFromFields(phone, regionName, locationUrl, val);
  };

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setPhone("");
      setRegionName("");
      setLocationUrl("");
      setAlternatePhone("");
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

  // ملء الحقول تلقائياً عند استيراد نص خام أو جلب رابط طلب
  const fillFieldsFromRawText = async (text: string) => {
    setRawText(text);
    const parsed = await parseCustomerTextAction(text);
    if (parsed.phone) setPhone(parsed.phone);
    if (parsed.regionName) setRegionName(parsed.regionName);
    if (parsed.locationUrl) setLocationUrl(parsed.locationUrl);
    if (parsed.alternatePhone) setAlternatePhone(parsed.alternatePhone);
  };

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
        await fillFieldsFromRawText(r.rawText);
        if (r.doorImageUrl) {
          setRemotePhotoUrlInput(r.doorImageUrl);
          setSelectedPhoto(null);
          toast.success("استيراد تلقائي: تفاصيل الزبون + صورة الباب.");
        }
      } finally {
        setLegacyFetchBusy(false);
      }
    }, LEGACY_URL_AUTO_IMPORT_MS);

    return () => window.clearTimeout(timer);
  }, [legacyOrderPageUrl, legacyCookieStamp]);

  useEffect(() => {
    setRemotePhotoPreviewBroken(false);
  }, [remotePhotoUrlInput]);

  const handleDroppedOrSelectedFile = async (file: File) => {
    try {
      const compressed = await compressImageForMandoubUpload(file);
      if (fileInputRef.current) assignFileToInput(fileInputRef.current, compressed);
      setSelectedPhoto(compressed);
      setRemotePhotoUrlInput("");
    } catch (err) {
      console.error("خطأ في ضغط الصورة:", err);
      if (fileInputRef.current) assignFileToInput(fileInputRef.current, file);
      setSelectedPhoto(file);
      setRemotePhotoUrlInput("");
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleDroppedOrSelectedFile(file);
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
      setSelectedPhoto(null);
      setRemotePhotoUrlInput(urlText.trim());
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      await fillFieldsFromRawText(text);
      toast.success("تم لصق البيانات وتوزيعها في الحقول تلقائياً.");
    } catch {
      toast.error("فشل في اللصق المباشر. يمكنك الاستعانة بخيار التفتيش السريع.");
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
        await fillFieldsFromRawText(r.rawText);
        if (r.doorImageUrl) {
          setRemotePhotoUrlInput(r.doorImageUrl);
          setSelectedPhoto(null);
          toast.success("تم الجلب: تفاصيل الزبون + رابط صورة الباب.");
        } else {
          toast.success("تم الجلب: معلومات الزبون فقط.");
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
      <input type="hidden" name="rawText" value={rawText} />

      {/* الشريط العلوي الثابت للرسائل والتنبيهات وزر الحفظ */}
      <div
        className={
          "sticky top-0 z-30 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between " +
          "bg-slate-900/90 text-white p-4 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md"
        }
      >
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {state.error ? (
            <p className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-lg text-sm font-bold" role="alert">
              ⚠️ {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-sm font-bold">
              ✓ تم حفظ الزبون بنجاح وتم تصفير الحقول.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {selectedPhoto ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/40">
                <span>✓ تم اختيار صورة الباب:</span>
                <span className="font-mono">{selectedPhoto.name}</span>
              </span>
            ) : null}

            {isChecking ? (
              <span className="text-sky-400 font-bold animate-pulse">
                ⏳ جاري التحقق من السجلات...
              </span>
            ) : null}

            {!isChecking && hint.regionNotFound ? (
              <span className="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/40 font-bold">
                ⚠️ المنطقة غير مسجلة بالنظام.
              </span>
            ) : null}

            {!isChecking &&
            hint.regionResolved &&
            hint.inCurrentRegion &&
            hint.currentRegionMissingPhoto &&
            !selectedPhoto &&
            !remotePhotoUrlInput.trim() ? (
              <span className="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/40 font-bold">
                الزبون مسجل في «{hint.currentRegionName}» ولكن بدون صورة باب.
              </span>
            ) : null}

            {!isChecking &&
            hint.regionResolved &&
            !hint.inCurrentRegion &&
            hint.otherRegionNames.length > 0 ? (
              <span className="bg-sky-500/20 text-sky-300 px-2.5 py-1 rounded-md border border-sky-500/40 font-bold">
                مسجل في مناطق: {hint.otherRegionNames.join("، ")}.
              </span>
            ) : null}

            {!isChecking &&
            hint.regionResolved &&
            hint.inCurrentRegion &&
            (!hint.currentRegionMissingPhoto || !!selectedPhoto || !!remotePhotoUrlInput.trim()) ? (
              <span className="bg-slate-800 text-slate-200 px-2.5 py-1 rounded-md border border-slate-700 font-bold">
                سيتم تحديث سجل الزبون في «{hint.currentRegionName}».
              </span>
            ) : null}

            {!isChecking &&
            hint.regionResolved &&
            !hint.inCurrentRegion &&
            hint.otherRegionNames.length === 0 ? (
              <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/40 font-bold">
                ✓ رقم جديد في منطقة «{hint.currentRegionName}».
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePaste}
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2.5 px-3 rounded-lg border border-slate-600 transition-colors"
            title="لصق البيانات من التلغرام أو الحافظة"
          >
            📋 لصق سريع
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-black text-base py-2.5 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            {pending ? "جارٍ الحفظ…" : "حفظ البيانات"}
          </button>
        </div>
      </div>

      {/* قسم نموذج الحقول مرتب حسب طلب المستخدم بالضبط */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-sky-500/30 p-6 shadow-xl space-y-6">
        
        {/* 1. رقم الزبون */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            1. رقم الزبون <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="مثال: 07700000000 أو 07800000000"
            className={`${ad.input} font-mono text-base font-bold`}
            required
            dir="ltr"
          />
          <p className="text-xs text-slate-400">رقم الهاتف المحلي العراقي الخاص بالزبون.</p>
        </div>

        {/* 2. منطقة الزبون */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            2. منطقة الزبون <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              name="regionName"
              list="regions-options-list"
              value={regionName}
              onChange={(e) => handleRegionChange(e.target.value)}
              placeholder="اكتب اسم المنطقة أو اختر من القائمة..."
              className={`${ad.input} text-base font-bold`}
              required
              autoComplete="off"
            />
            <datalist id="regions-options-list">
              {regions.map((r) => (
                <option key={r.id} value={r.name} />
              ))}
            </datalist>
          </div>
          <p className="text-xs text-slate-400">اختر المنطقة المسجلة في النظام أو اكتب اسمها.</p>
        </div>

        {/* 3. رابط لكيشن الزبون */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            3. رابط لكيشن الزبون
          </label>
          <input
            type="url"
            name="locationUrl"
            value={locationUrl}
            onChange={(e) => handleLocationUrlChange(e.target.value)}
            placeholder="https://maps.app.goo.gl/..."
            className={`${ad.input} text-sm font-mono`}
            dir="ltr"
          />
          <p className="text-xs text-slate-400">رابط الموقع الجغرافي من خرائط جوجل (Google Maps).</p>
        </div>

        {/* 4. رقم آخر للزبون (غير ضروري) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            4. رقم آخر للزبون <span className="text-xs font-normal text-slate-400">(غير ضروري)</span>
          </label>
          <input
            type="tel"
            name="alternatePhone"
            value={alternatePhone}
            onChange={(e) => handleAlternatePhoneChange(e.target.value)}
            placeholder="مثال: 07500000000 (اختياري)"
            className={`${ad.input} font-mono text-sm`}
            dir="ltr"
          />
          <p className="text-xs text-slate-400">رقم هاتف إضافي للزبون إن وجد.</p>
        </div>

        {/* 5. صورة باب الزبون ترفع من الهاتف او تلتقط من الكامره */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            5. صورة باب الزبون <span className="text-xs font-normal text-slate-400">(ترفع من الهاتف أو تلتقط من الكاميرا)</span>
          </label>

          <div
            className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
              dragActive
                ? "border-sky-500 bg-sky-50/80 dark:bg-sky-950/40"
                : selectedPhoto || remotePhotoUrlInput.trim()
                ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20"
                : "border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex flex-wrap justify-center gap-3">
                {/* زر فتح الكاميرا مباشرة لالتقاط صورة */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md transition-all transform active:scale-95"
                >
                  <span className="text-lg">📷</span>
                  <span>التقاط من الكاميرا</span>
                </button>

                {/* زر اختيار صورة من المعرض/الهاتف */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md transition-all transform active:scale-95"
                >
                  <span className="text-lg">📁</span>
                  <span>رفع من الهاتف</span>
                </button>
              </div>

              {/* معاينة الصورة الملتقطة أو المرفوعة */}
              {selectedPhoto ? (
                <div className="flex flex-col items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-300 shadow-sm max-w-xs">
                  <div className="relative h-40 w-full overflow-hidden rounded-lg bg-slate-100">
                    <img
                      src={URL.createObjectURL(selectedPhoto)}
                      alt="معاينة صورة الباب"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    ✓ جاهزة للرفع: {selectedPhoto.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPhoto(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      if (cameraInputRef.current) cameraInputRef.current.value = "";
                    }}
                    className="text-xs text-rose-600 hover:underline font-bold"
                  >
                    حذف الصورة
                  </button>
                </div>
              ) : remotePhotoUrlInput.trim() ? (
                <div className="flex flex-col items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-sky-300 shadow-sm max-w-xs">
                  <div className="relative h-40 w-full overflow-hidden rounded-lg bg-slate-100 flex items-center justify-center">
                    {!remotePhotoPreviewBroken ? (
                      <img
                        src={remotePhotoUrlInput.trim()}
                        alt="معاينة الصورة المستوردة"
                        className="h-full w-full object-cover"
                        onError={() => setRemotePhotoPreviewBroken(true)}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">صورة مستوردة من رابط</span>
                    )}
                  </div>
                  <span className="text-xs text-sky-700 dark:text-sky-300 font-bold">
                    ✓ صورة باب مستوردة من الرابط
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  اضغط لالتقاط الصورة بكاميرا الجوال، أو اختر صورة باب الزبون من ألبوم الهاتف.
                </p>
              )}
            </div>
          </div>

          {/* المدخلات المخفية لرفع الملف أو فتح الكاميرا */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <input
            type="hidden"
            name="remoteImageUrl"
            value={remotePhotoUrlInput}
          />
        </div>
      </div>

      {/* قسم خيارات المساعدة والاستيراد المتقدم */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowAdvancedImport(!showAdvancedImport)}
          className="flex items-center justify-between w-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900"
        >
          <span>🔗 استيراد تلقائي من طلبات الموقع القديم (d.ksebstor)</span>
          <span>{showAdvancedImport ? "▲ إخفاء" : "▼ إظهار"}</span>
        </button>

        {showAdvancedImport ? (
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="url"
                value={legacyOrderPageUrl}
                onChange={(e) => setLegacyOrderPageUrl(e.target.value)}
                placeholder="رابط تفاصيل الطلب القديم (https://d.ksebstor.site/...)"
                className={`${ad.input} text-xs font-mono flex-1`}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => void handleImportLegacyOrder()}
                disabled={legacyFetchBusy}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {legacyFetchBusy ? "جاري الجلب…" : "جلب البيانات"}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>كوكي الجلسة للموقع القديم:</span>
              <button
                type="button"
                onClick={() => setLegacyCookiePanelOpen(!legacyCookiePanelOpen)}
                className="text-indigo-600 font-bold hover:underline"
              >
                {legacyCookiePanelOpen ? "إغلاق الكوكي" : "تعديل الكوكي"}
              </button>
            </div>

            {legacyCookiePanelOpen ? (
              <div className="space-y-2">
                <textarea
                  value={legacySessionCookie}
                  onChange={(e) => setLegacySessionCookie(e.target.value)}
                  rows={2}
                  className={`${ad.input} font-mono text-xs w-full`}
                  placeholder="PHPSESSID=..."
                  dir="ltr"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={persistLegacySessionCookie}
                    className="bg-amber-600 text-white font-bold text-xs px-3 py-1 rounded"
                  >
                    حفظ الكوكي
                  </button>
                  <button
                    type="button"
                    onClick={clearLegacySessionCookie}
                    className="bg-slate-200 text-slate-800 font-bold text-xs px-3 py-1 rounded"
                  >
                    مسح
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
