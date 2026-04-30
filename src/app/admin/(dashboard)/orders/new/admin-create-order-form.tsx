"use client";

import { useActionState, useEffect, useMemo, useState, useRef } from "react";
import { ad } from "@/lib/admin-ui";
import {
  ADMIN_OFFICE_LABEL,
  ADMIN_PHONE_FROM_SHOP_LOCAL,
  ADMIN_PHONE_ONE_FACE_LOCAL,
} from "@/lib/admin-order-from-admin-constants";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { RegionSearchPicker } from "@/components/region-search-picker";
import { ShopSearchPicker } from "@/components/shop-search-picker";
import {
  ShopEmployeeQuickPick,
  type ShopEmployeeRow,
} from "@/components/shop-customer-search-picker";
import { ClientVoiceNoteField } from "@/app/client/order/client-voice-note-field";
import { createAdminOrder, type AdminCreateOrderState } from "./actions";
import { extractPhoneNumberFromText, parseSiteOrderMessage } from "@/lib/site-order-parse";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

type ShopOpt = { id: string; name: string; regionId: string; locationUrl: string };
type RegionOpt = { id: string; name: string };
type EmployeeOpt = ShopEmployeeRow;
type CustomerPrefill = {
  id: string;
  source: "customer" | "phoneProfile";
  shopId: string | null;
  name: string;
  phone: string;
  customerRegionId: string | null;
  customerLocationUrl: string;
  customerLandmark: string;
  customerDoorPhotoUrl: string | null;
  alternatePhone: string | null;
};

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initialState: AdminCreateOrderState = {};

type SubmissionMode = "from_shop" | "admin_one_face" | "two_faces" | "prep_draft";

