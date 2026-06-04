"use client";

import { useActionState, useMemo, useRef, useState } from "react";
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
    defaultWaypoints.map((w) => ({
      name: w.name ?? "",
      coordinates: `${w.latitude}, ${w.longitude}`,
    }))
  );

  const [newEntrance, setNewEntrance] = useState<RegionWaypointDraft>({
    name: "",
    coordinates: "",
  });

  const newNameInputRef = useRef<HTMLInputElement>(null);
  const newCoordsInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const waypointsJsonRef = useRef<HTMLInputElement>(null);
  const isProgrammaticSubmit = useRef(false);

  const waypointsJson = useMemo(
    () => {
      const list = [...waypoints];
      const trimmedName = newEntrance.name.trim();
      const trimmedCoords = newEntrance.coordinates.trim();
      if (trimmedName || trimmedCoords) {
        const parsed = parseCoordinates(trimmedCoords);
        if (parsed) {
          list.push({
            name: trimmedName,
            coordinates: trimmedCoords,
          });
        }
      }
      return JSON.stringify(
        list
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
      );
    },
    [waypoints, newEntrance],
  );

  function patchWaypoint(index: number, key: keyof RegionWaypointDraft, value: string) {
    setWaypoints((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [key]: value } : row)),
    );
  }

  function handleAddWaypoint() {
    const trimmedName = newEntrance.name.trim();
    const trimmedCoords = newEntrance.coordinates.trim();

    if (!trimmedName && !trimmedCoords) {
      newNameInputRef.current?.focus();
      return;
    }

    setWaypoints((prev) => [
      ...prev,
      { name: trimmedName, coordinates: trimmedCoords },
    ]);
    setNewEntrance({ name: "", coordinates: "" });
    newNameInputRef.current?.focus();
  }

  function handleAddAndSubmit() {
    const trimmedName = newEntrance.name.trim();
    const trimmedCoords = newEntrance.coordinates.trim();

    if (!trimmedName && !trimmedCoords) {
      newNameInputRef.current?.focus();
      return;
    }

    const updatedWaypoints = [
      ...waypoints,
      { name: trimmedName, coordinates: trimmedCoords },
    ];

    const parsedWaypoints = updatedWaypoints
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
      );
    const updatedJson = JSON.stringify(parsedWaypoints);

    // Directly update the DOM hidden input value before submission so the server action receives it
    if (waypointsJsonRef.current) {
      waypointsJsonRef.current.value = updatedJson;
    }

    setWaypoints(updatedWaypoints);
    setNewEntrance({ name: "", coordinates: "" });
    newNameInputRef.current?.focus();

    setTimeout(() => {
      isProgrammaticSubmit.current = true;
      formRef.current?.requestSubmit();
      isProgrammaticSubmit.current = false;
    }, 10);
  }

  function removeWaypoint(index: number) {
    setWaypoints((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleNewEntranceKeyDown(e: React.KeyboardEvent<HTMLInputElement>, field: "name" | "coordinates") {
    if (e.key === "Enter" || e.keyCode === 13 || e.which === 13) {
      e.preventDefault();
      const trimmedName = newEntrance.name.trim();
      const trimmedCoords = newEntrance.coordinates.trim();

      if (field === "name") {
        if (trimmedName) {
          newCoordsInputRef.current?.focus();
        }
      } else if (field === "coordinates") {
        if (trimmedCoords) {
          handleAddAndSubmit();
        }
      }
    }
  }

  function handleExistingKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.keyCode === 13 || e.which === 13) {
      e.preventDefault();
    }
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (isProgrammaticSubmit.current) {
      return;
    }

    const activeEl = document.activeElement;

    // If focused on Coordinates input
    if (activeEl === newCoordsInputRef.current) {
      e.preventDefault();
      const trimmedCoords = newEntrance.coordinates.trim();
      if (trimmedCoords) {
        handleAddAndSubmit();
      }
    } 
    // If focused on Name input
    else if (activeEl === newNameInputRef.current) {
      e.preventDefault();
      const trimmedName = newEntrance.name.trim();
      if (trimmedName) {
        newCoordsInputRef.current?.focus();
      }
    } 
    // If focused on existing waypoint inputs, prevent submission on enter
    else if (
      activeEl instanceof HTMLInputElement &&
      activeEl.name !== "name" &&
      activeEl.name !== "deliveryPrice" &&
      (activeEl.placeholder.includes("اسم المدخل") || activeEl.placeholder.includes("الصق الإحداثية"))
    ) {
      e.preventDefault();
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      onSubmit={handleFormSubmit}
      onKeyDown={(e) => {
        // Double-safeguard to catch any Enter presses bubbling up to the form
        if (e.key === "Enter" || e.keyCode === 13) {
          const activeEl = document.activeElement;
          if (activeEl === newNameInputRef.current) {
            e.preventDefault();
            const trimmedName = newEntrance.name.trim();
            if (trimmedName) {
              newCoordsInputRef.current?.focus();
            }
          } else if (activeEl === newCoordsInputRef.current) {
            e.preventDefault();
            const trimmedCoords = newEntrance.coordinates.trim();
            if (trimmedCoords) {
              handleAddAndSubmit();
            }
          } else if (
            activeEl instanceof HTMLInputElement &&
            activeEl.name !== "name" &&
            activeEl.name !== "deliveryPrice"
          ) {
            e.preventDefault();
          }
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      {waypointsPersistDisabled ? (
        <input type="hidden" name="skipWaypoints" value="1" />
      ) : (
        <input
          ref={waypointsJsonRef}
          type="hidden"
          name="waypointsJson"
          value={waypointsJson}
        />
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
          <span className={ad.label}>سعر التوصيل </span>
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={ad.btnDark}
              onClick={handleAddWaypoint}
              disabled={waypointsPersistDisabled}
            >
              + إضافة مدخل
            </button>
            <button
              type="submit"
              disabled={pending}
              className={ad.btnPrimary}
            >
              {pending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </div>
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
          {/* حقل إدخال مدخل جديد بالاعلى */}
          <div className="grid gap-2 rounded-lg border-2 border-dashed border-sky-200 bg-sky-50/30 p-2 sm:grid-cols-2 items-center">
            <input
              ref={newNameInputRef}
              placeholder="اسم المدخل الجديد (مثال: جسر ابو فلوس)"
              className={`${ad.input} border-sky-200 focus:border-sky-500`}
              value={newEntrance.name}
              onChange={(e) => setNewEntrance((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => handleNewEntranceKeyDown(e, "name")}
              readOnly={waypointsPersistDisabled}
            />
            <input
              ref={newCoordsInputRef}
              placeholder="الصق الإحداثية: 30.4410, 48.0137"
              inputMode="text"
              className={`${ad.input} border-sky-200 focus:border-sky-500`}
              value={newEntrance.coordinates}
              onChange={(e) => setNewEntrance((prev) => ({ ...prev, coordinates: e.target.value }))}
              onKeyDown={(e) => handleNewEntranceKeyDown(e, "coordinates")}
              readOnly={waypointsPersistDisabled}
            />
          </div>

          {/* قائمة المداخل المضافة */}
          {waypoints.length > 0 ? (
            waypoints.map((w, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-3 items-center">
                <input
                  placeholder={`اسم المدخل ${idx + 1}`}
                  className={ad.input}
                  value={w.name}
                  onChange={(e) => patchWaypoint(idx, "name", e.target.value)}
                  onKeyDown={handleExistingKeyDown}
                  readOnly={waypointsPersistDisabled}
                />
                <input
                  placeholder="الصق الإحداثية: 30.4409, 48.0120"
                  inputMode="text"
                  className={ad.input}
                  value={w.coordinates}
                  onChange={(e) => patchWaypoint(idx, "coordinates", e.target.value)}
                  onKeyDown={handleExistingKeyDown}
                  readOnly={waypointsPersistDisabled}
                />
                <button
                  type="button"
                  onClick={() => removeWaypoint(idx)}
                  disabled={waypointsPersistDisabled}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40 transition-colors"
                >
                  حذف
                </button>
              </div>
            ))
          ) : (
            <p className="text-center text-xs text-slate-400 py-3">
              لا توجد مداخل مضافة حالياً. اكتب في الحقل أعلاه واضغط Enter للإضافة.
            </p>
          )}
        </div>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className={ad.success}>تم حفظ التعديلات.</p> : null}
    </form>
  );
}
