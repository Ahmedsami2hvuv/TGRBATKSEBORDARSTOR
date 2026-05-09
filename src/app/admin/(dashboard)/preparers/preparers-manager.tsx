"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import {
  createCompanyPreparer,
  payDailySalaryForCompanyPreparer,
  setPreparerBranchDelegations,
  setPreparerMonthlySalaryResetConfig,
  updateCompanyPreparer,
  renewCompanyPreparerPortalToken,
  deleteCompanyPreparer,
  togglePreparerChat,
  type PreparerFormState,
} from "./actions";
import { whatsappMeUrl } from "@/lib/whatsapp";
import { DynamicIcon } from "@/components/dynamic-icon";
import type { GlobalIconsConfig } from "@/lib/icon-settings";
import { PreparerChatToggle } from "./preparer-chat-toggle";
import { PreparerAIToggle } from "./preparer-ai-toggle";

const initial: PreparerFormState = {};

export type PreparerManagerRow = {
  id: string;
  name: string;
  phone: string;
  telegramUserId: string;
  notes: string;
  active: boolean;
  linkedShopIds: string[];
  canSubmitShopIds: string[];
  authorizedBranchIds: string[];
  authorizedCategoryIds: string[];
  linkedShops: { id: string; name: string }[];
  portalUrl: string;
  chatDisabled: boolean;
  aiDisabled: boolean;
  preparerMonthlySalaryResetMode: "calendar_month" | "every_n_days" | "manual";
  preparerMonthlySalaryResetAt: string | null;
  preparerMonthlySalaryResetEveryDays: number | null;
};

export type ShopOption = { id: string; name: string };
export type BranchOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string };

