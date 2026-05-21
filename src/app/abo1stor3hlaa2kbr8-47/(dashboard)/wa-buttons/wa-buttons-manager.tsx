"use client";

import { useActionState, useMemo, useState } from "react";
import {
  deleteMandoubWaButton,
  duplicateMandoubWaButton,
  upsertMandoubWaButton,
  type WaButtonsFormState,
} from "./actions";
import { ad } from "@/lib/admin-ui";
import { splitMandoubWaTemplateVariants } from "@/lib/mandoub-wa-button-template";
import { WaButtonTemplatesDialog } from "./wa-button-templates-dialog";

const ORDER_STATUS_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "pending", label: "طلب جديد (pending)" },
  { value: "assigned", label: "بانتظار المندوب (assigned)" },
  { value: "delivering", label: "عند المندوب (delivering)" },
  { value: "delivered", label: "تم التسليم (delivered)" },
  { value: "cancelled", label: "ملغى/مرفوض (cancelled)" },
  { value: "archived", label: "مؤرشف (archived)" },
];

const ICON_CHOICES = [
  "💬",
  "📍",
  "🗺️",
  "🚚",
  "💰",
  "⚡",
  "🧾",
  "⭐",
  "📝",
];

type CustomerLocationRule = "any" | "exists" | "missing" | "courier_gps";

type Row = {
  id: string;
  name: string;
  label: string;
  iconKey: string;
  templateText: string;
  statusesCsv: string;
  visibilityScope: string;
  customerLocationRule: CustomerLocationRule;
  isActive: boolean;
};

