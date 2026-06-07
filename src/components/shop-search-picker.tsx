"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";

/**
 * بحث محل من القائمة المحمّلة — تصفية محلية (لا حاجة لطلب شبكة لكل حرف).
 */
export function ShopSearchPicker({
  shops,
  fieldName,
  label,
  required,
  value,
  onValueChange,
}: {
  shops: { id: string; name: string }[];
  fieldName: string;
  label: string;
  required?: boolean;
  value: string;
  onValueChange: (shopId: string) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) {
      // If value is cleared, keep the search query but don't force a name
      return;
    }
    const name = shops.find((s) => s.id === value)?.name;
    setSearchText(name ?? "");
  }, [value, shops]);

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

  const hits = useMemo(() => {
    const t = searchText.trim().toLowerCase();
    if (t.length < 1) {
      return shops.slice(0, 50); // Show first 50 shops if search is empty
    }
    return shops.filter((s) => s.name.toLowerCase().includes(t)).slice(0, 50);
  }, [searchText, shops]);

  const hasSelection = Boolean(value);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1 text-sm">
      <span className={ad.label}>{label}</span>
      <input type="hidden" name={fieldName} value={value} required={required} />
      <input
        type="text"
        value={searchText}
        onChange={(e) => {
          const next = e.target.value;
          setSearchText(next);
          setOpen(true);
          if (value) onValueChange("");
        }}
        onFocus={() => {
          setOpen(true);
        }}
        className={ad.input}
        placeholder="ابحث عن اسم المحل…"
        autoComplete="off"
      />
      {open && hits.length > 0 ? (
        <ul
          className="absolute z-50 top-full right-0 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-sky-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
          role="listbox"
          dir="rtl"
        >
          {hits.map((s) => (
            <li key={s.id} className="border-b border-slate-50 last:border-0">
              <button
                type="button"
                className="w-full px-4 py-2.5 text-right text-xs font-bold text-slate-700 hover:bg-sky-50 transition-colors"
                onClick={() => {
                  onValueChange(s.id);
                  setSearchText(s.name);
                  setOpen(false);
                }}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hasSelection ? (
        <p className="text-[10px] font-bold text-emerald-600 mt-0.5">✅ تم اختيار المحل</p>
      ) : null}
    </div>
  );
}

