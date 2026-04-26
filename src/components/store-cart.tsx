"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadCartFromStorage,
  saveCartToStorage,
  STORE_CART_CHANGED_EVENT,
  type StoreCartItem,
} from "@/lib/store-cart";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

export function AddVariantToCartButton({ variantId }: { variantId: string }) {
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const items = loadCartFromStorage();
        const existing = items.find((x) => x.variantId === variantId);
        const next: StoreCartItem[] = existing
          ? items.map((x) =>
              x.variantId === variantId ? { ...x, quantity: x.quantity + 1 } : x,
            )
          : [...items, { variantId, quantity: 1 }];
        saveCartToStorage(next);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
      className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-sky-200/70 ring-1 ring-sky-300/30 transition hover:from-sky-700 hover:to-cyan-600 active:scale-[0.99]"
    >
      {added ? "تمت الإضافة" : "أضف للسلة"}
    </button>
  );
}

export function StoreCartMiniLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const items = loadCartFromStorage();
      setCount(items.reduce((a, x) => a + x.quantity, 0));
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener(STORE_CART_CHANGED_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(STORE_CART_CHANGED_EVENT, update);
    };
  }, []);

  return (
    <Link
      href="/store/checkout"
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
    >
      <span aria-hidden>🛒</span>
      السلة
      <span className="rounded-lg bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-900 tabular-nums">
        {count}
      </span>
    </Link>
  );
}

export function StoreCartEditor({
  initial,
  onChange,
}: {
  initial: StoreCartItem[];
  onChange?: (items: StoreCartItem[]) => void;
}) {
  const [items, setItems] = useState<StoreCartItem[]>(initial);
  const [variantInfoById, setVariantInfoById] = useState<Map<string, { productName: string; variantLabel: string; salePriceDinar: string }>>(
    () => new Map(),
  );

  // مزامنة الحالة الداخلية مع "initial" القادم من الصفحة (مثلاً تحميل السلة من localStorage).
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    saveCartToStorage(items);
    onChange?.(items);
  }, [items, onChange]);

  useEffect(() => {
    const distinctIds = Array.from(new Set(items.map((x) => x.variantId)));
    if (distinctIds.length === 0) {
      setVariantInfoById(new Map());
      return;
    }
    distinctIds.sort();
    void (async () => {
      try {
        const r = await fetch("/api/store/cart/variants", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ variantIds: distinctIds }),
        });
        const data = (await r.json()) as { ok?: boolean; variants?: Array<{ variantId: string; productName: string; variantLabel: string; salePriceDinar: string }> };
        if (!data || !data.ok || !Array.isArray(data.variants)) {
          setVariantInfoById(new Map());
          return;
        }
        setVariantInfoById(new Map(data.variants.map((v) => [v.variantId, { productName: v.productName, variantLabel: v.variantLabel, salePriceDinar: v.salePriceDinar }])));
      } catch {
        // لو فشل الاستدعاء نعرض سلة بشكل آمن بدون الأكواد التقنية.
        setVariantInfoById(new Map());
      }
    })();
  }, [items]);

  const totalCount = useMemo(
    () => items.reduce((a, x) => a + x.quantity, 0),
    [items],
  );

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">السلة فارغة.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.variantId} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {variantInfoById.get(it.variantId)?.productName ?? "متغير"}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                  {variantInfoById.get(it.variantId)?.variantLabel || "—"}
                </div>
                {variantInfoById.get(it.variantId)?.salePriceDinar ? (
                  <div className="mt-1 text-xs font-bold text-sky-800">
                    سعر الوحدة: {formatDinarAsAlfWithUnit(variantInfoById.get(it.variantId)!.salePriceDinar)}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 w-9 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold"
                  onClick={() =>
                    setItems((prev) =>
                      prev
                        .map((x) =>
                          x.variantId === it.variantId
                            ? { ...x, quantity: Math.max(1, x.quantity - 1) }
                            : x,
                        )
                        .filter((x) => x.quantity > 0),
                    )
                  }
                >
                  −
                </button>
                <span className="min-w-10 text-center text-sm font-bold tabular-nums">
                  {it.quantity}
                </span>
                <button
                  type="button"
                  className="h-9 w-9 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold"
                  onClick={() =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.variantId === it.variantId
                          ? { ...x, quantity: x.quantity + 1 }
                          : x,
                      ),
                    )
                  }
                >
                  +
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                  onClick={() =>
                    setItems((prev) => prev.filter((x) => x.variantId !== it.variantId))
                  }
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
          <div className="text-sm font-semibold text-slate-700">
            مجموع القطع: <span className="tabular-nums">{totalCount}</span>
          </div>
        </div>
      )}
      <button
        type="button"
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => setItems([])}
      >
        تفريغ السلة
      </button>
    </div>
  );
}

