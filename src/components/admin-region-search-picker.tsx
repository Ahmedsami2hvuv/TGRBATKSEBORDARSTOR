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
}: {
  name: string;
  regions: AdminRegionOption[];
  value: string;
  onValueChange: (nextId: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
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
    // عند التحميل لأول مرة (مثلاً: defaultRegionId) نخلي النص يعكس الاختيار الحالي
    if (selected && !q.trim()) setQ(selected.name);
  }, [selected, q]);

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

  return (
    <div ref={rootRef} className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (q.trim().length >= MIN_LEN) setOpen(true);
        }}
        placeholder={placeholder}
        className={`${ad.input}`}
        autoComplete="off"
        aria-label="بحث المنطقة"
      />

      {/* الحقل الحقيقي المُرسل مع النموذج */}
      <input type="hidden" name={name} value={value} />

      {allowEmpty ? (
        <div className="mt-2 text-right">
          {value ? (
            <button
              type="button"
              className="text-xs font-bold text-rose-700 hover:underline"
              onClick={clear}
            >
              — بدون —
            </button>
          ) : null}
        </div>
      ) : null}

      {canShowList ? (
        <ul
          className="mt-2 max-h-44 overflow-auto rounded-xl border border-sky-200 bg-white text-sm shadow-md"
          role="listbox"
        >
          {hits.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-end text-slate-800 hover:bg-sky-50"
                onClick={() => choose(r.id, r.name)}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <p className="mt-2 text-xs font-medium text-emerald-800">
          تم الاختيار: {selected.name}
        </p>
      ) : allowEmpty ? (
        <p className="mt-2 text-xs text-slate-500">اختر منطقة.</p>
      ) : null}
    </div>
  );
}