function PreparerShopsAutosave({
  preparerId,
  allShops,
  linkedShopIdsInitially,
}: {
  preparerId: string;
  allShops: ShopOption[];
  linkedShopIdsInitially: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [linked, setLinked] = useState(() => new Set(linkedShopIdsInitially));
  const lastOkRef = useRef(new Set(linkedShopIdsInitially));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const shopLinkKey = [...linkedShopIdsInitially].sort().join("|");

  useEffect(() => {
    const s = new Set(linkedShopIdsInitially);
    setLinked(s);
    lastOkRef.current = s;
    setStatus("idle");
    setErrMsg(null);
  }, [shopLinkKey, preparerId]);

  const filteredShops = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allShops;
    return allShops.filter((s) => s.name.toLowerCase().includes(q));
  }, [allShops, search]);

  const persistRef = useRef<(ids: Set<string>) => Promise<void>>(async () => {});

  persistRef.current = async (ids: Set<string>) => {
    setStatus("saving");
    setErrMsg(null);
    try {
      const res = await fetch("/api/admin/preparers/set-shop-links", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          preparerId,
          shopIds: Array.from(ids),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.error) {
        setStatus("error");
        setErrMsg(data.error || (res.status === 401 ? "انتهت جلسة الإدارة. سجّل الدخول من جديد." : `فشل الطلب (${res.status})`));
        setLinked(new Set(lastOkRef.current));
        return;
      }
      lastOkRef.current = new Set(ids);
      setStatus("saved");
      router.refresh();
      window.setTimeout(() => setStatus((x) => (x === "saved" ? "idle" : x)), 1600);
    } catch {
      setStatus("error");
      setErrMsg("تعذّر الاتصال بالخادم.");
      setLinked(new Set(lastOkRef.current));
    }
  };

  const scheduleSave = (next: Set<string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const snapshot = new Set(next);
      persistChainRef.current = persistChainRef.current
        .catch(() => {})
        .then(() => persistRef.current(snapshot));
    }, 420);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const onToggle = (shopId: string, checked: boolean) => {
    const next = new Set(linked);
    if (checked) next.add(shopId);
    else next.delete(shopId);
    setLinked(next);
    scheduleSave(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-black text-slate-400 uppercase tracking-widest">بحث عن محل</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اكتب جزءاً من اسم المحل…"
            className="h-12 w-full rounded-2xl border-2 border-slate-100 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-sky-500"
            dir="rtl"
          />
        </label>
        <div className="shrink-0 text-center sm:text-left">
          {status === "saving" ? (
            <span className="text-xs font-black text-amber-600">جارٍ الحفظ…</span>
          ) : status === "saved" ? (
            <span className="text-xs font-black text-emerald-600">تم الحفظ</span>
          ) : status === "error" ? (
            <span className="text-xs font-black text-rose-600">فشل الحفظ</span>
          ) : (
            <span className="text-xs font-bold text-slate-400">يُحفظ تلقائياً عند التأشير</span>
          )}
        </div>
      </div>
      {errMsg ? <p className="text-sm font-black text-rose-600">{errMsg}</p> : null}
      {filteredShops.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-bold text-slate-500">
          لا توجد محلات تطابق البحث.
        </p>
      ) : (
        <div className="grid max-h-[min(70vh,520px)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredShops.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 p-4 transition-all ${
                linked.has(s.id)
                  ? "border-sky-500 bg-sky-50 text-sky-900 shadow-md shadow-sky-100"
                  : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
              }`}
            >
              <span className="text-sm font-black">{s.name}</span>
              <input
                type="checkbox"
                checked={linked.has(s.id)}
                onChange={(e) => onToggle(s.id, e.target.checked)}
                className="h-5 w-5 rounded-lg border-2 border-slate-300 text-sky-600 outline-none"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPreparerForm({ icons }: { icons: GlobalIconsConfig | null }) {
  const [state, formAction, pending] = useActionState(createCompanyPreparer, initial);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramUserId, setTelegramUserId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setKey((k) => k + 1);
      setName("");
      setPhone("");
      setTelegramUserId("");
      setNotes("");
    }
  }, [state?.ok]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${ad.btnPrimary} flex items-center gap-2`}>
        <DynamicIcon icon={icons?.ui_add} fallback="➕" className="w-4 h-4" /> إضافة مجهز جديد
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 sm:p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className={ad.h2}>إضافة مجهز (حساب فريق الإدارة)</h2>
        <button type="button" onClick={() => setOpen(false)} className={ad.btnDark}>
          إلغاء
        </button>
      </div>
      <form key={key} action={formAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={ad.label}>اسم المجهز *</span>
            <input
              name="name"
              required
              className={ad.input}
              placeholder="الاسم الظاهر في القائمة"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>هاتف (اختياري)</span>
            <input
              name="phone"
              className={ad.input}
              inputMode="numeric"
              placeholder="07…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>معرّف تلغرام (اختياري)</span>
            <input
              name="telegramUserId"
              className={ad.input}
              dir="ltr"
              placeholder="للإشعارات لاحقاً"
              value={telegramUserId}
              onChange={(e) => setTelegramUserId(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={ad.label}>ملاحظات</span>
            <input
              name="notes"
              className={ad.input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        {state?.error ? <p className={ad.error}>{state.error}</p> : null}
        {state?.ok ? <p className={ad.success}>تمت الإضافة.</p> : null}
        <button type="submit" disabled={pending} className={ad.btnPrimary}>
          {pending ? "جارٍ الحفظ…" : "إضافة مجهز"}
        </button>
      </form>
    </div>
  );
}

function PreparerPortalLink({
  id,
  url,
  phone,
  preparerName,
  icons,
}: {
  id: string;
  url: string;
  phone: string;
  preparerName: string;
  icons: GlobalIconsConfig | null;
}) {
  const [copied, setCopied] = useState(false);
  const greeting = preparerName.trim() ? `مرحباً ${preparerName.trim()}،` : "مرحباً،";
  const waText = `${greeting}\n\nرابط بوابة المجهز:\n${url}\n\n(هذا الرابط دائم — يرجى عدم مشاركته مع أحد.)`;
  const waHref = whatsappMeUrl(phone, waText);
  const canWhatsApp = waHref !== "#";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-95"
      >
        <DynamicIcon icon={icons?.ui_globe} fallback="🌐" className="w-4 h-4 text-sky-400" /> فتح بوابة المجهز
      </a>
      {canWhatsApp && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 active:scale-95"
        >
          <DynamicIcon icon={icons?.ui_whatsapp} fallback="💬" className="w-4 h-4" /> واتساب
        </a>
      )}
      <button
        type="button"
        className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-sky-100 transition hover:bg-sky-700 active:scale-95"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        <DynamicIcon icon={icons?.ui_copy} fallback="📋" className="w-4 h-4" /> {copied ? "تم النسخ!" : "نسخ الرابط"}
      </button>

      <form
        action={renewCompanyPortalTokenAction}
        onSubmit={(e) => {
          if (
            !confirm(
              "هل أنت متأكد؟ سيتم إبطال الرابط القديم فوراً ولن يفتح عند المجهز حتى ترسل له الرابط الجديد."
            )
          )
            e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl border-2 border-rose-100 bg-white px-4 py-2 text-sm font-black text-rose-600 transition hover:bg-rose-50 active:scale-95"
        >
          <DynamicIcon icon={icons?.ui_refresh} fallback="🔄" className="w-4 h-4" /> إبطال/تجديد
        </button>
      </form>
    </div>
  );
}

const renewCompanyPortalTokenAction = renewCompanyPreparerPortalToken;

function PreparerCard({
  row,
  allShops,
  allBranches,
  allCategories,
  icons,
}: {
  row: PreparerManagerRow;
  allShops: ShopOption[];
  allBranches: BranchOption[];
  allCategories: CategoryOption[];
  icons: GlobalIconsConfig | null;
}) {
  const [activeTab, setActiveTab] = useState<"salary" | "shops" | "pricing" | "edit" | null>(null);

  const [uState, updateAction, uPending] = useActionState(updateCompanyPreparer, initial);
  const [delegState, delegAction, delegPending] = useActionState(setPreparerBranchDelegations, initial);
  const [salaryState, salaryAction, salaryPending] = useActionState(payDailySalaryForCompanyPreparer, initial);
  const [resetState, resetAction, resetPending] = useActionState(setPreparerMonthlySalaryResetConfig, initial);
  const [dState, deleteAction, dPending] = useActionState(deleteCompanyPreparer, initial);

  useEffect(() => {
    if (uState?.ok || delegState?.ok) {
      setActiveTab(null);
    }
  }, [uState?.ok, delegState?.ok]);

  return (
    <div
      className={`relative overflow-hidden rounded-[2.5rem] border-2 transition-all ${
        row.active
          ? "border-slate-100 bg-white shadow-xl shadow-slate-200/50"
          : "border-slate-200 bg-slate-50 opacity-80"
      }`}
    >
      {/* Header Section */}
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-900 text-2xl font-black text-white shadow-xl shadow-slate-200">
              {row.name.substring(0, 1)}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">{row.name}</h3>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-sm font-bold text-slate-500 tabular-nums">{row.phone || "بدون هاتف"}</span>
                <span
                  className={`rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    row.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {row.active ? "نشط" : "متوقف"}
                </span>
              </div>
            </div>
          </div>

          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (
                !confirm(`هل أنت متأكد من مسح المجهز "${row.name}"؟`)
              )
                e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              disabled={dPending}
              className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition-all hover:bg-rose-500 hover:text-white"
            >
              {dPending ? "..." : <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" className="w-5 h-5" />}
            </button>
          </form>
        </div>

        {row.notes && <p className="mt-4 text-sm font-bold text-slate-500">{row.notes}</p>}

        {/* Portal Links */}
        <div className="mt-8 border-t border-slate-50 pt-8 flex flex-col gap-4">
          <div>
            <p className="mb-4 text-xs font-black text-slate-400 uppercase tracking-widest">بوابة المجهز والتحكم</p>
            <PreparerPortalLink id={row.id} url={row.portalUrl} phone={row.phone} preparerName={row.name} icons={icons} />
          </div>
          <div>
            <p className="mb-4 text-xs font-black text-slate-400 uppercase tracking-widest">إعدادات المزايا</p>
            <div className="flex flex-wrap gap-2">
              <PreparerChatToggle preparerId={row.id} initialDisabled={row.chatDisabled} icons={icons!} />
              <PreparerAIToggle preparerId={row.id} initialDisabled={row.aiDisabled} icons={icons!} />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            onClick={() => setActiveTab(activeTab === "salary" ? null : "salary")}
            className={`flex flex-col items-center justify-center gap-2 rounded-3xl p-4 transition-all active:scale-95 ${
              activeTab === "salary"
                ? "bg-amber-600 text-white shadow-xl shadow-amber-200"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            <DynamicIcon icon={icons?.ui_salary} fallback="💰" className="text-2xl" />
            <span className="text-xs font-black">الراتب والمحفظة</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === "shops" ? null : "shops")}
            className={`flex flex-col items-center justify-center gap-2 rounded-3xl p-4 transition-all active:scale-95 ${
              activeTab === "shops"
                ? "bg-sky-600 text-white shadow-xl shadow-sky-200"
                : "bg-sky-50 text-sky-700 hover:bg-sky-100"
            }`}
          >
            <DynamicIcon icon={icons?.ui_shops} fallback="🛒" className="text-2xl" />
            <span className="text-xs font-black">المحلات المسندة</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === "pricing" ? null : "pricing")}
            className={`flex flex-col items-center justify-center gap-2 rounded-3xl p-4 transition-all active:scale-95 ${
              activeTab === "pricing"
                ? "bg-violet-600 text-white shadow-xl shadow-violet-200"
                : "bg-violet-50 text-violet-700 hover:bg-violet-100"
            }`}
          >
            <DynamicIcon icon={icons?.ui_tag} fallback="🏷️" className="text-2xl" />
            <span className="text-xs font-black">تسعير المتجر</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === "edit" ? null : "edit")}
            className={`flex flex-col items-center justify-center gap-2 rounded-3xl p-4 transition-all active:scale-95 ${
              activeTab === "edit"
                ? "bg-slate-800 text-white shadow-xl shadow-slate-200"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <DynamicIcon icon={icons?.ui_settings} fallback="⚙️" className="text-2xl" />
            <span className="text-xs font-black">تعديل الحساب</span>
          </button>
        </div>
      </div>

      {/* Tab Content Panels */}
      {activeTab && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-6 sm:p-8 animate-in slide-in-from-top-4 duration-300">
          <div className="mb-6 flex items-center justify-between">
            <h4 className="text-xl font-black text-slate-900 flex items-center gap-2">
              {activeTab === "salary" && <><DynamicIcon icon={icons?.ui_salary} fallback="💰" className="w-5 h-5" /> إدارة الراتب والمحفظة</>}
              {activeTab === "shops" && <><DynamicIcon icon={icons?.ui_shops} fallback="🛒" className="w-5 h-5" /> ربط المحلات المسندة</>}
              {activeTab === "pricing" && <><DynamicIcon icon={icons?.ui_tag} fallback="🏷️" className="w-5 h-5" /> تفويض أقسام وأفرع المتجر</>}
              {activeTab === "edit" && <><DynamicIcon icon={icons?.ui_settings} fallback="⚙️" className="w-5 h-5" /> تعديل بيانات الحساب</>}
            </h4>
            <button
              onClick={() => setActiveTab(null)}
              className="h-10 w-10 rounded-full bg-white text-slate-400 shadow-sm transition hover:text-slate-900 flex items-center justify-center"
            >
              <DynamicIcon icon={icons?.ui_close} fallback="✕" className="w-4 h-4" />
            </button>
          </div>

          {activeTab === "salary" && (
            <div className="space-y-6">
              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">دفع راتب يومي</p>
                    <p className="text-xs font-bold text-slate-400">يسجّل في محفظة المجهز تلقائياً</p>
                  </div>
                  <form action={salaryAction} className="flex gap-2">
                    <input type="hidden" name="preparerId" value={row.id} />
                    <input
                      name="amountAlf"
                      inputMode="decimal"
                      placeholder="المبلغ "
                      className="h-12 w-32 rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 text-center font-black outline-none focus:border-amber-500 focus:bg-white transition"
                    />
                    <button
                      type="submit"
                      disabled={salaryPending}
                      className="h-12 rounded-2xl bg-emerald-600 px-6 font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {salaryPending ? "..." : "تأكيد الدفع"}
                    </button>
                  </form>
                </div>
                {salaryState?.error && <p className="mt-2 text-xs font-black text-rose-600">{salaryState.error}</p>}
                {salaryState?.ok && <p className="mt-2 text-xs font-black text-emerald-600">تم الدفع بنجاح!</p>}
              </div>

              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <p className="mb-4 text-sm font-black text-slate-900">تصفير الراتب الشهري</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <form action={resetAction} className="contents">
                    <input type="hidden" name="preparerId" value={row.id} />
                    <input type="hidden" name="mode" value="calendar_month" />
                    <button
                      type="submit"
                      className={`rounded-2xl border-2 p-4 text-center transition ${
                        row.preparerMonthlySalaryResetMode === "calendar_month"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200"
                      }`}
                    >
                      <p className="text-xs font-black">حسب التقويم</p>
                      <p className="mt-1 text-[10px] font-bold">كل شهر ميلادي</p>
                    </button>
                  </form>

                  <div className={`rounded-2xl border-2 p-4 transition ${
                        row.preparerMonthlySalaryResetMode === "every_n_days"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200"
                      }`}>
                    <form action={resetAction} className="flex flex-col items-center">
                      <input type="hidden" name="preparerId" value={row.id} />
                      <input type="hidden" name="mode" value="every_n_days" />
                      <input
                        name="everyDays"
                        defaultValue={row.preparerMonthlySalaryResetEveryDays || 30}
                        className="h-8 w-16 rounded-lg border-2 border-slate-200 bg-white text-center font-black text-slate-900 outline-none focus:border-amber-500"
                      />
                      <button type="submit" className="mt-2 text-[10px] font-black underline">تثبيت (كل N يوم)</button>
                    </form>
                  </div>

                  <form action={resetAction} className="contents">
                    <input type="hidden" name="preparerId" value={row.id} />
                    <input type="hidden" name="mode" value="manual" />
                    <button
                      type="submit"
                      className="rounded-2xl border-2 border-rose-100 bg-rose-50 p-4 text-center text-rose-600 transition hover:bg-rose-100"
                    >
                      <p className="text-xs font-black">تصفير يدوي الآن</p>
                      <p className="mt-1 text-[10px] font-bold">إعادة العداد للصفر</p>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === "shops" && (
            <PreparerShopsAutosave preparerId={row.id} allShops={allShops} linkedShopIdsInitially={row.linkedShopIds} />
          )}

          {activeTab === "pricing" && (
            <form action={delegAction} className="space-y-8">
              <input type="hidden" name="preparerId" value={row.id} />

              <div className="space-y-4">
                <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest">التفويض بالأقسام (كاملة)</h5>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {allCategories.map((c) => (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 p-4 transition-all ${
                        row.authorizedCategoryIds?.includes(c.id)
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md shadow-emerald-100"
                          : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                      }`}
                    >
                      <span className="text-sm font-black">{c.name}</span>
                      <input
                        type="checkbox"
                        name="categoryIds"
                        value={c.id}
                        defaultChecked={row.authorizedCategoryIds?.includes(c.id)}
                        className="h-5 w-5 rounded-lg border-2 border-slate-300 text-emerald-600 outline-none"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest">التفويض بأفرع محددة</h5>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {allBranches.map((b) => (
                    <label
                      key={b.id}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 p-4 transition-all ${
                        row.authorizedBranchIds?.includes(b.id)
                          ? "border-violet-500 bg-violet-50 text-violet-900 shadow-md shadow-violet-100"
                          : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                      }`}
                    >
                      <span className="text-sm font-black">{b.name}</span>
                      <input
                        type="checkbox"
                        name="branchIds"
                        value={b.id}
                        defaultChecked={row.authorizedBranchIds?.includes(b.id)}
                        className="h-5 w-5 rounded-lg border-2 border-slate-300 text-violet-600 outline-none"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={delegPending}
                  className="h-14 rounded-2xl bg-slate-900 px-10 font-black text-white shadow-xl shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {delegPending ? "جارٍ الحفظ..." : "تأكيد التفويض"}
                </button>
              </div>
              {delegState?.error ? <p className="text-sm font-black text-rose-600">{delegState.error}</p> : null}
              {delegState?.ok ? <p className="text-sm font-black text-emerald-600">تم حفظ التفويض.</p> : null}
            </form>
          )}

          {activeTab === "edit" && (
            <form action={updateAction} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <input type="hidden" name="id" value={row.id} />
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">اسم المجهز</span>
                  <input name="name" defaultValue={row.name} required className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-6 font-bold outline-none focus:border-slate-900 transition" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</span>
                  <input name="phone" defaultValue={row.phone} className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-6 font-bold outline-none focus:border-slate-900 transition" />
                </label>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">معرّف تلغرام</span>
                  <input name="telegramUserId" defaultValue={row.telegramUserId} className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-6 font-bold outline-none focus:border-slate-900 transition" dir="ltr" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black text-slate-400 uppercase tracking-widest">ملاحظات إدارية</span>
                  <input name="notes" defaultValue={row.notes} className="h-14 w-full rounded-2xl border-2 border-slate-100 bg-white px-6 font-bold outline-none focus:border-slate-900 transition" />
                </label>
              </div>
              <div className="flex items-center gap-4 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white p-4 font-black transition hover:bg-slate-50">
                  <input type="checkbox" name="active" value="1" defaultChecked={row.active} className="h-5 w-5 rounded border-2 border-slate-300" />
                  حساب نشط ومفعّل
                </label>
                <button type="submit" disabled={uPending} className="h-14 flex-1 rounded-2xl bg-slate-900 font-black text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50">
                  {uPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function PreparersManager({
  rows,
  allShops,
  allBranches,
  allCategories,
  icons,
}: {
  rows: PreparerManagerRow[];
  allShops: ShopOption[];
  allBranches: BranchOption[];
  allCategories: CategoryOption[];
  icons: GlobalIconsConfig | null;
}) {
  return (
    <div className="space-y-8">
      <AddPreparerForm icons={icons} />

      <section className="space-y-4">
        <h2 className={ad.h2}>قائمة المجهزين ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
            لا يوجد مجهزون بعد. استخدم زر الإضافة أعلاه.
          </p>
        ) : (
          rows.map((row) => (
            <PreparerCard
              key={row.id}
              row={row}
              allShops={allShops}
              allBranches={allBranches}
              allCategories={allCategories}
              icons={icons}
            />
          ))
        )}
      </section>
    </div>
  );
}