function doorPhotoUrlForDisplay(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

export function AdminCreateOrderForm({
  shops,
  regions,
  employees,
  preparers,
  icons,
}: {
  shops: ShopOpt[];
  regions: RegionOpt[];
  employees: EmployeeOpt[];
  preparers: Array<{ id: string; name: string; availableForAssignment: boolean }>;
  icons?: GlobalIconsConfig;
}) {
  const [state, formAction, pending] = useActionState(createAdminOrder, initialState);

  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("from_shop");
  const [shopId, setShopId] = useState("");

  const [recipientKind, setRecipientKind] = useState<"none" | "employee" | "admin">("none");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [orderType, setOrderType] = useState("");
  const [orderSubtotal, setOrderSubtotal] = useState("");
  const [orderNoteTime, setOrderNoteTime] = useState("");
  const [summary, setSummary] = useState("");

  const [firstPhone, setFirstPhone] = useState("");
  const [firstAlternatePhone, setFirstAlternatePhone] = useState("");
  const [firstRegionId, setFirstRegionId] = useState("");
  const [firstLocationUrl, setFirstLocationUrl] = useState("");
  const [firstLandmark, setFirstLandmark] = useState("");

  const [secondPhone, setSecondPhone] = useState("");
  const [secondAlternatePhone, setSecondAlternatePhone] = useState("");
  const [secondRegionId, setSecondRegionId] = useState("");
  const [secondLocationUrl, setSecondLocationUrl] = useState("");
  const [secondLandmark, setSecondLandmark] = useState("");

  const [firstSavedDoorPhotoUrl, setFirstSavedDoorPhotoUrl] = useState<string | null>(null);
  const [secondSavedDoorPhotoUrl, setSecondSavedDoorPhotoUrl] = useState<string | null>(null);
  const [firstRawDoorPhotoUrl, setFirstRawDoorPhotoUrl] = useState<string | null>(null);
  const [secondRawDoorPhotoUrl, setSecondRawDoorPhotoUrl] = useState<string | null>(null);
  const [firstPrefillApplied, setFirstPrefillApplied] = useState(false);
  const [firstPrefill, setFirstPrefill] = useState<CustomerPrefill | null>(null);
  const [secondPrefill, setSecondPrefill] = useState<CustomerPrefill | null>(null);
  const [firstPrefillLoading, setFirstPrefillLoading] = useState(false);
  const [secondPrefillLoading, setSecondPrefillLoading] = useState(false);

  // --- Prep Draft State ---
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [titleLine, setTitleLine] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [rawListText, setRawListText] = useState("");
  const [prepCustomerPhone, setPrepCustomerPhone] = useState("");
  const [prepOrderTime, setPrepOrderTime] = useState("فوري");
  const [selectedPreparerIds, setSelectedPreparerIds] = useState<string[]>([]);
  const [prepRegionQ, setPrepRegionQ] = useState("");
  const [prepHits, setPrepHits] = useState<RegionHit[]>([]);
  const [prepSelectedRegion, setPrepSelectedRegion] = useState<RegionHit | null>(null);
  const regionSearchRef = useRef<HTMLInputElement>(null);

  const togglePreparer = (id: string) => {
    setSelectedPreparerIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const routeMode = submissionMode === "two_faces" ? "double" : "single";

  useEffect(() => {
    if (submissionMode === "admin_one_face") {
      setShopId("");
      setRecipientKind("none");
      setSelectedEmployeeId("");
      setFirstSavedDoorPhotoUrl(null);
      setFirstPhone(ADMIN_PHONE_ONE_FACE_LOCAL);
      setFirstAlternatePhone("");
      setFirstRegionId("");
      setFirstLocationUrl("");
      setFirstLandmark("");
      setSecondPhone("");
      setSecondAlternatePhone("");
      setSecondRegionId("");
      setSecondLocationUrl("");
      setSecondLandmark("");
    } else if (submissionMode === "two_faces") {
      setShopId("");
      setRecipientKind("none");
      setSelectedEmployeeId("");
      setFirstSavedDoorPhotoUrl(null);
      setSecondSavedDoorPhotoUrl(null);
      setFirstPhone("");
      setFirstAlternatePhone("");
      setFirstRegionId("");
      setFirstLocationUrl("");
      setFirstLandmark("");
      setSecondPhone("");
      setSecondAlternatePhone("");
      setSecondRegionId("");
      setSecondLocationUrl("");
      setSecondLandmark("");
    } else if (submissionMode === "prep_draft") {
       // Optional reset
    } else {
      setFirstSavedDoorPhotoUrl(null);
      setSecondSavedDoorPhotoUrl(null);
      setFirstPhone("");
      setFirstAlternatePhone("");
      setFirstRegionId("");
      setFirstLocationUrl("");
      setFirstLandmark("");
      setSecondPhone("");
      setSecondAlternatePhone("");
      setSecondRegionId("");
      setSecondLocationUrl("");
      setSecondLandmark("");
      setRecipientKind("none");
      setSelectedEmployeeId("");
    }
  }, [submissionMode]);

  useEffect(() => {
    if (submissionMode !== "from_shop") return;
    setRecipientKind("none");
    setSelectedEmployeeId("");
    setFirstSavedDoorPhotoUrl(null);
  }, [shopId, submissionMode]);

  // Prep Region Search
  useEffect(() => {
    if (prepRegionQ.trim().length < 2) {
      setPrepHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(prepRegionQ.trim())}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          setPrepHits(j.regions ?? []);
        } catch {
          setPrepHits([]);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [prepRegionQ]);

  function pickEmployee(emp: EmployeeOpt) {
    setRecipientKind("employee");
    setSelectedEmployeeId(emp.id);
    setFirstSavedDoorPhotoUrl(null);
  }

  function pickAdminOffice() {
    setRecipientKind("admin");
    setSelectedEmployeeId("");
    setFirstSavedDoorPhotoUrl(null);
    setFirstPhone(ADMIN_PHONE_FROM_SHOP_LOCAL);
    setFirstRegionId("");
    setFirstLocationUrl("");
    setFirstLandmark(ADMIN_OFFICE_LABEL);
  }

  const firstPhoneNormalized = useMemo(
    () => normalizeIraqMobileLocal11(firstPhone),
    [firstPhone],
  );
  const secondPhoneNormalized = useMemo(
    () => normalizeIraqMobileLocal11(secondPhone),
    [secondPhone],
  );

  const defaultDoubleShopId = shops[0]?.id ?? "";

  async function fetchCustomerPrefill(
    phoneRaw: string,
    regionId: string,
    shopIdValue: string | null,
  ): Promise<CustomerPrefill | null> {
    const phone = normalizeIraqMobileLocal11(phoneRaw);
    const region = regionId.trim();
    if (!phone || !region) return null;

    const params = new URLSearchParams({
      phone,
      regionId: region,
    });
    if (shopIdValue?.trim()) {
      params.set("shopId", shopIdValue.trim());
    }

    try {
      const res = await fetch(`/api/admin/customer-prefill?${params.toString()}`);
      if (!res.ok) return null;
      const json = (await res.json()) as { profile?: CustomerPrefill | null };
      return json.profile ?? null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!firstPhone.trim() || !firstRegionId.trim()) {
      setFirstPrefill(null);
      setFirstPrefillLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setFirstPrefillLoading(true);
        const profile = await fetchCustomerPrefill(
          firstPhone,
          firstRegionId,
          submissionMode === "from_shop" ? shopId : null,
        );
        if (!active) return;
        setFirstPrefill(profile);
        setFirstPrefillLoading(false);
      })();
    }, 400); // زيادة بسيطة في التأخير لمنع التكرار

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [firstPhone, firstRegionId, submissionMode, shopId]);

  useEffect(() => {
    if (!secondPhone.trim() || !secondRegionId.trim()) {
      setSecondPrefill(null);
      setSecondPrefillLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSecondPrefillLoading(true);
        const profile = await fetchCustomerPrefill(secondPhone, secondRegionId, null);
        if (!active) return;
        setSecondPrefill(profile);
        setSecondPrefillLoading(false);
      })();
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [secondPhone, secondRegionId]);

  // إزالة التصفير التلقائي للصورة عند تغيير الـ prefill لأنه يسبب مسح الصورة التي اخترناها للتو
  // useEffect(() => {
  //   if (!firstPrefill) setFirstSavedDoorPhotoUrl(null);
  // }, [firstPrefill]);

  // useEffect(() => {
  //   if (!secondPrefill) setSecondSavedDoorPhotoUrl(null);
  // }, [secondPrefill]);

  useEffect(() => {
    if (!firstPrefill) setFirstPrefillApplied(false);
  }, [firstPrefill]);

  // --- Prep Parse Logic ---
  function extractRegionCandidates(rawText: string, knownProducts?: string[]) {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const productSet = new Set((knownProducts ?? []).map((x) => x.trim()).filter(Boolean));
    return lines.filter((line) => {
      if (line.length < 2) return false;
      if (/\d/.test(line)) return false;
      if (productSet.has(line)) return false;
      if (line.includes("كيلو") || line.includes("قطعة") || line.includes("حبة")) return false;
      return true;
    });
  }

  async function resolveRegionAfterParse(rawText: string, fallbackTitle: string, knownProducts?: string[]) {
    const candidates = extractRegionCandidates(rawText, knownProducts);
    const fallback = fallbackTitle.trim();
    if (fallback && fallback.length >= 2 && !candidates.includes(fallback)) candidates.unshift(fallback);
    const limited = candidates.slice(0, 6);
    for (const cand of limited) {
      const qq = cand.trim();
      if (qq.length < 2) continue;
      try {
        const r = await fetch(`/api/regions/search?q=${encodeURIComponent(qq)}`);
        const j = (await r.json()) as { regions?: RegionHit[] };
        const list = j.regions ?? [];
        if (list.length === 1) {
          setPrepSelectedRegion(list[0]!);
          setPrepRegionQ(list[0]!.name);
          setTitleLine(list[0]!.name);
          return;
        }
        const normTitle = normalizeRegionNameForMatch(qq);
        const exact = list.find((x) => normalizeRegionNameForMatch(x.name) === normTitle);
        if (exact) {
          setPrepSelectedRegion(exact);
          setPrepRegionQ(exact.name);
          setTitleLine(exact.name);
          return;
        }
      } catch {}
    }
  }

  function runParse() {
    setParseError(null);
    const t = pasteText.trim();
    if (!t) {
      setParseError("الصق نص الطلب أولاً.");
      return;
    }
    const site = parseSiteOrderMessage(t);
    if (site && site.items.length > 0) {
      const title = (site.address || site.landmark || "طلب موقع").trim();
      const phone = extractPhoneNumberFromText(t) ?? "";
      setTitleLine(title);
      setProducts(site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      setPrepCustomerPhone(phone);
      setRawListText(t);
      setPrepRegionQ(title);
      setPrepSelectedRegion(null);
      void resolveRegionAfterParse(t, title, site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      return;
    }
    const flex = parseFlexibleOrderLines(t);
    if (flex) {
      setTitleLine(flex.title);
      setProducts([...flex.products]);
      setPrepCustomerPhone(flex.phone);
      setRawListText(t);
      setPrepRegionQ(flex.title);
      setPrepSelectedRegion(null);
      void resolveRegionAfterParse(t, flex.title, flex.products);
      return;
    }
    setParseError("تعذّر تحليل النص. تأكد من وجود عنوان ورقم زبون ومنتجات.");
  }

  const canSubmit =
    !pending &&
    (submissionMode === "prep_draft"
      ? (products.length > 0 && selectedPreparerIds.length > 0 && Boolean(prepSelectedRegion))
      : (
        (submissionMode !== "two_faces" || Boolean(defaultDoubleShopId)) &&
        (submissionMode !== "from_shop" || Boolean(shopId.trim()))
      )
    );

  if (state.ok) {
     return (
       <div className="rounded-2xl border border-emerald-300 bg-white p-6 text-center shadow-lg">
         <h2 className="text-xl font-black text-emerald-800">تمت العملية بنجاح</h2>
         <p className="mt-2 text-sm text-slate-700">تم {submissionMode === "prep_draft" ? "إرسال طلب التجهيز للمجهز" : "إنشاء الطلب"} بنجاح.</p>
         <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition">إضافة طلب آخر</button>
       </div>
     );
  }

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="adminSubmissionMode" value={submissionMode} />
      <input type="hidden" name="routeMode" value={routeMode} />
      <input type="hidden" name="linkedCustomerId" value={selectedEmployeeId} />
      <input type="hidden" name="firstExistingDoorPhotoUrl" value={firstRawDoorPhotoUrl || ""} />
      <input type="hidden" name="secondExistingDoorPhotoUrl" value={secondRawDoorPhotoUrl || ""} />

      <div className="rounded-xl border border-sky-200 bg-white/70 p-3">
        <p className="text-sm font-bold text-slate-800">نوع المسار / الطلب</p>
        <div className="mt-2 flex flex-col gap-3">
          <label className="inline-flex max-w-full items-start gap-2 text-sm leading-snug">
            <input
              type="radio"
              name="submissionModeUi"
              checked={submissionMode === "from_shop"}
              onChange={() => setSubmissionMode("from_shop")}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong>رفع من محل</strong> — ابحث عن المحل، ثم اختر العميل كزر جاهز أو «الإدارة».
            </span>
          </label>
          <label className="inline-flex max-w-full items-start gap-2 text-sm leading-snug">
            <input
              type="radio"
              name="submissionModeUi"
              checked={submissionMode === "admin_one_face"}
              onChange={() => setSubmissionMode("admin_one_face")}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong>وجهة واحدة (إداري)</strong> — طلبية مباشرة بدون محل.
            </span>
          </label>
          <label className="inline-flex max-w-full items-start gap-2 text-sm leading-snug">
            <input
              type="radio"
              name="submissionModeUi"
              checked={submissionMode === "two_faces"}
              onChange={() => setSubmissionMode("two_faces")}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong>وجهتان</strong> — مرسل ومستلم (رقم ومنطقة لكل وجهة).
            </span>
          </label>
          <label className="inline-flex max-w-full items-start gap-2 text-sm leading-snug">
            <input
              type="radio"
              name="submissionModeUi"
              checked={submissionMode === "prep_draft"}
              onChange={() => setSubmissionMode("prep_draft")}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong className="text-violet-700">طلب تجهيز (تحليل رسالة)</strong> — إرسال مسودة تسوق للمجهزين من خلال نص رسالة.
            </span>
          </label>
        </div>
      </div>

      {submissionMode === "prep_draft" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-black text-slate-800">الصق نص الطلب هنا</h2>
            <textarea
              value={pasteText}
              onChange={(ev) => setPasteText(ev.target.value)}
              rows={5}
              placeholder="الصق رسالة الموقع أو قائمة واتساب..."
              className={`${ad.input} font-mono text-sm`}
            />
            <button
              type="button"
              onClick={runParse}
              className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
            >
              تحليل النص واستخراج البيانات
            </button>
            {parseError ? <p className="mt-2 text-xs font-bold text-rose-600">{parseError}</p> : null}
          </div>

          {products.length > 0 && (
            <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
              <input type="hidden" name="rawListText" value={rawListText} />
              <input type="hidden" name="productsCsv" value={products.join("\n")} />
              <input type="hidden" name="customerRegionId" value={prepSelectedRegion?.id ?? ""} />
              <input type="hidden" name="firstCustomerRegionId" value={prepSelectedRegion?.id ?? ""} />
              <input type="hidden" name="orderType" value={titleLine} />
              <input type="hidden" name="firstCustomerPhone" value={prepCustomerPhone} />
              <input type="hidden" name="firstCustomerLandmark" value="" />

              {/* تعديل هام: إرسال مصفوفة من الحقول المخفية ليتعرف عليها الخادم كمصفوفة */}
              {selectedPreparerIds.map(id => (
                <input key={id} type="hidden" name="preparerIds" value={id} />
              ))}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className={ad.label}>عنوان الطلب</span>
                  <input name="prepTitleLine" value={titleLine} onChange={(e) => setTitleLine(e.target.value)} className={ad.input} required />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={ad.label}>رقم الزبون</span>
                  <input name="prepCustomerPhone" value={prepCustomerPhone} onChange={(e) => setPrepCustomerPhone(e.target.value)} className={ad.input} required />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={ad.label}>وقت الطلب</span>
                  <input name="prepOrderTime" value={prepOrderTime} onChange={(e) => setPrepOrderTime(e.target.value)} className={ad.input} required />
                </label>
                <div className="relative">
                  <span className={ad.label}>تأكيد المنطقة</span>
                  <input
                    ref={regionSearchRef}
                    value={prepRegionQ}
                    onChange={(ev) => { setPrepRegionQ(ev.target.value); setPrepSelectedRegion(null); }}
                    className={ad.input}
                    placeholder="ابحث بالمنطقة..."
                  />
                  {prepHits.length > 0 && !prepSelectedRegion ? (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-sm shadow-md">
                      {prepHits.map((h) => (
                        <li key={h.id}>
                          <button type="button" className="w-full px-3 py-2 text-start text-slate-800 hover:bg-slate-50" onClick={() => { setPrepSelectedRegion(h); setPrepRegionQ(h.name); setPrepHits([]); }}>
                            {h.name} <span className="text-xs text-slate-500 mr-2">({formatDinarAsAlfWithUnit(h.deliveryPrice)})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="pt-2">
                <span className="text-sm font-bold text-slate-800 mb-2 block">إسناد للمجهزين (اختيار متعدد متاح)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {preparers.map((p) => {
                    const isSelected = selectedPreparerIds.includes(p.id);
                    return (
                      <label key={p.id} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition ${isSelected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200' : 'border-slate-200 bg-white'}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePreparer(p.id)}
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-[11px] font-bold text-slate-700">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedPreparerIds.length === 0 && (
                    <p className="mt-2 text-[11px] text-rose-500 font-bold">يرجى اختيار مجهز واحد على الأقل.</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {submissionMode === "from_shop" ? (
            <div className="space-y-4">
              <div>
                <ShopSearchPicker
                  shops={shops}
                  fieldName="shopId"
                  label="المحل"
                  required
                  value={shopId}
                  onValueChange={setShopId}
                />
                <span className="text-[11px] leading-snug text-slate-500 block mt-1">
                  ابحث عن اسم المحل واختر من النتائج.
                </span>
              </div>
              <ShopEmployeeQuickPick
                shopId={shopId}
                employees={employees}
                selectedEmployeeId={selectedEmployeeId}
                recipientKind={recipientKind}
                onPickEmployee={pickEmployee}
                onPickAdminOffice={pickAdminOffice}
              />
            </div>
          ) : null}

          {submissionMode === "admin_one_face" ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950">
              وضع <strong>وجهة واحدة</strong>: لا يتطلب اختيار محل. أدخل تفاصيل الزبون ونوع الطلبية والسعر.
            </div>
          ) : null}

          {submissionMode === "two_faces" && !defaultDoubleShopId ? (
            <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
              لا يوجد محل مسجّل — أضف محلاً واحداً على الأقل لاستخدام طلبات الوجهتين.
            </p>
          ) : submissionMode === "two_faces" ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950">
              مسار <strong>مرسل → مستلم</strong>: لا يظهر اختيار المحل؛ يُربَط الطلب داخلياً بأول محل للتسعير فقط.
            </div>
          ) : null}

          <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
            <div>
              <h2 className={ad.h2}>
                {submissionMode === "two_faces"
                  ? "المرسل (الوجهة الأولى)"
                  : "الزبون (الوجهة)"}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                أدخل الرقم والمنطقة — يُبحث عن بيانات محفوظة لنفس الرقم والمنطقة.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className={ad.label}>
                  {submissionMode === "two_faces" ? "رقم المرسل" : "رقم الزبون"}
                </span>
                <input
                  name="firstCustomerPhone"
                  className={ad.input}
                  value={firstPhone}
                  onChange={(e) => setFirstPhone(e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="اكتب أو الصق الرقم"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className={ad.label}>الرقم الثاني (إن وجد)</span>
                <input
                  name="firstCustomerAlternatePhone"
                  className={ad.input}
                  value={firstAlternatePhone}
                  onChange={(e) => setFirstAlternatePhone(e.target.value)}
                  inputMode="numeric"
                  placeholder="رقم إضافي..."
                />
              </label>
              <RegionSearchPicker
                fieldName="firstCustomerRegionId"
                label={submissionMode === "two_faces" ? "منطقة المرسل" : "منطقة الزبون"}
                required
                value={firstRegionId}
                onValueChange={setFirstRegionId}
                regionsLookup={regions}
              />
            </div>

            {firstPrefillLoading ? (
              <p className="text-xs text-slate-500">جارٍ البحث عن بيانات محفوظة...</p>
            ) : null}

            {firstPrefill ? (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 shadow-sm transition-all animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-emerald-800 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      بيانات محفوظة لهذا الرقم:
                    </p>
                    <p className="text-xs">المنطقة: <span className="font-semibold">{regions.find(r => r.id === firstPrefill.customerRegionId)?.name || 'غير معروفة'}</span></p>
                    <p className="text-xs italic text-slate-600">أقرب نقطة: {firstPrefill.customerLandmark || 'لا يوجد'}</p>

                    {firstPrefill.customerLocationUrl && (
                      <a
                        href={firstPrefill.customerLocationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1 font-bold"
                      >
                        <DynamicIcon icon={icons?.ui_location} fallback="📍" width={12} height={12} /> فتح الموقع المحفوظ (Google Maps)
                      </a>
                    )}

                    {firstPrefill.alternatePhone && (
                      <p className="text-xs text-blue-700 font-bold bg-blue-100/50 px-2 py-0.5 rounded-md w-fit mt-1 border border-blue-200">
                        الرقم الثاني: {firstPrefill.alternatePhone}
                      </p>
                    )}
                  </div>
                  {firstPrefill.customerDoorPhotoUrl ? (
                    <div className="flex flex-col items-center gap-1">
                      <img
                        src={doorPhotoUrlForDisplay(firstPrefill.customerDoorPhotoUrl) || ""}
                        className="h-24 w-24 rounded-md object-cover border-2 border-emerald-300 shadow-md bg-white"
                        alt="صورة الباب"
                      />
                      <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1 rounded">صورة الباب</span>
                    </div>
                  ) : (
                    <div className="h-24 w-24 rounded-md bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center">
                       <span className="text-[9px] text-slate-400">لا توجد صورة</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border border-emerald-500 bg-emerald-600 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-700 shadow-md transition-all active:scale-[0.98]"
                  onClick={() => {
                    setFirstPhone(firstPrefill.phone);
                    setFirstRegionId(firstPrefill.customerRegionId ?? "");
                    setFirstLocationUrl(firstPrefill.customerLocationUrl ?? "");
                    setFirstLandmark(firstPrefill.customerLandmark ?? "");
                    setFirstAlternatePhone(firstPrefill.alternatePhone ?? "");
                    setFirstSavedDoorPhotoUrl(doorPhotoUrlForDisplay(firstPrefill.customerDoorPhotoUrl));
                    setFirstRawDoorPhotoUrl(firstPrefill.customerDoorPhotoUrl);
                    setFirstPrefillApplied(true);
                  }}
                >
                  تطبيق كافة التفاصيل المحفوظة الآن
                </button>
                {firstPrefillApplied ? (
                  <p className="mt-2 text-[11px] font-bold text-emerald-800 bg-emerald-200/50 p-1 rounded text-center flex items-center justify-center gap-1">
                    <DynamicIcon icon={icons?.ui_success} fallback="✅" width={12} height={12} /> تم تحميل كافة التفاصيل (بما في ذلك الصورة والرقم الثاني)
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className={ad.label}>
                  {submissionMode === "two_faces" ? "لوكيشن المرسل" : "لوكيشن الزبون"}
                </span>
                <button type="button" onClick={() => navigator.geolocation.getCurrentPosition(p => setFirstLocationUrl(`https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`))} className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-md hover:bg-sky-200 w-fit flex items-center gap-1">
                  <DynamicIcon icon={icons?.ui_location} fallback="📍" width={10} height={10} /> أخذ موقعي الحالي
                </button>
                <input
                  name="firstCustomerLocationUrl"
                  className={ad.input}
                  value={firstLocationUrl}
                  onChange={(e) => setFirstLocationUrl(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className={ad.label}>
                  {submissionMode === "two_faces" ? "أقرب نقطة دالة (مرسل)" : "أقرب نقطة دالة"}
                </span>
                <input
                  name="firstCustomerLandmark"
                  className={ad.input}
                  value={firstLandmark}
                  onChange={(e) => setFirstLandmark(e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className={ad.label}>صورة باب الزبون</span>
              <input
                name="firstCustomerDoorPhoto"
                type="file"
                accept="image/*"
                capture="environment"
                className={ad.input}
                onChange={(e) => { if (e.target.files?.[0]) setFirstSavedDoorPhotoUrl(null); }}
              />
            </label>
            {firstSavedDoorPhotoUrl && (
              <img src={firstSavedDoorPhotoUrl} alt="" className="mt-2 max-h-44 w-full rounded-md object-contain border" />
            )}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-base sm:text-lg">
              <span className={`${ad.label} text-base sm:text-lg`}>نوع الطلب</span>
              <input
                name="orderType"
                required
                className={`${ad.input} min-h-[52px] text-lg sm:text-xl`}
                placeholder="مثال: مستلزمات / مستندات / طلب خاص"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-base sm:text-lg">
              <span className={`${ad.label} text-base sm:text-lg`}>سعر الطلب</span>
              <input
                name="orderSubtotal"
                required
                className={`${ad.input} min-h-[52px] text-lg font-semibold tabular-nums sm:text-xl animate-placeholder`}
                placeholder="اكتب السعر هنا"
                inputMode="decimal"
                value={orderSubtotal}
                onChange={(e) => setOrderSubtotal(e.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>وقت الطلب (إجباري)</span>
            <input
              name="orderNoteTime"
              required
              className={ad.input}
              placeholder="مثال: الساعة 8 مساءً"
              value={orderNoteTime}
              onChange={(e) => setOrderNoteTime(e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className={ad.label}>صورة الطلب</span>
              <input name="orderImage" type="file" accept="image/*" className={ad.input} />
            </label>
            <ClientVoiceNoteField title="ملاحظة صوتية" wrapperClassName="" />
          </div>
        </>
      )}

      {submissionMode === "two_faces" && (
            <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
              <h2 className={ad.h2}>المستلم (الوجهة الثانية)</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className={ad.label}>رقم المستلم</span>
                  <input name="secondCustomerPhone" className={ad.input} value={secondPhone} onChange={(e) => setSecondPhone(e.target.value)} required />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className={ad.label}>الرقم الثاني للمستلم (إن وجد)</span>
                  <input
                    name="secondCustomerAlternatePhone"
                    className={ad.input}
                    value={secondAlternatePhone}
                    onChange={(e) => setSecondAlternatePhone(e.target.value)}
                    inputMode="numeric"
                    placeholder="رقم إضافي..."
                  />
                </label>
                <RegionSearchPicker fieldName="secondCustomerRegionId" label="منطقة المستلم" required value={secondRegionId} onValueChange={setSecondRegionId} regionsLookup={regions} />
              </div>
              {secondPrefillLoading ? (
                <p className="text-xs text-slate-500">جارٍ البحث عن بيانات محفوظة...</p>
              ) : null}
              {secondPrefill && (
                <div className="rounded-xl border border-violet-300 bg-violet-50 p-3 text-sm text-violet-900 shadow-sm transition-all animate-in fade-in slide-in-from-top-1">
                   <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1 flex-1">
                      <p className="font-bold text-violet-800">بيانات محفوظة للمستلم:</p>
                      <p className="text-xs">المنطقة: <span className="font-semibold">{regions.find(r => r.id === secondPrefill.customerRegionId)?.name || 'غير معروفة'}</span></p>
                      <p className="text-xs italic">أقرب نقطة: {secondPrefill.customerLandmark || 'لا يوجد'}</p>

                      {secondPrefill.customerLocationUrl && (
                        <a href={secondPrefill.customerLocationUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1 font-bold">
                          <DynamicIcon icon={icons?.ui_location} fallback="📍" width={12} height={12} /> الموقع المحفوظ للمستلم
                        </a>
                      )}

                      {secondPrefill.alternatePhone && (
                        <p className="text-xs text-blue-700 font-bold bg-blue-100/50 px-2 py-0.5 rounded-md w-fit mt-1 border border-blue-200">
                          الرقم الثاني: {secondPrefill.alternatePhone}
                        </p>
                      )}
                    </div>
                    {secondPrefill.customerDoorPhotoUrl ? (
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={doorPhotoUrlForDisplay(secondPrefill.customerDoorPhotoUrl) || ""}
                          className="h-20 w-20 rounded-md object-cover border-2 border-violet-200 shadow-md bg-white"
                          alt="صورة الباب"
                        />
                         <span className="text-[9px] font-black text-violet-700 bg-violet-100 px-1 rounded">صورة الباب</span>
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-md bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center">
                         <span className="text-[9px] text-slate-400">لا توجد صورة</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-lg border border-violet-500 bg-violet-600 px-3 py-2 text-xs font-black text-white hover:bg-violet-700 shadow-md transition-all active:scale-[0.98]"
                    onClick={() => {
                      setSecondPhone(secondPrefill.phone);
                      setSecondRegionId(secondPrefill.customerRegionId ?? "");
                      setSecondLocationUrl(secondPrefill.customerLocationUrl ?? "");
                      setSecondLandmark(secondPrefill.customerLandmark ?? "");
                      setSecondAlternatePhone(secondPrefill.alternatePhone ?? "");
                      setSecondSavedDoorPhotoUrl(doorPhotoUrlForDisplay(secondPrefill.customerDoorPhotoUrl));
                      setSecondRawDoorPhotoUrl(secondPrefill.customerDoorPhotoUrl);
                    }}
                  >
                    تطبيق تفاصيل المستلم
                  </button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="secondCustomerLocationUrl" className={ad.input} value={secondLocationUrl} onChange={(e) => setSecondLocationUrl(e.target.value)} placeholder="لوكيشن المستلم" />
                <button type="button" onClick={() => navigator.geolocation.getCurrentPosition(p => setSecondLocationUrl(`https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`))} className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-md hover:bg-violet-200 w-fit mt-1 flex items-center gap-1">
                  <DynamicIcon icon={icons?.ui_location} fallback="📍" width={10} height={10} /> أخذ موقعي الحالي
                </button>
                <input name="secondCustomerLandmark" className={ad.input} value={secondLandmark} onChange={(e) => setSecondLandmark(e.target.value)} placeholder="نقطة دالة مستلم" />
              </div>
            
              <label className="flex flex-col gap-1 text-sm">
                <span className={ad.label}>صورة باب المستلم</span>
                <input
                  name="secondCustomerDoorPhoto"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={ad.input}
                  onChange={(e) => { if (e.target.files?.[0]) setSecondSavedDoorPhotoUrl(null); }}
                />
              </label>
              {secondSavedDoorPhotoUrl && (
                <img src={secondSavedDoorPhotoUrl} alt="" className="mt-2 max-h-44 w-full rounded-md object-contain border" />
              )}
            </section>
          )}


          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>ملاحظات / تفاصيل</span>
            <textarea
              name="summary"
              rows={3}
              className={ad.input}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>

          {state.error ? <p className={ad.error}>{state.error}</p> : null}

      <button type="submit" className={ad.btnPrimary} disabled={!canSubmit || pending}>
        {pending ? "جارٍ التنفيذ..." : (submissionMode === "prep_draft" ? "إرسال طلب التجهيز" : "إنشاء الطلب")}
      </button>
    </form>
  );
}
