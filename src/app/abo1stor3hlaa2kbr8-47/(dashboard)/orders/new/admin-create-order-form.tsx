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

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

function sanitizePhone(value: string): string {
  const arabicDigits = /[٠١٢٣٤٥٦٧٨٩]/g;
  const persianDigits = /[۰۱۲۳۴۵۶۷۸۹]/g;
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


type ShopOpt = { id: string; name: string; regionId: string; locationUrl: string; regionDeliveryPrice?: any };
type RegionOpt = { id: string; name: string; deliveryPrice: any };
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
 const u = url?.toString().trim();
 if (!u) return null;
 if (u.startsWith("http://") || u.startsWith("https://")) return u;
 return u.startsWith("/") ? u : `/${u}`;
}

export function AdminCreateOrderForm({
  shops,
  regions,
  preparers,
  couriers,
  icons,
  systemShopId = "",
}: {
  shops: ShopOpt[];
  regions: RegionOpt[];
  preparers: Array<{ id: string; name: string; availableForAssignment: boolean }>;
  couriers: Array<{ id: string; name: string }>;
  icons?: GlobalIconsConfig;
  systemShopId?: string;
}) {
 const [state, formAction, pending] = useActionState(createAdminOrder, initialState);

 const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("admin_one_face");
 const [shopId, setShopId] = useState("");
 const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
 const [employeesLoading, setEmployeesLoading] = useState(false);

 const [recipientKind, setRecipientKind] = useState<"none" | "employee" | "admin">("none");
 const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

 const [orderType, setOrderType] = useState("");
 const [orderSubtotal, setOrderSubtotal] = useState("");
 const [purchasePrice, setPurchasePrice] = useState("");
 const [orderNoteTime, setOrderNoteTime] = useState("");

 const calculatedProfit = useMemo(() => {
   const p = parseFloat(purchasePrice);
   const s = parseFloat(orderSubtotal);
   if (!isNaN(p) && !isNaN(s) && s > p && purchasePrice.trim() !== "") {
     return s - p;
   }
   return null;
 }, [purchasePrice, orderSubtotal]);
 const [summary, setSummary] = useState("");
 const [assignedCourierId, setAssignedCourierId] = useState("");
 const [courierSearch, setCourierSearch] = useState("");

 const [deliveryAdjustment, setDeliveryAdjustment] = useState(0);
 const [isPrepaidAll, setIsPrepaidAll] = useState(false);
 const [isReverse, setIsReverse] = useState(false);

 const filteredCouriers = useMemo(() => {
 if (!courierSearch.trim()) return couriers;
 return couriers.filter((c) =>
 c.name.toLowerCase().includes(courierSearch.toLowerCase())
 );
 }, [couriers, courierSearch]);

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
 const [secondPrefillApplied, setSecondPrefillApplied] = useState(false);
 const [firstPrefill, setFirstPrefill] = useState<CustomerPrefill | null>(null);
 const [secondPrefill, setSecondPrefill] = useState<CustomerPrefill | null>(null);
 const [firstPrefillLoading, setFirstPrefillLoading] = useState(false);
 const [secondPrefillLoading, setSecondPrefillLoading] = useState(false);

 // --- Prep Draft State ---
 const [pasteText, setPasteText] = useState("");
 const [parseError, setParseError] = useState<string | null>(null);
 const [titleLine, setTitleLine] = useState("");
 const [products, setProducts] = useState<string[]>([]);
 const [productAssignments, setProductAssignments] = useState<Record<number, string>>({});
 const [checkedProductIndices, setCheckedProductIndices] = useState<number[]>([]);
 const [rawListText, setRawListText] = useState("");
 const [prepCustomerPhone, setPrepCustomerPhone] = useState("");
 const [prepOrderTime, setPrepOrderTime] = useState("فوري");
 const [selectedPreparerIds, setSelectedPreparerIds] = useState<string[]>([]);
 const [prepRegionQ, setPrepRegionQ] = useState("");
 const [prepHits, setPrepHits] = useState<RegionHit[]>([]);
 const [prepSelectedRegion, setPrepSelectedRegion] = useState<RegionHit | null>(null);
 const [noProfit, setNoProfit] = useState(false);
 const regionSearchRef = useRef<HTMLInputElement>(null);

 const [blockedPhone, setBlockedPhone] = useState<string | null>(null);

 const [suggestions, setSuggestions] = useState<{ types: string[], subtotals: string[], times: string[] }>({ types: [], subtotals: [], times: [] });

 useEffect(() => {
   const activeShopId = submissionMode === "from_shop" ? shopId : systemShopId;
   if (!activeShopId) {
     setSuggestions({ types: [], subtotals: [], times: [] });
     return;
   }

   let active = true;
   void (async () => {
     try {
       const res = await fetch(`/api/shops/${activeShopId}/suggestions`);
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
 }, [shopId, submissionMode, systemShopId]);

 const togglePreparer = (id: string) => {
 setSelectedPreparerIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
 };

 const routeMode = submissionMode === "two_faces" ? "double" : "single";

 useEffect(() => {
 if (submissionMode !== "from_shop" || !shopId) {
 setEmployees([]);
 return;
 }

 let active = true;
 setEmployeesLoading(true);

 void (async () => {
 try {
 const res = await fetch(`/api/shops/${shopId}/employees`);
 if (!res.ok) throw new Error("Failed to fetch employees");
 const data = await res.json();
 if (active) {
 setEmployees(data.employees || []);
 }
 } catch (err) {
 console.error("Error fetching employees:", err);
 if (active) setEmployees([]);
 } finally {
 if (active) setEmployeesLoading(false);
 }
 })();

 return () => { active = false; };
 }, [shopId, submissionMode]);

 useEffect(() => {
 if (submissionMode === "admin_one_face") {
 setShopId("");
 setRecipientKind("none");
 setSelectedEmployeeId("");
 setFirstSavedDoorPhotoUrl(null);
 } else if (submissionMode === "two_faces") {
 setShopId("");
 setRecipientKind("none");
 setSelectedEmployeeId("");
 setFirstSavedDoorPhotoUrl(null);
 setSecondSavedDoorPhotoUrl(null);
 } else if (submissionMode === "prep_draft") {
 } else {
 setFirstSavedDoorPhotoUrl(null);
 setSecondSavedDoorPhotoUrl(null);
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
 setFirstRegionId("");
 setFirstLocationUrl("");
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
 const region = (regionId || "").toString().trim();
 if (!phone || !region) return null;

 const params = new URLSearchParams({
 phone,
 regionId: region,
 });
 if (shopIdValue?.toString().trim()) {
 params.set("shopId", shopIdValue.toString().trim());
 }

 try {
 const res = await fetch(`/api${SECRET_ADMIN_PATH}/customer-prefill?${params.toString()}`);
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
 }, 400);

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

  useEffect(() => {
    setFirstPrefillApplied(false);
  }, [firstPrefill]);

  useEffect(() => {
    setSecondPrefillApplied(false);
  }, [secondPrefill]);

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
 const fallback = (fallbackTitle || "").toString().trim();
 if (fallback && fallback.length >= 2 && !candidates.includes(fallback)) candidates.unshift(fallback);
 const limited = candidates.slice(0, 6);
 for (const cand of limited) {
 const qq = (cand || "").toString().trim();
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

 async function runParse() {
 setParseError(null);
 const t = pasteText.trim();
 if (!t) {
 setParseError("الصق نص الطلب أولاً.");
 return;
 }

 let phone = "";
 const site = parseSiteOrderMessage(t);
 if (site && site.items.length > 0) {
 phone = extractPhoneNumberFromText(t) ?? "";
 } else {
 const flex = parseFlexibleOrderLines(t);
 if (flex) {
 phone = flex.phone;
 }
 }

 if (phone) {
 try {
 const check = await fetch(`/api/check-block?phone=${encodeURIComponent(phone)}`);
 const blockRes = await check.json();
 if (blockRes.blocked) {
 setBlockedPhone(blockRes.phone);
 return;
 }
 } catch (e) {
 console.error("Block check failed", e);
 }
 }

 if (site && site.items.length > 0) {
 const title = (site.address || site.landmark || "طلب موقع").trim();
 setTitleLine(title);
 setProducts(site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
 setProductAssignments({});
 setCheckedProductIndices([]);
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
 setProductAssignments({});
 setCheckedProductIndices([]);
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
         Boolean(orderType.trim()) &&
         Boolean(orderSubtotal.trim()) &&
         Boolean(orderNoteTime.trim()) &&
         Boolean(firstPhone.trim()) &&
         Boolean(firstRegionId.trim()) &&
         (submissionMode !== "two_faces" || (Boolean(secondPhone.trim()) && Boolean(secondRegionId.trim()))) &&
         (submissionMode !== "from_shop" || Boolean(shopId.trim()))
       )
   );

 if (state.ok) {
 return (
 <div className="rounded-2xl border border-emerald-300 bg-white p-6 text-center shadow-lg">
 <h2 className="text-xl font-black text-emerald-800">تمت العملية بنجاح</h2>
 <p className="mt-2 text-sm text-slate-700">تم {submissionMode === "prep_draft" ? "إرسال طلب التجهيز للمجهز" : "إنشاء الطلب"} بنجاح.</p>
 <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
 <button onClick={() => window.location.reload()} className="rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition">إضافة طلب آخر</button>
 <a href={`${SECRET_ADMIN_PATH}/orders/tracking`} className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100">
 فتح تتبع الطلبات
 </a>
 <a href={`${SECRET_ADMIN_PATH}/orders/pending`} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100">
 فتح الطلبات الجديدة
 </a>
 <a href={SECRET_ADMIN_PATH} className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-900 shadow-sm transition hover:bg-violet-100">
 القائمة الرئيسية
 </a>
 </div>
 </div>
 );
 }

 return (
 <>
 <form action={formAction} className="space-y-4 pb-28" encType="multipart/form-data">
 <input type="hidden" name="adminSubmissionMode" value={submissionMode} />
 <input type="hidden" name="routeMode" value={routeMode} />
 <input type="hidden" name="linkedCustomerId" value={selectedEmployeeId} />
 <input type="hidden" name="firstExistingDoorPhotoUrl" value={firstRawDoorPhotoUrl || ""} />
 <input type="hidden" name="secondExistingDoorPhotoUrl" value={secondRawDoorPhotoUrl || ""} />
 <input type="hidden" name="deliveryAdjustment" value={deliveryAdjustment} />
 <input type="hidden" name="prepaidAll" value={isPrepaidAll ? "true" : "false"} />
 <input type="hidden" name="isReverse" value={isReverse ? "true" : "false"} />

 {/* --- إسناد تلقائي لمندوب (في بداية الصفحة) --- */}
 <div className={`rounded-2xl border-2 border-emerald-500 bg-emerald-50/30 p-4 shadow-sm transition-opacity ${pending ? 'opacity-50 pointer-events-none' : ''}`}>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
 <div className="flex items-center gap-2">
 <span className="text-sm font-black text-emerald-900 flex items-center gap-2">
 <DynamicIcon icon={icons?.ui_user} fallback="👤" width={20} height={20} />
 إسناد مباشر لمندوب
 </span>
 <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">إسناد فوري</span>
 </div>
 {couriers.length > 6 && (
 <div className="relative">
 <input
 type="text"
 placeholder="ابحث عن مندوب..."
 value={courierSearch}
 onChange={(e) => setCourierSearch(e.target.value)}
 className="text-[11px] border border-emerald-200 rounded-lg px-8 py-1 focus:ring-1 focus:ring-emerald-400 outline-none w-full sm:w-44"
 />
 <div className="absolute left-2 top-1.5 opacity-40">
 <DynamicIcon icon={icons?.ui_search} fallback="🔍" width={12} height={12} />
 </div>
 </div>
 )}
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
 <button
 type="button"
 onClick={() => setAssignedCourierId("")}
 className={`relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition h-16 text-center leading-tight ${assignedCourierId === "" ? "border-emerald-600 bg-emerald-100 shadow-sm ring-2 ring-emerald-200 text-emerald-900" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"}`}
 >
 <span className="text-[12px] font-black">بدون إسناد</span>
 <span className="text-[10px] font-normal opacity-70">(طلبات جديدة)</span>
 {assignedCourierId === "" && (
 <div className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-sm">
 <DynamicIcon icon={icons?.ui_success} fallback="✓" width={12} height={12} />
 </div>
 )}
 </button>
 {filteredCouriers.map((c) => {
 const isSelected = assignedCourierId === c.id;
 return (
 <button
 key={c.id}
 type="button"
 onClick={() => setAssignedCourierId(isSelected ? "" : c.id)}
 className={`relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition h-16 leading-tight ${isSelected ? "border-emerald-600 bg-white shadow-md ring-2 ring-emerald-200" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/30"}`}
 >
 <span className={`text-[12px] font-black truncate w-full px-1 ${isSelected ? 'text-emerald-700' : ''}`}>{c.name}</span>
 <span className="text-[10px] font-medium opacity-60 mt-0.5">إسناد مباشر</span>
 {isSelected && (
 <div className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-sm">
 <DynamicIcon icon={icons?.ui_success} fallback="✓" width={12} height={12} />
 </div>
 )}
 </button>
 );
 })}
 </div>
 <input type="hidden" name="assignedCourierId" value={assignedCourierId} />
 <p className="mt-2 text-[11px] text-slate-500 italic">
 إذا اخترت مندوب، سيتم إرسال إشعار فوري له وسينتقل الطلب لحالة "قيد التوصيل".
 </p>
 </div>

 <div className="rounded-xl border border-sky-200 bg-white/70 p-3">
 <p className="text-sm font-bold text-slate-800">نوع المسار / الطلب</p>
 <div className="mt-2 flex flex-col gap-3">
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
<div className="mt-3 flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-white/5 cursor-pointer select-none transition hover:bg-slate-100 dark:hover:bg-white/10 animate-in fade-in" onClick={() => setNoProfit(p => !p)}>
    <div className="flex flex-col text-right">
      <span className="text-xs font-black text-slate-800 dark:text-slate-200">إيقاف الربح 🚫</span>
      <span className="text-[10px] font-bold text-slate-400">جعل سعر البيع مساوياً لسعر الشراء تماماً</span>
    </div>
    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${noProfit ? 'bg-rose-600' : 'bg-slate-200 dark:bg-slate-800'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${noProfit ? 'translate-x-6' : 'translate-x-1'}`} />
    </div>
  </div>
 <button
 type="button"
 onClick={runParse}
 className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700 flex items-center justify-center gap-2"
 >
 <DynamicIcon icon={icons?.ui_ai} fallback="✨" width={16} height={16} /> تحليل النص واستخراج البيانات
 </button>
 {parseError ? <p className="mt-2 text-xs font-bold text-rose-600">{parseError}</p> : null}
 </div>

 {products.length > 0 && (
 <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
 <input type="hidden" name="rawListText" value={rawListText} />
 <input type="hidden" name="productsCsv" value={products.join("\n")} />
 <input type="hidden" name="productAssignmentsJson" value={JSON.stringify(productAssignments)} />
 <input type="hidden" name="noProfit" value={noProfit ? "true" : "false"} />
 <input type="hidden" name="customerRegionId" value={prepSelectedRegion?.id ?? ""} />
 <input type="hidden" name="firstCustomerRegionId" value={prepSelectedRegion?.id ?? ""} />
 <input type="hidden" name="orderType" value={titleLine} />
 <input type="hidden" name="firstCustomerPhone" value={prepCustomerPhone} />
 <input type="hidden" name="firstCustomerLandmark" value="" />

 {selectedPreparerIds.map(id => (
 <input key={id} type="hidden" name="preparerIds" value={id} />
 ))}

 <div className="flex flex-col gap-4">
 <label className="flex flex-col gap-1">
 <span className={ad.label}>رقم الزبون</span>
  <input name="prepCustomerPhone" value={prepCustomerPhone} onChange={(e) => setPrepCustomerPhone(sanitizePhone(e.target.value))} onBlur={(e) => handlePhoneBlur(e.target.value, setPrepCustomerPhone)} className={ad.input} required />
 </label>

 <div className="relative flex flex-col gap-1">
 <span className={ad.label}>تأكيد المنطقة</span>
 <input
 ref={regionSearchRef}
 value={prepRegionQ}
 onChange={(ev) => { setPrepRegionQ(ev.target.value); setPrepSelectedRegion(null); }}
 className={ad.input}
 placeholder="ابحث بالمنطقة..."
 />
 {prepHits.length > 0 && !prepSelectedRegion ? (
 <ul className="absolute z-10 top-full mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-sm shadow-md">
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

 <label className="flex flex-col gap-1">
 <span className={ad.label}>وقت الطلب</span>
 <input name="prepOrderTime" value={prepOrderTime} onChange={(e) => setPrepOrderTime(e.target.value)} className={ad.input} required />
 </label>

 <div className="pt-2 border-t border-sky-100">
  <span className="text-sm font-bold text-slate-800 mb-2 block">المجهزين المشمولين</span>
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
  {preparers.map((p) => {
  const isSelected = selectedPreparerIds.includes(p.id);
  return (
  <label key={p.id} className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer transition ${isSelected ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200' : 'border-slate-200 bg-white'}`}>
  <input
  type="checkbox"
  checked={isSelected}
  onChange={() => togglePreparer(p.id)}
  className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500"
  />
  <span className="text-[10px] font-bold text-slate-700 truncate">{p.name}</span>
  </label>
  );
  })}
  </div>
  {selectedPreparerIds.length === 0 && (
  <p className="mt-2 text-[10px] text-rose-500 font-bold">يرجى اختيار مجهز واحد على الأقل.</p>
  )}
  </div>

  <div className="pt-4 border-t-2 border-violet-200">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <span className="text-base font-black text-violet-950 flex items-center gap-1.5">
          <span>📦</span> تحديد وتوزيع المنتجات للمجهزين
        </span>
        <span className="text-xs bg-violet-600 text-white px-2.5 py-0.5 rounded-full font-bold">
          {products.length} منتج
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const unassignedIndices = products
              .map((_, i) => i)
              .filter((i) => !productAssignments[i] || productAssignments[i] === "all");
            setCheckedProductIndices(unassignedIndices);
          }}
          className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
          title="تحديد المنتجات التي لم يتم إسنادها لمجهز محدد بعد"
        >
          <span>⚡</span> تحديد الباقيات
        </button>

        <button
          type="button"
          onClick={() => {
            if (checkedProductIndices.length === products.length) {
              setCheckedProductIndices([]);
            } else {
              setCheckedProductIndices(products.map((_, i) => i));
            }
          }}
          className="text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
        >
          {checkedProductIndices.length === products.length ? "إلغاء تحديد الكل ✕" : "☑️ تحديد كل المنتجات"}
        </button>
      </div>
    </div>

    <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-violet-50 via-purple-50 to-sky-50 border-2 border-violet-300 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs font-black text-violet-900">
          {checkedProductIndices.length > 0 ? (
            <span className="flex items-center gap-1.5">
              <span>🎯</span> تم تحديد <span className="text-violet-700 underline text-sm font-black px-1 bg-white rounded border border-violet-200">{checkedProductIndices.length}</span> منتج — اضغط اسم المجهز لتخصيصها له فوراً:
            </span>
          ) : (
            <span className="text-slate-600">حدد المنتجات بوضع صح (☑️) ثم اختر المجهز لإسنادها بضغطة واحدة:</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={checkedProductIndices.length === 0}
            onClick={() => {
              setProductAssignments((prev) => {
                const next = { ...prev };
                checkedProductIndices.forEach((idx) => {
                  delete next[idx];
                });
                return next;
              });
              setCheckedProductIndices([]);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              checkedProductIndices.length > 0
                ? "bg-slate-800 text-white hover:bg-slate-900"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            الكل (جميع المجهزين)
          </button>
          {(selectedPreparerIds.length > 0
            ? preparers.filter((p) => selectedPreparerIds.includes(p.id))
            : preparers
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={checkedProductIndices.length === 0}
              onClick={() => {
                setProductAssignments((prev) => {
                  const next = { ...prev };
                  checkedProductIndices.forEach((idx) => {
                    next[idx] = p.id;
                  });
                  return next;
                });
                setCheckedProductIndices([]);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition shadow-xs cursor-pointer ${
                checkedProductIndices.length > 0
                  ? "bg-violet-600 text-white hover:bg-violet-700 active:scale-95"
                  : "bg-violet-100 text-violet-300 cursor-not-allowed"
              }`}
            >
              إسناد لـ {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>

    <div className="space-y-2.5">
      {products.map((prod, idx) => {
        const isChecked = checkedProductIndices.includes(idx);
        const assignedPrepId = productAssignments[idx] || "all";

        return (
          <div
            key={idx}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border-2 transition-all ${
              isChecked
                ? "border-violet-500 bg-violet-50/70 shadow-md ring-2 ring-violet-200"
                : "border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50/50"
            }`}
          >
            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {
                  setCheckedProductIndices((prev) =>
                    prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                  );
                }}
                className="w-5 h-5 rounded-lg text-violet-600 focus:ring-violet-500 cursor-pointer shrink-0 mt-0.5 sm:mt-0"
              />
              <span
                onClick={() => {
                  setCheckedProductIndices((prev) =>
                    prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                  );
                }}
                className="text-sm font-black text-slate-800 cursor-pointer break-words leading-snug select-none"
              >
                {idx + 1}. {prod}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <span className="text-xs font-bold text-slate-500">المجهز المسند:</span>
              <select
                value={assignedPrepId}
                onChange={(e) => {
                  const val = e.target.value;
                  setProductAssignments((prev) => {
                    const next = { ...prev };
                    if (val === "all") delete next[idx];
                    else next[idx] = val;
                    return next;
                  });
                }}
                className={`text-xs font-black border-2 rounded-xl px-3 py-1.5 outline-none transition cursor-pointer ${
                  assignedPrepId === "all"
                    ? "bg-slate-100 text-slate-700 border-slate-300"
                    : "bg-violet-600 text-white border-violet-700 font-bold shadow-xs"
                }`}
              >
                <option value="all">الكل (جميع المجهزين)</option>
                {(selectedPreparerIds.length > 0
                  ? preparers.filter((p) => selectedPreparerIds.includes(p.id))
                  : preparers
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  </div>
  </div>
  </div>
  )}
  </div>
 ) : (
 <div className="space-y-4">
 {submissionMode === "admin_one_face" && (
 <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950">
 وضع <strong>وجهة واحدة</strong>: لا يتطلب اختيار محل. أدخل تفاصيل الزبون ونوع الطلبية والسعر.
 </div>
 )}

 {submissionMode === "two_faces" && (
 <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950">
 مسار <strong>مرسل ← مستلم</strong>: أدخل تفاصيل الطرفين.
 {!defaultDoubleShopId && (
 <p className="text-rose-600 font-bold mt-1">لا يوجد محل مسجّل للتسعير التلقائي.</p>
 )}
 </div>
 )}

 <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
 <div className="flex flex-col gap-4">

 {submissionMode === "from_shop" && (
 <label className="flex flex-col gap-1 text-sm border-b border-sky-100 pb-4">
 <span className={ad.label}>رقم الزبون</span>
 <input
 name="firstCustomerPhone"
 className={ad.input}
  value={firstPhone}
  onChange={(e) => setFirstPhone(sanitizePhone(e.target.value))}
  onBlur={(e) => handlePhoneBlur(e.target.value, setFirstPhone)}
  inputMode="numeric"
  autoComplete="tel"
  placeholder="اكتب أو الصق الرقم أولاً"
  required
 />
 </label>
 )}

 {submissionMode === "from_shop" && (
 <div className="space-y-4 border-b border-sky-100 pb-4 mb-2">
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
 {employeesLoading ? (
 <p className="text-xs text-slate-500 italic mt-4">جارٍ تحميل موظفي المحل...</p>
 ) : (
 <ShopEmployeeQuickPick
 shopId={shopId}
 employees={employees}
 selectedEmployeeId={selectedEmployeeId}
 recipientKind={recipientKind}
 onPickEmployee={pickEmployee}
 onPickAdminOffice={pickAdminOffice}
 />
 )}
 </div>
 )}

 {submissionMode !== "two_faces" ? (
 <>
 {submissionMode !== "from_shop" && (
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>رقم الزبون</span>
 <input
 name="firstCustomerPhone"
 className={ad.input}
  value={firstPhone}
  onChange={(e) => setFirstPhone(sanitizePhone(e.target.value))}
  onBlur={(e) => handlePhoneBlur(e.target.value, setFirstPhone)}
  inputMode="numeric"
  autoComplete="tel"
  placeholder="اكتب أو الصق الرقم"
  required
 />
 </label>
 )}

 <RegionSearchPicker
 fieldName="firstCustomerRegionId"
 label="منطقة الزبون"
 required
 value={firstRegionId}
 onValueChange={setFirstRegionId}
 regionsLookup={regions}
 />

 {firstPrefillLoading && <p className="text-xs text-slate-500 italic">جارٍ البحث عن بيانات محفوظة...</p>}
 {firstPrefill && (
 <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 shadow-sm transition-all">
 <div className="flex justify-between items-start gap-3">
 <div className="space-y-1 flex-1">
 <p className="font-bold text-emerald-800">بيانات محفوظة لهذا الرقم:</p>
 <p className="text-xs">المنطقة: {regions.find(r => r.id === firstPrefill.customerRegionId)?.name || '—'}</p>
 <p className="text-xs italic text-slate-600">أقرب نقطة: {firstPrefill.customerLandmark || 'لا يوجد'}</p>
 </div>
 {firstPrefill.customerDoorPhotoUrl && (
 <img src={doorPhotoUrlForDisplay(firstPrefill.customerDoorPhotoUrl) || ""} className="h-14 w-14 rounded object-cover border" alt="" />
 )}
 </div>
 <button
    type="button"
    disabled={firstPrefillApplied}
    className={`mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all ${
      firstPrefillApplied
        ? "bg-slate-400 cursor-not-allowed"
        : "bg-emerald-600 hover:bg-emerald-700"
    }`}
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
    {firstPrefillApplied ? "تم تطبيق البيانات بنجاح ✅" : "تطبيق كافة البيانات المحفوظة"}
  </button>
 </div>
 )}

  {firstSavedDoorPhotoUrl && (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 flex items-center gap-3 animate-in fade-in duration-300">
      <img src={firstSavedDoorPhotoUrl} className="h-16 w-16 rounded-lg object-cover border border-emerald-300 shadow-sm" alt="صورة الباب" />
      <div className="flex-1 text-right">
        <p className="text-xs font-black text-emerald-800">📸 تم تطبيق صورة الباب بنجاح</p>
        <p className="text-[10px] text-slate-500 mt-0.5">سيتم إرفاق هذه الصورة تلقائياً مع الطلب للمندوب.</p>
      </div>
      <button 
        type="button" 
        onClick={() => {
          setFirstSavedDoorPhotoUrl(null);
          setFirstRawDoorPhotoUrl(null);
          setFirstPrefillApplied(false);
        }}
        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer border-0 bg-transparent"
      >
        إلغاء الصورة
      </button>
    </div>
  )}

 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>نوع الطلب</span>
 {suggestions.types.length > 0 && (
   <div className="flex flex-wrap gap-1.5 mb-1 px-1">
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
 <input
 name="orderType"
 required
 className={ad.input}
 placeholder="مثال: مستلزمات"
 value={orderType}
 onChange={(e) => setOrderType(e.target.value)}
 />
 </label>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <label className="flex flex-col gap-1 text-sm">
                     <span className={ad.label}>سعر الشراء (للمحل/السوق)</span>
                      <input
                        name="purchasePrice"
                        className={ad.input}
                        placeholder="مثال: 15"
                        inputMode="decimal"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                      <span className={ad.label}>سعر البيع (للزبون)</span>
                     {suggestions.subtotals.length > 0 && (
                       <div className="flex flex-wrap gap-1.5 mb-1 px-1">
                         {suggestions.subtotals.map((sub, idx) => (
                           <button
                             key={idx}
                             type="button"
                             onClick={() => setOrderSubtotal(sub)}
                             className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                           >
                             {sub}
                           </button>
                         ))}
                       </div>
                     )}
                     <input
                       name="orderSubtotal"
                       required
                       className={ad.input}
                       placeholder="اكتب السعر"
                       inputMode="decimal"
                       value={orderSubtotal}
                       onChange={(e) => setOrderSubtotal(e.target.value)}
                     />
                   </label>

                    <div className="flex flex-col gap-1 text-sm">
                      <span className={ad.label}>كلفة التوصيل</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryAdjustment(prev => prev - 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition shadow-sm font-black"
                        >
                          -
                        </button>
                        <div className="flex-1 h-10 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white font-mono font-bold">
                          <span className="text-slate-700 text-lg tabular-nums">
                            {(() => {
                              const shop = shops.find(s => s.id === (submissionMode === "from_shop" ? shopId : ""));
                              const shopPrice = Number(shop?.regionDeliveryPrice || 0);
                              const reg1Price = Number(regions.find(r => r.id === firstRegionId)?.deliveryPrice || 0);

                              const base = Math.max(shopPrice, reg1Price);
                              return base + deliveryAdjustment;
                            })()}
                          </span>
                          {deliveryAdjustment !== 0 && (
                            <span className="text-[9px] text-emerald-600 -mt-1">
                              (تعديل {deliveryAdjustment > 0 ? "+" : ""}{deliveryAdjustment})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeliveryAdjustment(prev => prev + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition shadow-sm font-black"
                        >
                          +
                        </button>
                      </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 mt-2">
                   <button
                     type="button"
                     onClick={() => setIsPrepaidAll(!isPrepaidAll)}
                     className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black transition shadow-sm border-2 ${isPrepaidAll ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                   >
                     {isPrepaidAll ? <DynamicIcon icon={icons?.ui_success} fallback="✓" width={14} height={14} /> : null}
                     واصل كلشي
                   </button>
                   <button
                     type="button"
                     onClick={() => setIsReverse(!isReverse)}
                     className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black transition shadow-sm border-2 ${isReverse ? 'bg-violet-600 border-violet-400 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                   >
                     {isReverse ? <DynamicIcon icon={icons?.ui_ai} fallback="🔄" width={14} height={14} /> : null}
                     طلب عكسي
                   </button>
                 </div>

                 <label className="flex flex-col gap-1 text-sm">
                   <span className={ad.label}>وقت الطلب (إجباري)</span>
                   {suggestions.times.length > 0 && (
                     <div className="flex flex-wrap gap-1.5 mb-1 px-1">
                       {suggestions.times.map((time, idx) => (
                         <button
                           key={idx}
                           type="button"
                           onClick={() => setOrderNoteTime(time)}
                           className="px-2.5 py-1 text-xs bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                         >
                           {time}
                         </button>
                       ))}
                     </div>
                   )}
                   <input
                     name="orderNoteTime"
                     required
                     className={ad.input}
                     placeholder="مثال: الان"
                     value={orderNoteTime}
                     onChange={(e) => setOrderNoteTime(e.target.value)}
                   />
                 </label>

 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>أقرب نقطة دالة</span>
 <input
 name="firstCustomerLandmark"
 className={ad.input}
 value={firstLandmark}
 onChange={(e) => setFirstLandmark(e.target.value)}
 />
 </label>

 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>لكيشن الزبون</span>
 <div className="flex flex-col gap-1.5">
 <input
 name="firstCustomerLocationUrl"
 className={ad.input}
 value={firstLocationUrl}
 onChange={(e) => setFirstLocationUrl(e.target.value)}
 />
 </div>
 </label>

 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>صورة الطلب</span>
 <input name="orderImage" type="file" accept="image/*" className={ad.input} />
 </label>

 <ClientVoiceNoteField title="ملاحظة صوتية" wrapperClassName="" />

 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>رقم الزبون الثاني</span>
 <input
 name="firstCustomerAlternatePhone"
 className={ad.input}
  value={firstAlternatePhone}
  onChange={(e) => setFirstAlternatePhone(sanitizePhone(e.target.value))}
  onBlur={(e) => handlePhoneBlur(e.target.value, setFirstAlternatePhone)}
  inputMode="numeric"
  placeholder="رقم إضافي..."
 />
 </label>

 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>ملاحظات / تفاصيل (كتابية)</span>
 <textarea
 name="summary"
 rows={3}
 className={ad.input}
 value={summary}
 onChange={(e) => setSummary(e.target.value)}
 />
 </label>
 </>
 ) : (
 <>
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>رقم المرسل</span>
 <input
 name="firstCustomerPhone"
 className={ad.input}
  value={firstPhone}
  onChange={(e) => setFirstPhone(sanitizePhone(e.target.value))}
  onBlur={(e) => handlePhoneBlur(e.target.value, setFirstPhone)}
  inputMode="numeric"
  required
 />
 </label>

 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>رقم المستلم</span>
 <input
 name="secondCustomerPhone"
 className={ad.input}
  value={secondPhone}
  onChange={(e) => setSecondPhone(sanitizePhone(e.target.value))}
  onBlur={(e) => handlePhoneBlur(e.target.value, setSecondPhone)}
  required
 />
 </label>

 <RegionSearchPicker
 fieldName="firstCustomerRegionId"
 label="منطقة المرسل"
 required
 value={firstRegionId}
 onValueChange={setFirstRegionId}
 regionsLookup={regions}
 />

 {firstPrefillLoading && <p className="text-xs text-slate-500 italic">جارٍ البحث عن بيانات المرسل...</p>}
 {firstPrefill && (
 <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 shadow-sm transition-all">
 <div className="flex justify-between items-start gap-3">
 <div className="space-y-1 flex-1">
 <p className="font-bold text-emerald-800">بيانات محفوظة للمرسل:</p>
 <p className="text-xs">المنطقة: {regions.find(r => r.id === firstPrefill.customerRegionId)?.name || '—'}</p>
 <p className="text-xs italic text-slate-600">أقرب نقطة: {firstPrefill.customerLandmark || 'لا يوجد'}</p>
 </div>
 {firstPrefill.customerDoorPhotoUrl && (
 <img src={doorPhotoUrlForDisplay(firstPrefill.customerDoorPhotoUrl) || ""} className="h-14 w-14 rounded object-cover border" alt="" />
 )}
 </div>
 <button type="button" className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-md" onClick={() => {
 setFirstRegionId(firstPrefill.customerRegionId ?? "");
 setFirstLocationUrl(firstPrefill.customerLocationUrl ?? "");
 setFirstLandmark(firstPrefill.customerLandmark ?? "");
 setFirstAlternatePhone(firstPrefill.alternatePhone ?? "");
 setFirstSavedDoorPhotoUrl(doorPhotoUrlForDisplay(firstPrefill.customerDoorPhotoUrl));
 setFirstRawDoorPhotoUrl(firstPrefill.customerDoorPhotoUrl);
 setFirstPrefillApplied(true);
 }}>تطبيق بيانات المرسل</button>
 </div>
 )}

 <RegionSearchPicker
 fieldName="secondCustomerRegionId"
 label="منطقة المستلم"
 required
 value={secondRegionId}
 onValueChange={setSecondRegionId}
 regionsLookup={regions}
 />

 {secondPrefillLoading && <p className="text-xs text-slate-500 italic">جارٍ البحث عن بيانات المستلم...</p>}
 {secondPrefill && (
 <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 shadow-sm transition-all">
 <div className="flex justify-between items-start gap-3">
 <div className="space-y-1 flex-1">
 <p className="font-bold text-sky-800">بيانات محفوظة للمستلم:</p>
 <p className="text-xs">المنطقة: {regions.find(r => r.id === secondPrefill.customerRegionId)?.name || '—'}</p>
 <p className="text-xs italic text-slate-600">أقرب نقطة: {secondPrefill.customerLandmark || 'لا يوجد'}</p>
 </div>
 {secondPrefill.customerDoorPhotoUrl && (
 <img src={doorPhotoUrlForDisplay(secondPrefill.customerDoorPhotoUrl) || ""} className="h-14 w-14 rounded object-cover border" alt="" />
 )}
 </div>
 <button 
  type="button" 
  disabled={secondPrefillApplied}
  className={`mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all ${
    secondPrefillApplied 
      ? "bg-slate-400 cursor-not-allowed" 
      : "bg-sky-600 hover:bg-sky-700"
  }`}
  onClick={() => {
    setSecondRegionId(secondPrefill.customerRegionId ?? "");
    setSecondLocationUrl(secondPrefill.customerLocationUrl ?? "");
    setSecondLandmark(secondPrefill.customerLandmark ?? "");
    setSecondAlternatePhone(secondPrefill.alternatePhone ?? "");
    setSecondSavedDoorPhotoUrl(doorPhotoUrlForDisplay(secondPrefill.customerDoorPhotoUrl));
    setSecondRawDoorPhotoUrl(secondPrefill.customerDoorPhotoUrl);
    setSecondPrefillApplied(true);
  }}
 >
  {secondPrefillApplied ? "تم تطبيق البيانات بنجاح ✅" : "تطبيق بيانات المستلم"}
 </button>
 </div>
 )}

 {secondSavedDoorPhotoUrl && (
  <div className="rounded-xl border border-sky-300 bg-sky-50/50 p-3 flex items-center gap-3 animate-in fade-in duration-300">
    <img src={secondSavedDoorPhotoUrl} className="h-16 w-16 rounded-lg object-cover border border-sky-300 shadow-sm" alt="صورة باب المستلم الثاني" />
    <div className="flex-1 text-right">
      <p className="text-xs font-black text-sky-800">📸 تم تطبيق صورة باب المستلم بنجاح</p>
      <p className="text-[10px] text-slate-500 mt-0.5">سيتم إرفاق هذه الصورة تلقائياً مع الطلب للمندوب.</p>
    </div>
    <button 
      type="button" 
      onClick={() => {
        setSecondSavedDoorPhotoUrl(null);
        setSecondRawDoorPhotoUrl(null);
        setSecondPrefillApplied(false);
      }}
      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer border-0 bg-transparent"
    >
      إلغاء الصورة
    </button>
  </div>
 )}

                 {/* سعر الطلب */}
                 
                 {/* نوع الطلب ووقت الطلب جنباً إلى جنب */}
                 <div className="grid grid-cols-2 gap-3">
                   <label className="flex flex-col gap-1 text-sm">
                      <span className={ad.label}>نوع الطلب</span>
                      {suggestions.types.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1 px-1">
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
                     <input
                       name="orderType"
                       required
                       className={ad.input}
                       placeholder="مثال: مستلزمات"
                       value={orderType}
                       onChange={(e) => setOrderType(e.target.value)}
                     />
                   </label>

                   <label className="flex flex-col gap-1 text-sm">
                     <span className={ad.label}>وقت الطلب (إجباري)</span>
                      {suggestions.times.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1 px-1">
                          {suggestions.times.map((time, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setOrderNoteTime(time)}
                              className="px-2.5 py-1 text-xs bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      )}
                     <input
                       name="orderNoteTime"
                       required
                       className={ad.input}
                       placeholder="مثال: الان"
                       value={orderNoteTime}
                       onChange={(e) => setOrderNoteTime(e.target.value)}
                     />
                   </label>
                 </div>

                 {/* سعر الشراء وسعر البيع جنباً إلى جنب */}
                 <div className="grid grid-cols-2 gap-3">
                   <label className="flex flex-col gap-1 text-sm">
                     <span className={ad.label}>سعر الشراء (للمحل/السوق)</span>
                      <input
                        name="purchasePrice"
                        className={ad.input}
                        placeholder="مثال: 15"
                        inputMode="decimal"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-sm">
                      <span className={ad.label}>سعر البيع (للزبون)</span>
                      {suggestions.subtotals.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1 px-1">
                          {suggestions.subtotals.map((sub, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setOrderSubtotal(sub)}
                              className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition duration-150 font-medium active:scale-95 animate-in fade-in"
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      )}
                     <input
                       name="orderSubtotal"
                       required
                       className={ad.input}
                       inputMode="decimal"
                       value={orderSubtotal}
                       onChange={(e) => setOrderSubtotal(e.target.value)}
                     />
                   </label>
                 </div>

                 <div className="flex flex-col gap-1 text-sm">
                   <span className={ad.label}>كلفة التوصيل</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryAdjustment(prev => prev - 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition shadow-sm font-black"
                        >
                          -
                        </button>
                        <div className="flex-1 h-10 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white font-mono font-bold">
                          <span className="text-slate-700 text-lg tabular-nums">
                            {(() => {
                              const shop = shops.find(s => s.id === (submissionMode === "from_shop" ? shopId : ""));
                              const shopPrice = Number(shop?.regionDeliveryPrice || 0);
                              const reg1Price = Number(regions.find(r => r.id === firstRegionId)?.deliveryPrice || 0);

                              const base = Math.max(shopPrice, reg1Price);
                              return base + deliveryAdjustment;
                            })()}
                          </span>
                          {deliveryAdjustment !== 0 && (
                            <span className="text-[9px] text-emerald-600 -mt-1">
                              (تعديل {deliveryAdjustment > 0 ? "+" : ""}{deliveryAdjustment})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeliveryAdjustment(prev => prev + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition shadow-sm font-black"
                        >
                          +
                        </button>
                      </div>
                    </div>

                 <div className="grid grid-cols-2 gap-3 mt-2">
                   <button
                     type="button"
                     onClick={() => setIsPrepaidAll(!isPrepaidAll)}
                     className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black transition shadow-sm border-2 ${isPrepaidAll ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                   >
                     {isPrepaidAll ? <DynamicIcon icon={icons?.ui_success} fallback="✓" width={14} height={14} /> : null}
                     واصل كلشي
                   </button>
                   <button
                     type="button"
                     onClick={() => setIsReverse(!isReverse)}
                     className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black transition shadow-sm border-2 ${isReverse ? 'bg-violet-600 border-violet-400 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                   >
                     {isReverse ? <DynamicIcon icon={icons?.ui_ai} fallback="🔄" width={14} height={14} /> : null}
                     طلب عكسي
                   </button>
                 </div>



 {/* اقرب نقطة داله للمرسل */}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>أقرب نقطة دالة للمرسل</span>
 <input
 name="firstCustomerLandmark"
 className={ad.input}
 value={firstLandmark}
 onChange={(e) => setFirstLandmark(e.target.value)}
 />
 </label>

 {/* اقرب نقطة داله للمستلم */}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>أقرب نقطة دالة للمستلم</span>
 <input
 name="secondCustomerLandmark"
 className={ad.input}
 value={secondLandmark}
 onChange={(e) => setSecondLandmark(e.target.value)}
 />
 </label>

 {/* لكيشن المرسل */}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>لكيشن المرسل</span>
 <div className="flex flex-col gap-1.5">
 <input
 name="firstCustomerLocationUrl"
 className={ad.input}
 value={firstLocationUrl}
 onChange={(e) => setFirstLocationUrl(e.target.value)}
 />
 </div>
 </label>

 {/* لكيشن المستلم */}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>لكيشن المستلم</span>
 <div className="flex flex-col gap-1.5">
 <input
 name="secondCustomerLocationUrl"
 className={ad.input}
 value={secondLocationUrl}
 onChange={(e) => setSecondLocationUrl(e.target.value)}
 />
 </div>
 </label>

 {/* رقم ثاني للمرسل */}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>رقم ثاني للمرسل</span>
 <input
 name="firstCustomerAlternatePhone"
 className={ad.input}
  value={firstAlternatePhone}
  onChange={(e) => setFirstAlternatePhone(sanitizePhone(e.target.value))}
  onBlur={(e) => handlePhoneBlur(e.target.value, setFirstAlternatePhone)}
  inputMode="numeric"
 />
 </label>

 {/* رقم ثاني للمستلم */}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>رقم ثاني للمستلم</span>
 <input
 name="secondCustomerAlternatePhone"
 className={ad.input}
  value={secondAlternatePhone}
  onChange={(e) => setSecondAlternatePhone(sanitizePhone(e.target.value))}
  onBlur={(e) => handlePhoneBlur(e.target.value, setSecondAlternatePhone)}
  inputMode="numeric"
 />
 </label>

 {/* صورة الطلب */}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>صورة الطلب</span>
 <input name="orderImage" type="file" accept="image/*" className={ad.input} />
 </label>

 {/* ملاحظة صوتية */}
 <ClientVoiceNoteField title="ملاحظة صوتية" wrapperClassName="" />



 {/* ملاحظة كتابية */}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>ملاحظات / تفاصيل (كتابية)</span>
 <textarea
 name="summary"
 rows={3}
 className={ad.input}
 value={summary}
 onChange={(e) => setSummary(e.target.value)}
 />
 </label>
 </>
 )}

 </div>
 </div>
 </div>
 )}


 {state.error ? <p className={ad.error}>{state.error}</p> : null}

   {/* الزر القياسي في نهاية الاستمارة */}
  <button type="submit" className={`${ad.btnPrimary} flex items-center justify-center gap-2 mb-4`} disabled={!canSubmit || pending}>
  {pending ? "جارٍ التنفيذ..." : (
  <>
  {submissionMode === "prep_draft" ? (
  <><DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={18} height={18} /> إرسال طلب التجهيز</>
  ) : (
  <><DynamicIcon icon={icons?.ui_plus} fallback="+" width={18} height={18} /> إنشاء الطلب</>
  )}
  </>
  )}
  </button>

  {/* الشريط السفلي العائم الثابت مثل زر رفع الطلب للزبائن */}
  <div className="fixed bottom-0 inset-x-0 z-[120] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 shadow-[0_-10px_35px_rgba(0,0,0,0.15)] flex justify-center animate-in slide-in-from-bottom duration-300">
    <div className="w-full max-w-3xl px-2 flex items-center gap-3">
      <button 
        type="submit" 
        className={`${ad.btnPrimary} w-full flex items-center justify-center gap-2 py-3.5 text-base font-black rounded-2xl shadow-xl shadow-sky-500/25 active:scale-[0.98] transition-all`} 
        disabled={!canSubmit || pending}
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            جارٍ التنفيذ...
          </span>
        ) : (
          <>
            {submissionMode === "prep_draft" ? (
              <><DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={22} height={22} /> إرسال طلب التجهيز</>
            ) : (
              <><DynamicIcon icon={icons?.ui_plus} fallback="+" width={22} height={22} /> إنشاء الطلب</>
            )}
          </>
        )}
      </button>
    </div>
  </div>
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
 </>
 );
}
