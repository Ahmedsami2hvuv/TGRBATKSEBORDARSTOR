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
 preparers,
 couriers,
 icons,
}: {
 shops: ShopOpt[];
 regions: RegionOpt[];
 preparers: Array<{ id: string; name: string; availableForAssignment: boolean }>;
 couriers: Array<{ id: string; name: string }>;
 icons?: GlobalIconsConfig;
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
 const [orderNoteTime, setOrderNoteTime] = useState("");
 const [summary, setSummary] = useState("");
 const [assignedCourierId, setAssignedCourierId] = useState("");
 const [courierSearch, setCourierSearch] = useState("");

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

 const [blockedPhone, setBlockedPhone] = useState<string | null>(null);

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
 // Optional reset
 } else {
 // from_shop mode or other
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
 setFirstRegionId("");
 setFirstLocationUrl("");
 }

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
 if (!firstPrefill) setFirstPrefillApplied(false);
 }, [firstPrefill]);

  // --- Prep Parse Logic ---
  function resetPrep() {
    setPasteText("");
    setProducts([]);
    setPrepCustomerPhone("");
    setPrepRegionQ("");
    setPrepSelectedRegion(null);
    setParseError(null);
    setTitleLine("");
  }

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
 Boolean(orderType.trim()) &&
 Boolean(orderSubtotal.trim()) &&
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
 </div>
 </div>
 );
 }

   return (
     <>
       <form action={formAction} className="space-y-4" encType="multipart/form-data">
         <input type="hidden" name="adminSubmissionMode" value={submissionMode} />
         <input type="hidden" name="routeMode" value={routeMode} />
         <input type="hidden" name="linkedCustomerId" value={selectedEmployeeId} />
         <input type="hidden" name="firstExistingDoorPhotoUrl" value={firstRawDoorPhotoUrl || ""} />
         <input type="hidden" name="secondExistingDoorPhotoUrl" value={secondRawDoorPhotoUrl || ""} />

         <div className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-sm">
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
             {[
               { id: "admin_one_face", label: "وجهة واحدة", desc: "طلب مباشر", icon: icons?.ui_order },
               { id: "two_faces", label: "وجهتان", desc: "مرسل ومستلم", icon: icons?.ui_route },
               { id: "from_shop", label: "رفع من محل", desc: "اختيار محل مسجل", icon: icons?.ui_shop },
               { id: "prep_draft", label: "طلب تجهيز", desc: "تحليل رسالة", icon: icons?.ui_ai },
             ].map((m) => (
               <button
                 key={m.id}
                 type="button"
                 onClick={() => setSubmissionMode(m.id as SubmissionMode)}
                 className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all text-center group ${
                   submissionMode === m.id
                     ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md ring-4 ring-indigo-500/10"
                     : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white"
                 }`}
               >
                 <div className={`mb-2 rounded-xl p-2 transition-colors ${submissionMode === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'}`}>
                   <DynamicIcon icon={m.icon} fallback="📦" width={20} height={20} />
                 </div>
                 <span className="text-sm font-black">{m.label}</span>
                 <span className="text-[10px] font-bold opacity-60 mt-0.5">{m.desc}</span>
               </button>
             ))}
           </div>
         </div>

         {submissionMode !== "prep_draft" && (
           <div className={`rounded-2xl border-2 border-emerald-500 bg-emerald-50/30 p-4 shadow-sm transition-opacity ${pending ? 'opacity-50 pointer-events-none' : ''}`}>
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
               <div className="flex items-center gap-2">
                 <span className="text-sm font-black text-emerald-900 flex items-center gap-2">
                   <DynamicIcon icon={icons?.ui_user} fallback="👤" width={20} height={20} />
                   إسناد مباشر لمندوب
                 </span>
               </div>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
               <button
                 type="button"
                 onClick={() => setAssignedCourierId("")}
                 className={`relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition h-16 text-center leading-tight ${assignedCourierId === "" ? "border-emerald-600 bg-emerald-100 shadow-sm ring-2 ring-emerald-200 text-emerald-900" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"}`}
               >
                 <span className="text-[12px] font-black">بدون إسناد</span>
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
                   </button>
                 );
               })}
             </div>
             <input type="hidden" name="assignedCourierId" value={assignedCourierId} />
           </div>
         )}

 {submissionMode === "prep_draft" ? (
 <div className="space-y-4">
 <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
 <div className="flex items-center justify-between mb-2">
   <h2 className="text-sm font-black text-slate-800">الصق نص الطلب هنا</h2>
   {pasteText && (
     <button type="button" onClick={resetPrep} className="text-[10px] font-bold text-rose-500 hover:underline">
       مسح الكل
     </button>
   )}
 </div>
 <textarea
 value={pasteText}
 onChange={(ev) => setPasteText(ev.target.value)}
 rows={5}
 placeholder="الصق رسالة الموقع أو قائمة واتساب..."
 className={`${ad.input} font-mono text-sm w-full`}
 />
 <button
 type="button"
 onClick={runParse}
 className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 flex items-center justify-center gap-2 transition-all active:scale-95"
 >
 <DynamicIcon icon={icons?.ui_ai} fallback="✨" width={16} height={16} /> تحليل النص واستخراج البيانات
 </button>
 {parseError ? <p className="mt-2 text-xs font-bold text-rose-600">{parseError}</p> : null}
 </div>

 {products.length > 0 && (
 <div className="space-y-4 rounded-[2rem] border border-sky-200 bg-sky-50/30 p-6">
   <div className="flex items-center gap-2 mb-2">
     <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-black">1</div>
     <h3 className="text-sm font-black text-sky-900 uppercase tracking-tight">مراجعة البيانات المستخرجة</h3>
   </div>

 <input type="hidden" name="rawListText" value={rawListText} />
 <input type="hidden" name="productsCsv" value={products.join("\n")} />
 <input type="hidden" name="customerRegionId" value={prepSelectedRegion?.id ?? ""} />
 <input type="hidden" name="firstCustomerRegionId" value={prepSelectedRegion?.id ?? ""} />
 <input type="hidden" name="orderType" value={titleLine} />
 <input type="hidden" name="firstCustomerPhone" value={prepCustomerPhone} />
 {selectedPreparerIds.map(id => (
 <input key={id} type="hidden" name="preparerIds" value={id} />
 ))}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <label className="flex flex-col gap-1">
 <span className={ad.label}>رقم الزبون</span>
 <input name="prepCustomerPhone" value={prepCustomerPhone} onChange={(e) => setPrepCustomerPhone(e.target.value)} className={ad.input} required />
 </label>
 <div className="relative flex flex-col gap-1">
 <span className={ad.label}>المنطقة</span>
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
 <span className={ad.label}>عنوان الطلب (نوع الطلب)</span>
 <input name="prepTitleLine" value={titleLine} onChange={(e) => setTitleLine(e.target.value)} className={ad.input} required />
 </label>
 <label className="flex flex-col gap-1">
 <span className={ad.label}>وقت الطلب</span>
 <input name="prepOrderTime" value={prepOrderTime} onChange={(e) => setPrepOrderTime(e.target.value)} className={ad.input} required />
 </label>
 </div>

 <div className="bg-white/60 rounded-2xl p-4 border border-sky-100">
   <span className="text-[11px] font-black text-slate-500 uppercase mb-2 block">المنتجات المستخرجة</span>
   <div className="space-y-1">
     {products.map((p, idx) => (
       <div key={idx} className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-slate-100">
         <span className="text-sky-500">#{idx+1}</span>
         {p}
       </div>
     ))}
   </div>
 </div>

 <div className="pt-4 border-t border-sky-100">
 <div className="flex items-center gap-2 mb-3">
   <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-black">2</div>
   <h3 className="text-sm font-black text-sky-900 uppercase tracking-tight">إسناد للمجهزين</h3>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
 {preparers.map((p) => {
 const isSelected = selectedPreparerIds.includes(p.id);
 return (
 <label key={p.id} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${isSelected ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}>
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => togglePreparer(p.id)}
 className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
 />
 <span className="text-xs font-black truncate">{p.name}</span>
 </label>
 );
 })}
 </div>
 </div>
 </div>
 )}
 </div>
 ) : (
 <div className="space-y-4">
 <div className="space-y-6 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {submissionMode === "from_shop" && (
 <div className="space-y-4 border-b border-slate-100 pb-6 mb-2 col-span-full">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
 <ShopSearchPicker shops={shops} fieldName="shopId" label="المحل" required value={shopId} onValueChange={setShopId} />
 <ShopEmployeeQuickPick shopId={shopId} employees={employees} selectedEmployeeId={selectedEmployeeId} recipientKind={recipientKind} onPickEmployee={pickEmployee} onPickAdminOffice={pickAdminOffice} />
 </div>
 </div>
 )}
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>رقم الزبون</span>
 <input name="firstCustomerPhone" className={ad.input} value={firstPhone} onChange={(e) => setFirstPhone(e.target.value)} inputMode="numeric" required />
 </label>
 <RegionSearchPicker fieldName="firstCustomerRegionId" label="منطقة الزبون" required value={firstRegionId} onValueChange={setFirstRegionId} regionsLookup={regions} />
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>نوع الطلب</span>
 <input name="orderType" required className={ad.input} value={orderType} onChange={(e) => setOrderType(e.target.value)} />
 </label>
 <label className="flex flex-col gap-1 text-sm">
 <span className={ad.label}>سعر الطلب</span>
 <input name="orderSubtotal" required className={ad.input} inputMode="decimal" value={orderSubtotal} onChange={(e) => setOrderSubtotal(e.target.value)} />
 </label>
 </div>
 </div>
 </div>
 )}

 {state.error ? <p className={ad.error}>{state.error}</p> : null}
 <button type="submit" className={`${ad.btnPrimary} w-full flex items-center justify-center gap-2`} disabled={!canSubmit || pending}>
 {pending ? "جارٍ التنفيذ..." : "إرسال"}
 </button>
 </form>

 {blockedPhone && (
 <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
 <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center">
 <h3 className="text-xl font-black text-slate-900">زبون محظور!</h3>
 <button type="button" onClick={() => setBlockedPhone(null)} className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-white">فهمت</button>
 </div>
 </div>
 )}
 </>
 );
}
