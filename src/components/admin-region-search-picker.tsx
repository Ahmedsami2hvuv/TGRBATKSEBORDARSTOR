"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";

export type AdminRegionOption = {
  id: string;
  name: string;
};

const MIN_LEN = 2;

export function AdminRegionSearchPicker({
  name,
  regions,
  value,
  onValueChange,
  allowEmpty = false,
  placeholder = "اكتب حرفين على الأقل للبحث…",
  className,
  hideDetails = false,
}: {
  name: string;
  regions: AdminRegionOption[];
  value: string;
  onValueChange: (nextId: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  hideDetails?: boolean;
}) {
  const [q, setQ] = useState<string>("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => regions.find((r) => r.id === value) ?? null,
    [regions, value],
  );

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < MIN_LEN) return [];
    return regions.filter((r) => r.name.toLowerCase().includes(t));
  }, [q, regions]);

  useEffect(() => {
    // Sync query with the selected name only when the actual value changes
    setQ(selected?.name ?? "");
  }, [value, selected?.name]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function choose(nextId: string, nextName: string) {
    onValueChange(nextId);
    setQ(nextName);
    setOpen(false);
  }

  function clear() {
    onValueChange("");
    setQ("");
    setOpen(false);
  }

  const canShowList = open && hits.length > 0;

  const defaultInputClass =
    className ??
    `w-full ${ad.input}`;

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative w-full">
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (q.trim().length >= MIN_LEN) setOpen(true);
          }}
          placeholder={placeholder}
          className={`${defaultInputClass} ${allowEmpty && (value || q) ? "pl-7" : ""}`}
          autoComplete="off"
          aria-label="بحث المنطقة"
        />
        {allowEmpty && (value || q) ? (
          <button
            type="button"
            onClick={clear}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center text-xs font-bold transition cursor-pointer"
            title="مسح الاختيار"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* الحقل الحقيقي المُرسل مع النموذج */}
      <input type="hidden" name={name} value={value} />

      {canShowList ? (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full min-w-[180px] overflow-auto rounded-xl border-2 border-[#C9A86A]/70 bg-white text-xs shadow-xl py-1"
          role="listbox"
        >
          {hits.map((r) => (
            <li key={r.id} className="border-b border-slate-50 last:border-0">
              <button
                type="button"
                className="w-full px-3 py-2 text-right font-bold text-slate-800 hover:bg-[#FDF6E3] hover:text-[#0A3D2E] transition"
                onClick={() => choose(r.id, r.name)}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!hideDetails && (
        <>
          {allowEmpty && value ? (
            <div className="mt-1 text-right">
              <button
                type="button"
                className="text-xs font-bold text-rose-700 hover:underline"
                onClick={clear}
              >
                — بدون —
              </button>
            </div>
          ) : null}

          {selected ? (
            <p className="mt-1 text-xs font-medium text-emerald-800">
              تم الاختيار: {selected.name}
            </p>
          ) : allowEmpty ? (
            <p className="mt-1 text-xs text-slate-500">اختر منطقة.</p>
          ) : null}
        </>
      )}
    </div>
  );
}

