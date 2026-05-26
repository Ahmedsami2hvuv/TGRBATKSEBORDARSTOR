"use client";

import { useEffect, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

type RegionHit = { id: string; name: string; deliveryPrice: string };

/**
 * بحث مناطق عبر `/api/regions/search` — نفس أسلوب صفحة طلب العميل.
 */
export function RegionSearchPicker({
  fieldName,
  label,
  required,
  value,
  onValueChange,
  regionsLookup,
}: {
  fieldName: string;
  label: string;
  required?: boolean;
  value: string;
  onValueChange: (regionId: string) => void;
  /** لعرض الاسم عند ضبط القيمة من الخارج (مثلاً من التفاصيل المحفوظة) */
  regionsLookup: { id: string; name: string }[];
}) {
  const [searchText, setSearchText] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);

  /** عند ضبط `value` من الخارج فقط — لا نُفرغ النص عندما يُمسح الاختيار أثناء الكتابة. */
  useEffect(() => {
    if (!value) return;
    const name = regionsLookup.find((r) => r.id === value)?.name;
    setSearchText(name ?? "");
  }, [value, regionsLookup]);

  useEffect(() => {
    if (searchText.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(
            `/api/regions/search?q=${encodeURIComponent(searchText.trim())}`,
          );
          const j = (await r.json()) as { regions?: RegionHit[] };
          setHits(j.regions ?? []);
        } catch {
          setHits([]);
        }
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [searchText]);

  const hasSelection = Boolean(value);

  return (
    <div className="relative flex flex-col gap-1 text-sm">
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
        placeholder="ابحث عن المنطقة…"
        autoComplete="off"
      />
      {hits.length > 0 && !hasSelection ? (
        <ul
          className="absolute z-50 top-full right-0 mt-1 max-h-60 w-fit min-w-[160px] overflow-auto rounded-2xl border border-sky-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col p-1"
          role="listbox"
          dir="rtl"
        >
          {hits.map((h) => (
            <li key={h.id} className="border-b border-slate-50 last:border-0">
              <button
                type="button"
                className="w-full px-4 py-2 text-right text-[11px] font-bold text-slate-700 hover:bg-sky-50 rounded-lg transition-colors whitespace-nowrap"
                onClick={() => {
                  onValueChange(h.id);
                  setSearchText(h.name);
                  setHits([]);
                }}
              >
                {h.name}{" "}
                <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                  (توصيل {formatDinarAsAlfWithUnit(h.deliveryPrice)})
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hasSelection ? (
        <p className="text-[10px] font-bold text-emerald-600 mt-0.5">✅ تم اختيار المنطقة</p>
      ) : null}
    </div>
  );
}
