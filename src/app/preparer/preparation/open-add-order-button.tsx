"use client";

export function OpenAddOrderButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new Event("open-add-order-form"));
      }}
      className="inline-flex items-center justify-center rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-900 shadow-sm transition hover:bg-violet-100 active:scale-95 cursor-pointer"
    >
      ➕ إضافة طلب جديد
    </button>
  );
}
