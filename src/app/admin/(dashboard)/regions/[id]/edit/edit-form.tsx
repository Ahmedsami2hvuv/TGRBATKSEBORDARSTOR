"use client";

import { useActionState, useMemo, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { updateRegion, type RegionFormState } from "../../actions";

const initial: RegionFormState = {};

type RegionWaypointDraft = {
  name: string;
  coordinates: string;
};

function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  const normalized = input.replace("،", ",").trim();
  if (!normalized) return null;
  const parts = normalized
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function RegionEditForm({
  id,
  defaultName,
  defaultPrice,
  defaultWaypoints,
  waypointsPersistDisabled = false,
}: {
  id: string;
  defaultName: string;
  defaultPrice: string;
  defaultWaypoints: Array<{ name: string; latitude: number; longitude: number }>;
  /** إذا true: جدول المداخل غير جاهز بعد — يُحفظ الاسم والسعر فقط */
  waypointsPersistDisabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateRegion, initial);
  const [waypoints, setWaypoints] = useState<RegionWaypointDraft[]>(
    defaultWaypoints.length > 0
      ? defaultWaypoints.map((w) => ({
          name: w.name ?? "",
          coordinates: `${w.latitude}, ${w.longitude}`,
        }))
      : [{ name: "", coordinates: "" }],
  );

  const waypointsJson = useMemo(
    () =>
      JSON.stringify(
        waypoints
          .map((w) => {
            const parsed = parseCoordinates(w.coordinates);
            return {
              name: w.name.trim(),
              latitude: parsed?.latitude ?? Number.NaN,
              longitude: parsed?.longitude ?? Number.NaN,
            };
          })
          .filter(
            (w) =>
              Number.isFinite(w.latitude) &&
              Number.isFinite(w.longitude),
          ),
      ),
    [waypoints],
  );

  function patchWaypoint(index: number, key: keyof RegionWaypointDraft, value: string) {
    setWaypoints((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)),
    );
  }

  function addWaypoint() {
    setWaypoints((prev) => [...prev, { name: "", coordinates: "" }]);
  }

  function removeWaypoint(index: number) {
    setWaypoints((prev) => prev.filter((_, idx) => idx !== index));
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {waypointsPersistDisabled ? (
        <input type="hidden" name="skipWaypoints" value="1" />
      ) : (
        <input type="hidden" name="waypointsJson" value={waypointsJson} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>اسم المنطقة</span>
          <input
            name="name"
            required
            defaultValue={defaultName}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>سعر التوصيل (بالألف)</span>
          <input
            name="deliveryPrice"
            type="text"
            inputMode="decimal"
            required
            defaultValue={defaultPrice}
            className={ad.input}
          />
        </label>
      </div>
      <div
        className={`space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 ${
          waypointsPersistDisabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">مواقع المنطقة (مداخل متعددة)</h3>
          <button
            type="button"
            className={ad.btnDark}
            onClick={addWaypoint}
            disabled={waypointsPersistDisabled}
          >
            + إضافة مدخل
          </button>
        </div>
        <p className="text-xs text-slate-500">
          ضيف أكثر من نقطة للمنطقة (خط العرض/خط الطول)، والفرز الذكي يختار الأقرب للمندوب.
        </p>
        {waypointsPersistDisabled ? (
          <p className="text-xs font-bold text-amber-800">
            لا يمكن حفظ المداخل حتى يُطبَّق تحديث قاعدة البيانات على السيرفر. يمكنك تعديل اسم المنطقة والسعر فقط.
          </p>
        ) : null}
        <div className="space-y-2">
          {waypoints.map((w, idx) => (
            <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-3">
              <input
                placeholder={`اسم المدخل ${idx + 1}`}
                className={ad.input}
                value={w.name}
                onChange={(e) => patchWaypoint(idx, "name", e.target.value)}
                readOnly={waypointsPersistDisabled}
              />
              <input
                placeholder="الصق الإحداثية: 30.4409, 48.0120"
                inputMode="text"
                className={ad.input}
                value={w.coordinates}
                onChange={(e) => patchWaypoint(idx, "coordinates", e.target.value)}
                readOnly={waypointsPersistDisabled}
              />
              <button
                type="button"
                onClick={() => removeWaypoint(idx)}
                disabled={waypoints.length === 1 || waypointsPersistDisabled}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 disabled:opacity-40"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className={ad.success}>تم حفظ التعديلات.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className={ad.btnPrimary}
      >
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
