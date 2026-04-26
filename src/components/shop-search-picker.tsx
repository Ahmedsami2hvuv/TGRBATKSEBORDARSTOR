"use client";

import { useEffect, useMemo, useState } from "react";
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
  useEffect(() => {
    if (!value) return;
    const name = shops.find((s) => s.id === value)?.name;
    setSearchText(name ?? "");
  }, [value, shops]);

  const hits = useMemo(() => {
    const t = searchText.trim().toLowerCase();
    if (t.length < 1) return [];
    return shops.filter((s) => s.name.toLowerCase().includes(t)).slice(0, 35);
  }, [searchText, shops]);

  const hasSelection = Boolean(value);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className={ad.label}>{label}</span>
      <input type="hidden" name={fieldName} value={value} required={required} />
      <input
        type="text"
        value={searchText}
        onChange={(e) => {
          const next = e.target.value;
          setSearchText(next);
          if (value) onValueChange("");
        }}
        className={ad.input}
        placeholder="ابحث عن اسم المحل واختر من القائمة…"
        autoComplete="off"
      />
      {hits.length > 0 && !hasSelection ? (
        <ul
          className="max-h-48 overflow-auto rounded-xl border border-sky-200 bg-white text-sm shadow-md"
          role="listbox"
          dir="rtl"
        >
          {hits.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-end text-slate-800 hover:bg-sky-50"
                onClick={() => {
                  onValueChange(s.id);
                  setSearchText(s.name);
                }}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hasSelection ? (
        <p className="text-xs font-medium text-emerald-800">تم اختيار المحل.</p>
      ) : null}
    </div>
  );
}