function parseStatusesCsv(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseLocationRulesCsv(csv: string): CustomerLocationRule[] {
  const parts = (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = parts.filter((p) =>
    p === "any" || p === "exists" || p === "missing" || p === "courier_gps",
  ) as CustomerLocationRule[];
  return allowed.length ? (allowed.includes("any") ? ["any"] : allowed) : ["any"];
}

export function WaButtonsManager({ rows }: { rows: Row[] }) {
  const initialState: WaButtonsFormState = {};
  const [state, formAction, pending] = useActionState(upsertMandoubWaButton, initialState);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string>("");
  const [templatesForRow, setTemplatesForRow] = useState<Row | null>(null);

  const [label, setLabel] = useState("");
  const [iconKey, setIconKey] = useState("💬");
  const [statuses, setStatuses] = useState<string[]>(["assigned", "delivering"]);
  const [visibilityScopes, setVisibilityScopes] = useState<
    Array<"all" | "admin" | "employee" | "preparer" | "mandoub">
  >(["all"]);
  const [customerLocationRules, setCustomerLocationRules] = useState<CustomerLocationRule[]>(["any"]);

  const statusesSet = useMemo(() => new Set(statuses), [statuses]);

  function resetFormForNew() {
    setEditingId("");
    setLabel("");
    setIconKey("💬");
    setStatuses(["assigned", "delivering"]);
    setVisibilityScopes(["all"]);
    setCustomerLocationRules(["any"]);
    setShowAddForm(true);
  }

  function parseVisibilityScopesCsv(
    raw: string | null | undefined,
  ): Array<"all" | "admin" | "employee" | "preparer" | "mandoub"> {
    const parts = (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const allowed = parts.filter((p) =>
      ["all", "admin", "employee", "preparer", "mandoub"].includes(p),
    ) as Array<"all" | "admin" | "employee" | "preparer" | "mandoub">;
    return allowed.length ? (allowed.includes("all") ? ["all"] : allowed) : ["all"];
  }

  const VISIBILITY_OPTIONS: Array<{
    value: "all" | "admin" | "employee" | "preparer" | "mandoub";
    label: string;
  }> = [
    { value: "all", label: "الكل" },
    { value: "admin", label: "الإدارة" },
    { value: "employee", label: "الموظفين" },
    { value: "preparer", label: "المجهزين" },
    { value: "mandoub", label: "المندوبين" },
  ];

  return (
    <div className="space-y-8">
      {templatesForRow ? (
        <WaButtonTemplatesDialog
          key={templatesForRow.id}
          row={{
            id: templatesForRow.id,
            label: templatesForRow.label,
            templateText: templatesForRow.templateText,
          }}
          onDismiss={() => setTemplatesForRow(null)}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!showAddForm && !editingId ? (
          <button
            type="button"
            onClick={() => resetFormForNew()}
            className={ad.btnPrimary}
          >
            ➕ إضافة زر واتساب جديد
          </button>
        ) : null}
      </div>

      {showAddForm || editingId ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className={ad.h2}>{editingId ? "تعديل زر واتساب" : "إضافة زر واتساب"}</h2>
              <p className={ad.lead}>
                عرّف الزر (الاسم، الأيقونة، الحالات، الظهور). نصوص الرسائل تُضاف لاحقاً من زر{" "}
                <strong>النماذج</strong> بجانب كل زر في القائمة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingId("");
              }}
              className={ad.btnDark}
            >
              إلغاء
            </button>
          </div>

          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={editingId} />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className={ad.label}>اسم الزر</span>
                <input
                  name="label"
                  className={ad.input}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  autoComplete="off"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className={ad.label}>أيقونة</span>
                <select
                  name="iconKey"
                  className={ad.input}
                  value={iconKey}
                  onChange={(e) => setIconKey(e.target.value)}
                >
                  {ICON_CHOICES.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-sky-200 bg-white/70 p-3">
                <p className="text-sm font-bold text-slate-800">من سيظهر له الزر</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const checked = visibilityScopes.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="inline-flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="visibilityScopes"
                          value={opt.value}
                          checked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked;
                            setVisibilityScopes((prev) => {
                              if (opt.value === "all") {
                                return nextChecked ? ["all"] : [];
                              }
                              const withoutAll = prev.filter((x) => x !== "all");
                              const withToggled = nextChecked
                                ? Array.from(new Set([...withoutAll, opt.value]))
                                : withoutAll.filter((x) => x !== opt.value);
                              return withToggled.length ? withToggled : ["all"];
                            });
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  اختر أكثر من خيار. (إذا اخترت «الكل» ستُلغى باقي الاختيارات).
                </p>
              </div>

              <div className="rounded-xl border border-sky-200 bg-white/70 p-3">
                <p className="text-sm font-bold text-slate-800">حالات ظهور الزر</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="inline-flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="statuses"
                        value={opt.value}
                        checked={statusesSet.has(opt.value)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setStatuses((prev) => {
                            if (checked)
                              return [...new Set([...prev, opt.value])];
                            return prev.filter((s) => s !== opt.value);
                          });
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-sky-200 bg-white/70 p-3">
                <p className="text-sm font-bold text-slate-800">حالة لوكيشن الزبون</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {(
                    [
                      { value: "any", label: "الكل" },
                      { value: "exists", label: "موجود لوكيشن" },
                      { value: "missing", label: "بدون لوكيشن" },
                      {
                        value: "courier_gps",
                        label: "لوكيشن مرفوع من المندوب (GPS)",
                      },
                    ] as Array<{ value: CustomerLocationRule; label: string }>
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className="inline-flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="customerLocationRules"
                        value={opt.value}
                        checked={customerLocationRules.includes(opt.value)}
                        onChange={(e) => {
                          const nextChecked = e.target.checked;
                          setCustomerLocationRules((prev) => {
                            if (opt.value === "any") return nextChecked ? ["any"] : [];
                            const withoutAny = prev.filter((x) => x !== "any");
                            const withToggled = nextChecked
                              ? Array.from(new Set([...withoutAny, opt.value]))
                              : withoutAny.filter((x) => x !== opt.value);
                            return withToggled.length ? withToggled : ["any"];
                          });
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  يمكنك اختيار أكثر من حالة. عند اختيار «الكل» تُلغى باقي الاختيارات.
                </p>
              </div>
            </div>

            {state.error ? <p className={ad.error}>{state.error}</p> : null}
            {state.ok ? <p className={ad.success}>تم الحفظ.</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={pending} className={ad.btnPrimary}>
                {pending ? "جارٍ الحفظ…" : editingId ? "تحديث الزر" : "إضافة الزر"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className={ad.h2}>القائمة</h2>
        <div className="space-y-3">
          {rows.length ? (
            rows.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-sky-200 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-xl">
                        {r.iconKey}
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-900">
                          {r.label}
                        </p>
                        <p className="text-xs text-slate-600">
                          حالات ظهور الزر:{" "}
                          {r.statusesCsv
                            ? r.statusesCsv.replaceAll(",", ", ")
                            : "—"}
                        </p>
                        <p className="text-xs text-slate-600">
                        يظهر للـ:{" "}
                          {parseVisibilityScopesCsv(r.visibilityScope).join(" / ")}
                        </p>
                        <p className="text-xs text-slate-600">
                          لوكيشن الزبون:{" "}
                          {parseLocationRulesCsv(r.customerLocationRule)
                            .map((v) =>
                              v === "any"
                                ? "الكل"
                                : v === "exists"
                                  ? "موجود لوكيشن"
                                  : v === "missing"
                                    ? "بدون لوكيشن"
                                    : "لوكيشن مرفوع من المندوب (GPS)",
                            )
                            .join(" / ")}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-slate-700">
                      {(() => {
                        const parts = splitMandoubWaTemplateVariants(r.templateText);
                        if (!r.templateText.trim() || parts.length === 0) {
                          return (
                            <span className="text-amber-800">
                              لا توجد نماذج رسالة بعد — اضغط «النماذج» لإضافة النص.
                            </span>
                          );
                        }
                        if (parts.length > 1) {
                          return `${parts.length} نماذج — ${parts[0]}`;
                        }
                        return r.templateText;
                      })()}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id);
                        setLabel(r.label);
                        setIconKey(r.iconKey);
                        setStatuses(parseStatusesCsv(r.statusesCsv));
                        setVisibilityScopes(
                          parseVisibilityScopesCsv(r.visibilityScope),
                        );
                        setCustomerLocationRules(
                          parseLocationRulesCsv(r.customerLocationRule ?? "any"),
                        );
                        setShowAddForm(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={ad.btnDark}
                    >
                      تعديل الزر
                    </button>

                    <button
                      type="button"
                      onClick={() => setTemplatesForRow(r)}
                      className={ad.btnPrimary}
                    >
                      النماذج
                    </button>

                    <form action={duplicateMandoubWaButton}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={ad.btnDark}>
                        نسخ
                      </button>
                    </form>

                    <form
                      action={deleteMandoubWaButton}
                      onSubmit={(e) => {
                        if (!window.confirm("حذف هذا الزر؟")) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={ad.btnDanger}>
                        حذف
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className={ad.muted}>لا توجد أزرار بعد. أضف أول زر ثم عرّف النماذج من «النماذج».</p>
          )}
        </div>
      </div>
    </div>
  );
}
